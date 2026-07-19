"""PostgreSQL contract tests for canonical training plans and sessions."""

from collections.abc import Generator
from datetime import date
from decimal import Decimal
from pathlib import Path

import psycopg
import pytest

from tests.integration.test_onboarding_rls import RlsFixture

pytest_plugins = ("tests.integration.test_onboarding_rls",)

_MIGRATION = (
    Path(__file__).parents[4]
    / "supabase/migrations/20260719134500_training_plan_schema.sql"
)


@pytest.fixture(scope="module", autouse=True)
def canonical_schema(identities: RlsFixture) -> Generator[None, None, None]:
    with psycopg.connect(identities.db_url, autocommit=True) as connection:
        connection.execute(_MIGRATION.read_text())
        connection.execute(
            "DELETE FROM training_plans WHERE owner_id = ANY(%s::uuid[])",
            ([identities.first_user, identities.second_user],),
        )
    yield
    with psycopg.connect(identities.db_url, autocommit=True) as connection:
        connection.execute(
            "DELETE FROM training_plans WHERE owner_id = ANY(%s::uuid[])",
            ([identities.first_user, identities.second_user],),
        )


@pytest.fixture
def database(identities: RlsFixture) -> Generator[psycopg.Connection, None, None]:
    with psycopg.connect(identities.db_url) as connection:
        yield connection
        connection.rollback()


def insert_plan(
    connection: psycopg.Connection,
    owner_id: str,
    *,
    start: date | None = date(2026, 7, 6),
    end: date | None = date(2026, 7, 12),
    status: str = "active",
) -> str:
    return connection.execute(
        """
        INSERT INTO training_plans
          (owner_id, status, plan_approach, start_date, end_date, block_focus)
        VALUES (%s, %s, 'mode_z', %s, %s, 'Aerobic durability')
        RETURNING id::text
        """,
        (owner_id, status, start, end),
    ).fetchone()[0]


def insert_session(
    connection: psycopg.Connection,
    plan_id: str,
    *,
    week: int = 1,
    scheduled: date = date(2026, 7, 6),
    category: str = "run",
    duration: int = 45,
    distance: str = "8.25",
    elevation: int = 80,
    rpe_min: int = 3,
    rpe_max: int = 5,
    order: int = 1,
) -> str:
    return connection.execute(
        """
        INSERT INTO training_sessions
          (plan_id, week_number, scheduled_date, session_type,
           session_category, planned_duration_minutes,
           planned_distance_kilometers, planned_elevation_meters,
           intensity_description, target_rpe_min, target_rpe_max,
           instructions, purpose, session_order)
        VALUES
          (%s, %s, %s, 'Easy run', %s, %s, %s, %s,
           'Conversational effort', %s, %s, 'Keep the pace easy',
           'Build aerobic durability', %s)
        RETURNING id::text
        """,
        (
            plan_id,
            week,
            scheduled,
            category,
            duration,
            distance,
            elevation,
            rpe_min,
            rpe_max,
            order,
        ),
    ).fetchone()[0]


@pytest.mark.parametrize(
    ("end", "week", "scheduled"),
    [
        (date(2026, 7, 12), 1, date(2026, 7, 12)),
        (date(2026, 8, 2), 4, date(2026, 8, 2)),
    ],
)
def test_accepts_one_and_four_week_boundaries(
    database: psycopg.Connection,
    identities: RlsFixture,
    end: date,
    week: int,
    scheduled: date,
) -> None:
    plan_id = insert_plan(database, identities.first_user, end=end)
    session_id = insert_session(
        database, plan_id, week=week, scheduled=scheduled, distance="12.34"
    )

    assert database.execute(
        "SELECT planned_distance_kilometers FROM training_sessions WHERE id=%s",
        (session_id,),
    ).fetchone() == (Decimal("12.34"),)


def test_legacy_draft_remains_compatible(
    database: psycopg.Connection, identities: RlsFixture
) -> None:
    row = database.execute(
        "INSERT INTO training_plans(owner_id,status,plan_approach) "
        "VALUES (%s,'draft','kaio_path') RETURNING start_date,end_date,block_focus",
        (identities.first_user,),
    ).fetchone()

    assert row == (None, None, None)


