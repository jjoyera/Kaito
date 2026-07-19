"""Real PostgreSQL proof for atomic generated-plan activation."""

from collections.abc import Generator
from dataclasses import replace
from datetime import date
from decimal import Decimal

import psycopg
import pytest
from psycopg.conninfo import make_conninfo
from psycopg.sql import SQL, Identifier, Literal
from sqlalchemy import Engine, create_engine

from app.modules.auth.context import UserContext
from app.modules.planning.repository import SqlAlchemyTrainingPlanTransactionFactory
from app.modules.planning.use_cases import (
    GeneratedPlanValues,
    GeneratedSessionValues,
    TrainingPlanPersistenceUnavailable,
    persist_and_activate_training_plan,
    read_active_training_plan,
)
from tests.integration.test_onboarding_rls import (
    LOGIN_ROLE,
    RlsFixture,
    _reset_safe_role,
    _role_admin,
)

pytest_plugins = ("tests.integration.test_onboarding_rls",)


@pytest.fixture
def persistence(
    identities: RlsFixture,
) -> Generator[tuple[Engine, SqlAlchemyTrainingPlanTransactionFactory], None, None]:
    with psycopg.connect(identities.db_url, autocommit=True) as admin:
        admin.execute(
            "DELETE FROM training_plans WHERE owner_id=%s", (identities.first_user,)
        )
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
                identities.db_url, user=LOGIN_ROLE, password=identities.password
            )
        ),
    )
    yield engine, SqlAlchemyTrainingPlanTransactionFactory(engine, LOGIN_ROLE)
    engine.dispose()
    with psycopg.connect(identities.db_url, autocommit=True) as admin:
        admin.execute(
            "DELETE FROM training_plans WHERE owner_id=%s", (identities.first_user,)
        )


def plan(focus: str = "Aerobic durability") -> GeneratedPlanValues:
    return GeneratedPlanValues(
        plan_approach="kaio_path",
        start_date=date(2026, 7, 6),
        end_date=date(2026, 7, 19),
        block_focus=focus,
    )


def session(week: int, order: int, day: int) -> GeneratedSessionValues:
    return GeneratedSessionValues(
        week_number=week,
        session_order=order,
        scheduled_date=date(2026, 7, day),
        session_type=f"Session {week}.{order}",
        session_category="run",
        planned_duration_minutes=30,
        planned_distance_kilometers=Decimal("5.50"),
        planned_elevation_meters=20,
        intensity_description="Easy",
        target_rpe_min=2,
        target_rpe_max=3,
        instructions="Keep it easy",
        purpose="Build consistency",
    )


def test_first_activation_replacement_and_stable_owner_read(
    persistence: tuple[Engine, SqlAlchemyTrainingPlanTransactionFactory],
    identities: RlsFixture,
) -> None:
    _, transactions = persistence
    user = UserContext(identities.first_user)
    first_id = persist_and_activate_training_plan(
        user, plan("First"), (session(1, 1, 6),), transactions
    )
    second_id = persist_and_activate_training_plan(
        user,
        plan("Second"),
        (session(2, 2, 14), session(1, 2, 7), session(1, 1, 6)),
        transactions,
    )

    active = read_active_training_plan(user, transactions)

    assert active is not None
    assert active.plan_id == second_id
    assert [week.week_number for week in active.weeks] == [1, 2]
    assert [item.session_order for item in active.weeks[0].sessions] == [1, 2]
    with psycopg.connect(identities.db_url, autocommit=True) as admin:
        assert admin.execute(
            "SELECT id::text,status FROM training_plans "
            "WHERE owner_id=%s ORDER BY status",
            (identities.first_user,),
        ).fetchall() == [(second_id, "active"), (first_id, "archived")]


def test_intermediate_session_failure_rolls_back_without_orphans(
    persistence: tuple[Engine, SqlAlchemyTrainingPlanTransactionFactory],
    identities: RlsFixture,
) -> None:
    _, transactions = persistence
    user = UserContext(identities.first_user)
    prior_id = persist_and_activate_training_plan(
        user, plan("Prior"), (session(1, 1, 6),), transactions
    )
    invalid = replace(session(1, 2, 7), session_type=" ")

    with pytest.raises(TrainingPlanPersistenceUnavailable):
        persist_and_activate_training_plan(
            user,
            plan("Rejected"),
            (session(1, 1, 6), invalid, session(1, 3, 8)),
            transactions,
        )

    with psycopg.connect(identities.db_url, autocommit=True) as admin:
        assert admin.execute(
            "SELECT id::text,status,block_focus FROM training_plans WHERE owner_id=%s",
            (identities.first_user,),
        ).fetchall() == [(prior_id, "active", "Prior")]
        assert admin.execute(
            "SELECT count(*) FROM training_sessions AS session "
            "LEFT JOIN training_plans AS plan ON plan.id=session.plan_id "
            "WHERE plan.id IS NULL"
        ).fetchone() == (0,)
        assert admin.execute(
            "SELECT count(*) FROM training_sessions WHERE plan_id=%s", (prior_id,)
        ).fetchone() == (1,)
