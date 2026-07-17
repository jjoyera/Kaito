"""Real local-Supabase proof that onboarding rows are owner isolated."""

import json
import secrets
import shutil
import subprocess
from collections.abc import Callable, Generator
from dataclasses import dataclass
from pathlib import Path

import httpx
import psycopg
import pytest
from psycopg.conninfo import make_conninfo
from psycopg.sql import Identifier, Literal, SQL

LOGIN_ROLE = "kaito_api_login"
SAFE_ROLE = "NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION PASSWORD NULL"


@pytest.mark.parametrize("available", ["npx.cmd", "npx"])
def test_resolve_npx_uses_an_available_executable(
    monkeypatch: pytest.MonkeyPatch, available: str
) -> None:
    monkeypatch.setattr(
        shutil,
        "which",
        lambda command: available if command == available else None,
    )

    assert _resolve_npx() == available


def test_resolve_npx_fails_closed_without_an_executable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(shutil, "which", lambda command: None)

    with pytest.raises(RuntimeError, match="^local_supabase_cli_unavailable$"):
        _resolve_npx()


@dataclass(frozen=True)
class RlsFixture:
    db_url: str
    password: str
    first_user: str
    second_user: str

    def __repr__(self) -> str:
        return "RlsFixture(redacted)"


def _resolve_npx() -> str:
    for executable in ("npx.cmd", "npx"):
        resolved = shutil.which(executable)
        if resolved:
            return resolved
    raise RuntimeError("local_supabase_cli_unavailable")


