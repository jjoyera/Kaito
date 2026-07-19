"""Real local-Supabase proof for training-plan repository and RLS contracts."""

import json
from datetime import date
from uuid import uuid4

import psycopg
import pytest
from psycopg.conninfo import make_conninfo
from psycopg.sql import SQL, Identifier, Literal
from sqlalchemy import create_engine

from app.modules.auth.context import UserContext
from app.modules.planning.repository import SqlAlchemyTrainingPlanTransactionFactory
from app.modules.planning.use_cases import (
    DraftPlanConflict,
    SaveTrainingPlanDraftInput,
    save_training_plan_draft,
)
from tests.integration.test_onboarding_rls import (
    LOGIN_ROLE,
    RlsFixture,
    _adopt_claims,
    _as_user,
    _reset_safe_role,
    _role_admin,
)
from tests.planning.test_approach_eligibility import eligible_snapshot

pytest_plugins = ("tests.integration.test_onboarding_rls",)


_SESSION_VALUES = (
    1,
    date(2026, 7, 6),
    "Easy run",
    "run",
    45,
    8,
    50,
    "Conversational",
    3,
    4,
    "Run easily",
    "Build aerobic durability",
)


def _insert_session(
    connection: psycopg.Connection, plan_id: str, session_order: int
) -> str:
    return connection.execute(
        "INSERT INTO training_sessions ("
        "plan_id,week_number,scheduled_date,session_type,session_category,"
        "planned_duration_minutes,planned_distance_kilometers,"
        "planned_elevation_meters,intensity_description,target_rpe_min,"
        "target_rpe_max,instructions,purpose,session_order"
        ") VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
        (plan_id, *_SESSION_VALUES, session_order),
    ).fetchone()[0]


def test_authenticated_reads_own_active_plan_and_sessions(
    identities: RlsFixture,
) -> None:
    owner, foreign = identities.first_user, identities.second_user
    with psycopg.connect(identities.db_url, autocommit=True) as admin:
        admin.execute(
            "DELETE FROM training_plans WHERE owner_id = ANY(%s::uuid[])",
            ([owner, foreign],),
        )
        own_active = admin.execute(
            "INSERT INTO training_plans "
            "(owner_id,status,plan_approach,start_date,end_date,block_focus) "
            "VALUES (%s,'active','kaio_path',%s,%s,'Aerobic durability') "
            "RETURNING id",
            (owner, date(2026, 7, 6), date(2026, 7, 12)),
        ).fetchone()[0]
        own_archived = admin.execute(
            "INSERT INTO training_plans "
            "(owner_id,status,plan_approach,start_date,end_date,block_focus) "
            "VALUES (%s,'archived','kaio_path',%s,%s,'Aerobic durability') "
            "RETURNING id",
            (owner, date(2026, 7, 6), date(2026, 7, 12)),
        ).fetchone()[0]
        foreign_active = admin.execute(
            "INSERT INTO training_plans "
            "(owner_id,status,plan_approach,start_date,end_date,block_focus) "
            "VALUES (%s,'active','kaio_path',%s,%s,'Aerobic durability') "
            "RETURNING id",
            (foreign, date(2026, 7, 6), date(2026, 7, 12)),
        ).fetchone()[0]
        own_session = _insert_session(admin, own_active, 1)
        _insert_session(admin, own_archived, 1)
        _insert_session(admin, foreign_active, 1)

    with _as_user(identities, owner) as authenticated:
        assert authenticated.execute(
            "SELECT plan.id, session.id "
            "FROM training_plans AS plan "
            "JOIN training_sessions AS session ON session.plan_id = plan.id "
            "WHERE plan.status = 'active'"
        ).fetchall() == [(own_active, own_session)]
        assert authenticated.execute(
            "SELECT id FROM training_sessions ORDER BY id"
        ).fetchall() == [(own_session,)]
        assert authenticated.execute(
            "SELECT count(*) FROM training_plans WHERE owner_id = %s", (foreign,)
        ).fetchone() == (0,)
        probes = [
            authenticated.execute(
                "SELECT count(*) FROM training_sessions WHERE plan_id = %s", (plan_id,)
            ).fetchone()
            for plan_id in (foreign_active, uuid4())
        ]
        assert probes == [(0,), (0,)]

    for operation in ("INSERT", "UPDATE", "DELETE"):
        with _as_user(identities, owner) as authenticated:
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                if operation == "INSERT":
                    _insert_session(authenticated, own_active, 2)
                elif operation == "UPDATE":
                    authenticated.execute(
                        "UPDATE training_sessions SET session_type='Compromised' "
                        "WHERE id=%s",
                        (own_session,),
                    )
                else:
                    authenticated.execute(
                        "DELETE FROM training_sessions WHERE id=%s", (own_session,)
                    )


