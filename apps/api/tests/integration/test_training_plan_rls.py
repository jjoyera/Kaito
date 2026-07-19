"""Real local-Supabase proof for training-plan repository and RLS contracts."""

import json
from datetime import date

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