def _status() -> dict[str, str]:
    result = subprocess.run(
        [
            _resolve_npx(),
            "supabase@2.39.2",
            "--workdir",
            "../..",
            "status",
            "-o",
            "json",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def _create_user(client: httpx.Client) -> str:
    response = client.post(
        "/auth/v1/admin/users",
        json={"email": f"rls-{secrets.token_hex(8)}@example.test", "email_confirm": True},
    )
    response.raise_for_status()
    return response.json()["id"]


def _create_users(create: Callable[[], str], users: list[str]) -> None:
    users.extend(create() for _ in range(2))
def _cleanup(actions: list[Callable[[], object]]) -> None:
    failures = 0
    for action in actions:
        try:
            action()
        except Exception:
            failures += 1
    if failures:
        raise RuntimeError(f"local RLS cleanup failed ({failures} actions)")


def _reset_safe_role(connection: psycopg.Connection) -> None:
    connection.execute(SQL("ALTER ROLE {} {}").format(Identifier(LOGIN_ROLE), SQL(SAFE_ROLE)))
    memberships = connection.execute(
        "SELECT parent.rolname, grantor.rolname FROM pg_auth_members membership JOIN pg_roles parent ON parent.oid = membership.roleid "
        "JOIN pg_roles member ON member.oid = membership.member JOIN pg_roles grantor ON grantor.oid = membership.grantor "
        "WHERE member.rolname = %s",
        (LOGIN_ROLE,),
    ).fetchall()
    for parent, grantor in memberships:
        connection.execute(
            SQL("REVOKE {} FROM {} GRANTED BY {}").format(Identifier(parent), Identifier(LOGIN_ROLE), Identifier(grantor))
        )
    connection.execute(SQL("GRANT authenticated TO {}").format(Identifier(LOGIN_ROLE)))


def _role_admin(db_url: str) -> psycopg.Connection:
    return psycopg.connect(make_conninfo(db_url, user="supabase_admin"), autocommit=True)
@pytest.fixture(scope="module")
def identities() -> Generator[RlsFixture, None, None]:
    status = _status()
    password, db_url, users = secrets.token_urlsafe(32), status["DB_URL"], []
    admin = httpx.Client(base_url=status["API_URL"], headers={"apikey": status["SERVICE_ROLE_KEY"], "Authorization": f"Bearer {status['SERVICE_ROLE_KEY']}"}, timeout=10)
    try:
        _create_users(lambda: _create_user(admin), users)
        yield RlsFixture(db_url, password, *users)
    finally:
        def remove_rows() -> None:
            with psycopg.connect(db_url, autocommit=True) as connection:
                connection.execute("DELETE FROM public.onboarding_snapshots WHERE owner_id = ANY(%s::uuid[])", (users,))

        def disable_login() -> None:
            with _role_admin(db_url) as connection:
                _reset_safe_role(connection)

        actions = [remove_rows]
        actions.extend(lambda user_id=user_id: admin.delete(f"/auth/v1/admin/users/{user_id}").raise_for_status() for user_id in users)
        _cleanup([*actions, disable_login, admin.close])


def _as_user(identity: RlsFixture, user_id: str) -> psycopg.Connection:
    with _role_admin(identity.db_url) as admin:
        _reset_safe_role(admin)
        admin.execute(SQL("ALTER ROLE {} LOGIN PASSWORD {}").format(Identifier(LOGIN_ROLE), Literal(identity.password)))
    try:
        connection = psycopg.connect(make_conninfo(identity.db_url, user=LOGIN_ROLE, password=identity.password))
    finally:
        with _role_admin(identity.db_url) as admin:
            _reset_safe_role(admin)
    _adopt_claims(connection, user_id)
    return connection

def _adopt_claims(connection: psycopg.Connection, user_id: str) -> None:
    connection.execute("SET LOCAL ROLE authenticated")
    connection.execute("SELECT set_config('request.jwt.claims', %s, true)", (json.dumps({"sub": user_id, "role": "authenticated"}),))
    result = connection.execute(
        "SELECT session_user, current_user, auth.uid()::text, NOT r.rolsuper, NOT r.rolbypassrls, NOT r.rolinherit FROM pg_catalog.pg_roles r WHERE r.rolname = session_user"
    ).fetchone()
    if result != (LOGIN_ROLE, "authenticated", user_id, True, True, True):
        pytest.fail("authenticated identity context mismatch")


def _availability_snapshot(minutes_by_day: dict[str, int]) -> dict[str, object]:
    return {
        "contract_version": "1",
        "state": "incomplete",
        "profile": {"availability": {"minutes_by_day": minutes_by_day}},
        "goal": {},
    }


def _assert_availability(actual: object, expected: dict[str, int]) -> None:
    if actual != expected:
        pytest.fail("availability round-trip mismatch")


def _insert(
    connection: psycopg.Connection,
    owner_id: str,
    snapshot: dict[str, object],
    retry: bool = True,
) -> int:
    return connection.execute(
        "INSERT INTO public.onboarding_snapshots (owner_id, snapshot) VALUES (%s, %s)"
        + (
            " ON CONFLICT (owner_id) DO UPDATE SET snapshot = EXCLUDED.snapshot"
            if retry
            else ""
        ),
        (owner_id, json.dumps(snapshot)),
    ).rowcount

def _run_migration(connection: psycopg.Connection) -> None:
    migration = Path(__file__).parents[4] / "supabase/migrations/20260713110000_onboarding_snapshots.sql"
    connection.execute(migration.read_text())


@pytest.mark.parametrize("attribute", ["LOGIN", "INHERIT", "SUPERUSER", "BYPASSRLS", "CREATEROLE", "CREATEDB", "REPLICATION"])
def test_migration_rerun_rejects_unsafe_role_attributes(identities: RlsFixture, attribute: str) -> None:
    with _role_admin(identities.db_url) as admin:
        _reset_safe_role(admin)
        try:
            admin.execute(SQL("ALTER ROLE {} {}").format(Identifier(LOGIN_ROLE), SQL(attribute)))
            with pytest.raises(psycopg.errors.RaiseException, match="unsafe kaito_api_login role configuration"):
                _run_migration(admin)
        finally:
            _reset_safe_role(admin)
def test_migration_rerun_rejects_unsafe_extra_membership(identities: RlsFixture) -> None:
    temporary_role = "kaito_rls_test_extra"
    with _role_admin(identities.db_url) as admin:
        _reset_safe_role(admin)
        admin.execute(SQL("CREATE ROLE {} NOLOGIN").format(Identifier(temporary_role)))
        try:
            admin.execute(SQL("GRANT {} TO {}").format(Identifier(temporary_role), Identifier(LOGIN_ROLE)))
            with pytest.raises(psycopg.errors.RaiseException, match="unsafe kaito_api_login role configuration"):
                _run_migration(admin)
        finally:
            _reset_safe_role(admin)
            admin.execute(SQL("DROP ROLE IF EXISTS {}").format(Identifier(temporary_role)))
@pytest.mark.parametrize("option", ["WITH ADMIN OPTION", "WITH SET FALSE", "WITH INHERIT TRUE"])
def test_migration_rerun_rejects_unsafe_membership_option(identities: RlsFixture, option: str) -> None:
    with _role_admin(identities.db_url) as admin:
        _reset_safe_role(admin)
        try:
            admin.execute(SQL("GRANT authenticated TO {} {}").format(Identifier(LOGIN_ROLE), SQL(option)))
            with pytest.raises(psycopg.errors.RaiseException, match="unsafe kaito_api_login role configuration"):
                _run_migration(admin)
        finally:
            _reset_safe_role(admin)
        assert not admin.execute(
            "SELECT EXISTS (SELECT 1 FROM pg_class class CROSS JOIN LATERAL aclexplode(class.relacl) privilege "
            "JOIN pg_roles grantee ON grantee.oid = privilege.grantee WHERE class.oid = 'public.onboarding_snapshots'::regclass "
            "AND grantee.rolname = %s)",
            (LOGIN_ROLE,),
        ).fetchone()[0]
        for name in ("onboarding_snapshots_object", "onboarding_snapshots_version", "onboarding_snapshots_state"):
            admin.execute(SQL("CREATE TEMP TABLE IF NOT EXISTS decoy (value int); ALTER TABLE decoy ADD CONSTRAINT {} CHECK (value > 0); ALTER TABLE public.onboarding_snapshots DROP CONSTRAINT {}").format(Identifier(name), Identifier(name)))
        _run_migration(admin)
        assert admin.execute("SELECT count(*) FROM pg_constraint WHERE conrelid = 'public.onboarding_snapshots'::regclass AND contype = 'c' AND conname LIKE 'onboarding_snapshots_%'").fetchone() == (3,)


def test_cleanup_continues_with_sanitized_failure() -> None:
    actions: list[str] = []
    with pytest.raises(RuntimeError) as error:
        _cleanup([lambda: (_ for _ in ()).throw(ValueError("sensitive detail")), lambda: actions.append("later")])
    assert actions == ["later"] and str(error.value) == "local RLS cleanup failed (1 actions)"
@pytest.mark.parametrize("snapshot", [{"state": "incomplete"}, {"contract_version": None, "state": "incomplete"}, {"contract_version": "1"}, {"contract_version": "1", "state": None}])
def test_schema_rejects_missing_or_null_contract_fields(identities: RlsFixture, snapshot: dict[str, str | None]) -> None:
    with _as_user(identities, identities.first_user) as connection:
        with pytest.raises(psycopg.errors.CheckViolation):
            connection.execute("INSERT INTO public.onboarding_snapshots (owner_id, snapshot) VALUES (%s, %s)", (identities.first_user, json.dumps(snapshot)))


def test_equivalent_retry_preserves_updated_at(identities: RlsFixture) -> None:
    with _as_user(identities, identities.first_user) as connection:
        connection.execute("SET TIME ZONE 'Pacific/Auckland'")
        _insert(
            connection,
            identities.first_user,
            _availability_snapshot({"monday": 45, "wednesday": 75, "saturday": 120}),
        )
        original = connection.execute("SELECT created_at, updated_at, clock_timestamp() FROM public.onboarding_snapshots WHERE owner_id = %s", (identities.first_user,)).fetchone()
        assert original[0] == original[1] and abs((original[2] - original[0]).total_seconds()) < 1
        connection.commit()
        _adopt_claims(connection, identities.first_user)
        _insert(
            connection,
            identities.first_user,
            _availability_snapshot({"monday": 45, "wednesday": 75, "saturday": 120}),
        )
        connection.commit()
        _adopt_claims(connection, identities.first_user)
        retried = connection.execute("SELECT updated_at FROM public.onboarding_snapshots WHERE owner_id = %s", (identities.first_user,)).fetchone()
    assert original[1:2] == retried


@pytest.mark.parametrize("actor", ["first_user", "second_user"])
def test_cross_owner_insert_is_denied_while_target_row_is_absent(
    identities: RlsFixture, actor: str
) -> None:
    owner_id = getattr(identities, actor)
    foreign_id = getattr(identities, "second_user" if actor == "first_user" else "first_user")
    with psycopg.connect(identities.db_url, autocommit=True) as admin:
        admin.execute(
            "DELETE FROM public.onboarding_snapshots WHERE owner_id = ANY(%s::uuid[])",
            ([owner_id, foreign_id],),
        )
    with _as_user(identities, owner_id) as connection:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            _insert(
                connection,
                foreign_id,
                _availability_snapshot({"monday": 45, "wednesday": 75, "saturday": 120}),
                retry=False,
            )
        connection.rollback()
    with _as_user(identities, foreign_id) as foreign:
        assert (
            foreign.execute(
                "SELECT count(*) FROM public.onboarding_snapshots WHERE owner_id = %s",
                (foreign_id,),
            ).fetchone()
            == (0,)
        )


@pytest.mark.parametrize("actor", ["first_user", "second_user"])
def test_each_owner_crud_and_cross_owner_data_access_is_denied(
    identities: RlsFixture, actor: str
) -> None:
    owner_id = getattr(identities, actor)
    foreign_id = getattr(identities, "second_user" if actor == "first_user" else "first_user")
    foreign_minutes = {"tuesday": 45, "thursday": 75, "sunday": 120}
    owner_minutes = {"monday": 45, "wednesday": 75, "saturday": 120}
    updated_owner_minutes = {"monday": 60, "wednesday": 75, "saturday": 120}
    with _as_user(identities, foreign_id) as foreign:
        assert _insert(foreign, foreign_id, _availability_snapshot(foreign_minutes)) == 1
        foreign.commit()
        _adopt_claims(foreign, foreign_id)
        foreign_snapshot = foreign.execute(
            "SELECT snapshot -> 'profile' -> 'availability' -> 'minutes_by_day' "
            "FROM public.onboarding_snapshots WHERE owner_id = %s",
            (foreign_id,),
        ).fetchone()
        _assert_availability(foreign_snapshot[0], foreign_minutes)
    with _as_user(identities, owner_id) as connection:
        assert _insert(connection, owner_id, _availability_snapshot(owner_minutes)) == 1
        connection.commit()
        _adopt_claims(connection, owner_id)
        own_snapshot = connection.execute(
            "SELECT snapshot -> 'profile' -> 'availability' -> 'minutes_by_day' "
            "FROM public.onboarding_snapshots WHERE owner_id = %s",
            (owner_id,),
        ).fetchone()
        _assert_availability(own_snapshot[0], owner_minutes)
        assert (
            connection.execute(
                "SELECT count(*) FROM public.onboarding_snapshots WHERE owner_id = %s",
                (foreign_id,),
            ).fetchone()
            == (0,)
        )
        assert (
            connection.execute(
                "UPDATE public.onboarding_snapshots SET snapshot = %s WHERE owner_id = %s",
                (json.dumps(_availability_snapshot(updated_owner_minutes)), foreign_id),
            ).rowcount
            == 0
        )
        assert (
            connection.execute(
                "DELETE FROM public.onboarding_snapshots WHERE owner_id = %s",
                (foreign_id,),
            ).rowcount
            == 0
        )
        assert (
            connection.execute(
                "UPDATE public.onboarding_snapshots SET snapshot = %s WHERE owner_id = %s",
                (json.dumps(_availability_snapshot(updated_owner_minutes)), owner_id),
            ).rowcount
            == 1
        )
        connection.commit()
        _adopt_claims(connection, owner_id)
        updated_snapshot = connection.execute(
            "SELECT snapshot -> 'profile' -> 'availability' -> 'minutes_by_day' "
            "FROM public.onboarding_snapshots WHERE owner_id = %s",
            (owner_id,),
        ).fetchone()
        _assert_availability(updated_snapshot[0], updated_owner_minutes)
        assert (
            connection.execute(
                "DELETE FROM public.onboarding_snapshots WHERE owner_id = %s",
                (owner_id,),
            ).rowcount
            == 1
        )
        connection.commit()
    with _as_user(identities, foreign_id) as foreign:
        _adopt_claims(foreign, foreign_id)
        preserved_snapshot = foreign.execute(
            "SELECT snapshot -> 'profile' -> 'availability' -> 'minutes_by_day' "
            "FROM public.onboarding_snapshots WHERE owner_id = %s",
            (foreign_id,),
        ).fetchone()
        _assert_availability(preserved_snapshot[0], foreign_minutes)