def test_missing_claims_and_anon_have_no_training_access(
    identities: RlsFixture,
) -> None:
    owner = identities.first_user
    with psycopg.connect(identities.db_url, autocommit=True) as admin:
        plan_id = admin.execute(
            "SELECT id FROM training_plans "
            "WHERE owner_id=%s AND status='active'",
            (owner,),
        ).fetchone()[0]

    with _as_user(identities, owner) as no_claims:
        no_claims.execute("SELECT set_config('request.jwt.claims', '', true)")
        assert no_claims.execute("SELECT count(*) FROM training_plans").fetchone() == (
            0,
        )
        visible_sessions = no_claims.execute(
            "SELECT count(*) FROM training_sessions"
        ).fetchone()
        assert visible_sessions == (0,)

    for table in ("plan", "session"):
        with _as_user(identities, owner) as no_claims:
            no_claims.execute("SELECT set_config('request.jwt.claims', '', true)")
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                if table == "plan":
                    no_claims.execute(
                        "INSERT INTO training_plans(owner_id,status,plan_approach) "
                        "VALUES (%s,'draft','kaio_path')",
                        (owner,),
                    )
                else:
                    _insert_session(no_claims, plan_id, 2)

    statements = (
        ("SELECT count(*) FROM training_plans", None),
        ("SELECT count(*) FROM training_sessions", None),
        (
            "INSERT INTO training_plans(owner_id,status,plan_approach) "
            "VALUES (%s,'draft','kaio_path')",
            (owner,),
        ),
        ("UPDATE training_sessions SET session_type='Compromised'", None),
        ("DELETE FROM training_sessions", None),
    )
    with psycopg.connect(identities.db_url) as anon:
        for statement, params in statements:
            anon.execute("SET LOCAL ROLE anon")
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                anon.execute(statement, params)
            anon.rollback()


def test_backend_training_sessions_are_owner_isolated(
    identities: RlsFixture,
) -> None:
    owner, foreign = identities.first_user, identities.second_user
    with psycopg.connect(identities.db_url, autocommit=True) as admin:
        admin.execute(
            "DELETE FROM training_plans WHERE owner_id = ANY(%s::uuid[])",
            ([owner, foreign],),
        )
        plan_ids = {
            owner_id: admin.execute(
                "INSERT INTO training_plans "
                "(owner_id,status,plan_approach,start_date,end_date,block_focus) "
                "VALUES (%s,'active','kaio_path',%s,%s,'Aerobic durability') "
                "RETURNING id",
                (owner_id, date(2026, 7, 6), date(2026, 7, 12)),
            ).fetchone()[0]
            for owner_id in (owner, foreign)
        }
        own_session = _insert_session(admin, plan_ids[owner], 1)
        foreign_session = _insert_session(admin, plan_ids[foreign], 1)

    with _as_user(identities, owner) as backend:
        backend.execute("RESET ROLE")
        assert backend.execute(
            "SELECT id FROM training_sessions ORDER BY id"
        ).fetchall() == [(own_session,)]

        inserted_session = _insert_session(backend, plan_ids[owner], 2)
        with pytest.raises(
            (psycopg.errors.ForeignKeyViolation, psycopg.errors.InsufficientPrivilege)
        ):
            with backend.transaction():
                _insert_session(backend, plan_ids[foreign], 2)

        assert backend.execute(
            "UPDATE training_sessions SET session_type='Recovery run' WHERE id=%s",
            (inserted_session,),
        ).rowcount == 1
        assert backend.execute(
            "UPDATE training_sessions SET session_type='Compromised' WHERE id=%s",
            (foreign_session,),
        ).rowcount == 0

        with pytest.raises(
            (psycopg.errors.ForeignKeyViolation, psycopg.errors.InsufficientPrivilege)
        ):
            with backend.transaction():
                backend.execute(
                    "UPDATE training_sessions SET plan_id=%s WHERE id=%s",
                    (plan_ids[foreign], inserted_session),
                )

        assert backend.execute(
            "DELETE FROM training_sessions WHERE id=%s", (inserted_session,)
        ).rowcount == 1
        assert backend.execute(
            "DELETE FROM training_sessions WHERE id=%s", (foreign_session,)
        ).rowcount == 0

    with _as_user(identities, owner) as no_claims:
        no_claims.execute("RESET ROLE")
        no_claims.execute("SELECT set_config('request.jwt.claims', '', true)")
        visible_sessions = no_claims.execute(
            "SELECT count(*) FROM training_sessions"
        ).fetchone()
        assert visible_sessions == (0,)
        with pytest.raises(
            (psycopg.errors.ForeignKeyViolation, psycopg.errors.InsufficientPrivilege)
        ):
            _insert_session(no_claims, plan_ids[owner], 3)