@pytest.mark.parametrize(
    ("start", "end"),
    [
        (date(2026, 7, 6), date(2026, 8, 3)),
        (date(2026, 7, 6), date(2026, 7, 5)),
        (date(2026, 7, 6), None),
    ],
)
def test_rejects_invalid_or_incomplete_completed_plan_dates(
    database: psycopg.Connection,
    identities: RlsFixture,
    start: date,
    end: date | None,
) -> None:
    with pytest.raises(psycopg.errors.CheckViolation):
        insert_plan(database, identities.first_user, start=start, end=end)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("week_number", 0),
        ("week_number", 5),
        ("planned_duration_minutes", 0),
        ("planned_distance_kilometers", "-0.01"),
        ("planned_elevation_meters", -1),
        ("session_category", "cycling"),
        ("target_rpe_min", 0),
        ("target_rpe_max", 11),
        ("session_order", 0),
        ("session_type", "  "),
    ],
)
def test_rejects_invalid_session_values(
    database: psycopg.Connection,
    identities: RlsFixture,
    field: str,
    value: object,
) -> None:
    plan_id = insert_plan(database, identities.first_user)
    values = {
        "week_number": 1,
        "planned_duration_minutes": 45,
        "planned_distance_kilometers": "8.25",
        "planned_elevation_meters": 80,
        "session_category": "run",
        "target_rpe_min": 3,
        "target_rpe_max": 5,
        "session_order": 1,
        "session_type": "Easy run",
    }
    values[field] = value

    with pytest.raises(psycopg.errors.CheckViolation):
        database.execute(
            """
            INSERT INTO training_sessions
              (plan_id,week_number,scheduled_date,session_type,session_category,
               planned_duration_minutes,planned_distance_kilometers,
               planned_elevation_meters,intensity_description,target_rpe_min,
               target_rpe_max,instructions,purpose,session_order)
            VALUES (%s,%s,'2026-07-06',%s,%s,%s,%s,%s,'Easy',%s,%s,'Do it','Why',%s)
            """,
            (
                plan_id,
                values["week_number"],
                values["session_type"],
                values["session_category"],
                values["planned_duration_minutes"],
                values["planned_distance_kilometers"],
                values["planned_elevation_meters"],
                values["target_rpe_min"],
                values["target_rpe_max"],
                values["session_order"],
            ),
        )


def test_rejects_reversed_rpe_and_duplicate_order(
    database: psycopg.Connection, identities: RlsFixture
) -> None:
    plan_id = insert_plan(database, identities.first_user)
    with pytest.raises(psycopg.errors.CheckViolation):
        insert_session(database, plan_id, rpe_min=7, rpe_max=6)
    database.rollback()
    plan_id = insert_plan(database, identities.first_user)
    insert_session(database, plan_id)
    with pytest.raises(psycopg.errors.UniqueViolation):
        insert_session(database, plan_id)


@pytest.mark.parametrize(
    ("week", "scheduled"),
    [(1, date(2026, 7, 5)), (1, date(2026, 7, 13)), (2, date(2026, 7, 12))],
)
def test_rejects_dates_outside_plan_or_incoherent_week(
    database: psycopg.Connection,
    identities: RlsFixture,
    week: int,
    scheduled: date,
) -> None:
    plan_id = insert_plan(database, identities.first_user)
    with pytest.raises(psycopg.errors.CheckViolation):
        insert_session(database, plan_id, week=week, scheduled=scheduled)


def test_rejects_missing_parent_and_preserves_children_on_invalid_plan_update(
    database: psycopg.Connection, identities: RlsFixture
) -> None:
    with pytest.raises(psycopg.errors.ForeignKeyViolation):
        insert_session(database, "00000000-0000-0000-0000-000000000000")
    database.rollback()
    plan_id = insert_plan(database, identities.first_user)
    insert_session(database, plan_id, scheduled=date(2026, 7, 12))
    with pytest.raises(psycopg.errors.CheckViolation):
        database.execute(
            "UPDATE training_plans SET end_date='2026-07-10' WHERE id=%s",
            (plan_id,),
        )


def test_plan_delete_cascades_sessions_and_only_one_active_remains_enforced(
    database: psycopg.Connection, identities: RlsFixture
) -> None:
    plan_id = insert_plan(database, identities.first_user)
    insert_session(database, plan_id)
    with pytest.raises(psycopg.errors.UniqueViolation):
        insert_plan(database, identities.first_user)
    database.rollback()
    plan_id = insert_plan(database, identities.first_user)
    insert_session(database, plan_id)
    database.execute("DELETE FROM training_plans WHERE id=%s", (plan_id,))

    assert database.execute(
        "SELECT count(*) FROM training_sessions WHERE plan_id=%s", (plan_id,)
    ).fetchone() == (0,)