def test_real_backend_only_writes_and_repository_contract(
    identities: RlsFixture,
) -> None:
    owner, foreign = identities.first_user, identities.second_user
    with psycopg.connect(identities.db_url, autocommit=True) as admin:
        admin.execute(
            "DELETE FROM training_plans WHERE owner_id = ANY(%s::uuid[])",
            ([owner, foreign],),
        )
        admin.execute(
            "INSERT INTO onboarding_snapshots (owner_id,snapshot) VALUES (%s,%s) "
            "ON CONFLICT (owner_id) DO UPDATE SET snapshot=EXCLUDED.snapshot",
            (owner, json.dumps(eligible_snapshot())),
        )
    with _as_user(identities, owner) as direct:
        for statement, target in (
            (
                "INSERT INTO training_plans(owner_id,status,plan_approach) "
                "VALUES (%s,'active','kaioken')",
                owner,
            ),
            (
                "INSERT INTO training_plans(owner_id,status,plan_approach) "
                "VALUES (%s,'draft','kaio_path')",
                foreign,
            ),
            (
                "UPDATE training_plans SET plan_approach='kaioken' "
                "WHERE owner_id=%s",
                owner,
            ),
            ("DELETE FROM training_plans WHERE owner_id=%s", owner),
        ):
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                direct.execute(statement, (target,))
            direct.rollback()
            _adopt_claims(direct, owner)
    with _role_admin(identities.db_url) as admin:
        _reset_safe_role(admin)
        admin.execute(
            SQL("ALTER ROLE {} LOGIN PASSWORD {}").format(
                Identifier(LOGIN_ROLE), Literal(identities.password)
            )
        )
    engine = create_engine(
        "postgresql+psycopg://",
        creator=lambda: psycopg.connect(
            make_conninfo(
                identities.db_url,
                user=LOGIN_ROLE,
                password=identities.password,
            )
        ),
    )
    try:
        factory = SqlAlchemyTrainingPlanTransactionFactory(engine, LOGIN_ROLE)
        user = UserContext(owner)
        first, same, changed = [
            save_training_plan_draft(
                user,
                SaveTrainingPlanDraftInput(approach),
                factory,
                date(2026, 7, 1),
            )
            for approach in ("mode_z", "mode_z", "kaio_path")
        ]
        assert first.plan_id == same.plan_id == changed.plan_id
        with psycopg.connect(identities.db_url, autocommit=True) as admin:
            with pytest.raises(psycopg.errors.UniqueViolation):
                admin.execute(
                    "INSERT INTO training_plans(owner_id,status,plan_approach) "
                    "VALUES (%s,'draft','kaio_path')",
                    (owner,),
                )
            admin.execute(
                "UPDATE training_plans SET status='active', start_date=%s, "
                "end_date=%s, block_focus='Aerobic durability' WHERE id=%s",
                (date(2026, 7, 6), date(2026, 7, 12), first.plan_id),
            )
            with pytest.raises(psycopg.errors.UniqueViolation):
                admin.execute(
                    "INSERT INTO training_plans"
                    "(owner_id,status,plan_approach,start_date,end_date,block_focus) "
                    "VALUES (%s,'active','kaio_path',%s,%s,'Aerobic durability')",
                    (owner, date(2026, 7, 6), date(2026, 7, 12)),
                )
        with pytest.raises(DraftPlanConflict):
            save_training_plan_draft(
                user,
                SaveTrainingPlanDraftInput("mode_z"),
                factory,
                date(2026, 7, 1),
            )
        with _as_user(identities, foreign) as isolated:
            assert isolated.execute(
                "SELECT count(*) FROM training_plans WHERE owner_id=%s",
                (owner,),
            ).fetchone() == (0,)
    finally:
        engine.dispose()
        with _role_admin(identities.db_url) as admin:
            _reset_safe_role(admin)
