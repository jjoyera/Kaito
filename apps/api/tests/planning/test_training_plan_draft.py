# ruff: noqa: E501, F401, F811, I001
import json
import os
from contextlib import contextmanager
from datetime import date
from uuid import UUID

import psycopg
import pytest
from psycopg.conninfo import make_conninfo
from psycopg.sql import Identifier, Literal, SQL
from sqlalchemy import create_engine

from app.modules.auth.context import UserContext
from app.modules.planning.domain import ApproachEligibilityPolicy
from app.modules.planning.repository import SqlAlchemyTrainingPlanTransactionFactory
from app.modules.planning.use_cases import (
    BlockedTrainingApproach,
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
    identities,
)
from tests.planning.test_approach_eligibility import eligible_snapshot


class Repository:
    def __init__(self, snapshot=None, draft=None):
        self.snapshot = snapshot or eligible_snapshot()
        self.draft = draft
        self.owner_reads: list[str] = []
        self.save_calls = 0

    def read_onboarding(self, owner_id):
        self.owner_reads.append(owner_id.value)
        return self.snapshot

    def save_draft(self, owner_id, approach):
        self.save_calls += 1
        if self.draft and self.draft["status"] != "draft":
            raise DraftPlanConflict()
        if self.draft is None:
            self.draft = {
                "plan_id": "9dd180d0-058d-4ee5-b8cf-3e93867a4041",
                "status": "draft",
                "plan_approach": approach,
            }
        elif self.draft["plan_approach"] != approach:
            self.draft["plan_approach"] = approach
        return self.draft


class Transactions:
    def __init__(self, repository):
        self.repository = repository

    @contextmanager
    def __call__(self, user):
        assert user.user_id == "verified-runner"
        yield self.repository


def save(repository, approach="mode_z"):
    return save_training_plan_draft(
        UserContext("verified-runner"),
        SaveTrainingPlanDraftInput(approach),
        Transactions(repository),
        date(2026, 7, 1),
        ApproachEligibilityPolicy(),
    )


def test_creates_reuses_and_updates_one_owner_bound_draft():
    repository = Repository()

    first = save(repository)
    repeated = save(repository)
    updated = save(repository, "kaio_path")

    assert UUID(first.plan_id)
    assert repeated.plan_id == first.plan_id == updated.plan_id
    assert repeated.plan_approach == "mode_z"
    assert updated.plan_approach == "kaio_path"
    assert repository.owner_reads == ["verified-runner"] * 3


def test_backend_rechecks_current_eligibility_and_rejects_blocked_selection():
    snapshot = eligible_snapshot()
    snapshot["profile"]["physical_status"]["status"] = "recovering"
    repository = Repository(snapshot=snapshot)

    with pytest.raises(BlockedTrainingApproach, match="blocked_approach"):
        save(repository, "mode_z")

    assert repository.save_calls == 0


def test_non_draft_plan_conflicts_without_mutation():
    repository = Repository(
        draft={
            "plan_id": "9dd180d0-058d-4ee5-b8cf-3e93867a4041",
            "status": "active",
            "plan_approach": "kaio_path",
        }
    )

    with pytest.raises(DraftPlanConflict, match="draft_plan_conflict"):
        save(repository)

    assert repository.draft["plan_approach"] == "kaio_path"


@pytest.mark.skipif(
    os.getenv("KAITO_LOCAL_RLS_TEST") != "1", reason="requires reset local Supabase"
)
def test_real_backend_only_writes_and_repository_contract(
    identities: RlsFixture,
) -> None:
    owner, foreign = identities.first_user, identities.second_user
    with psycopg.connect(identities.db_url, autocommit=True) as admin:
        admin.execute("DELETE FROM training_plans WHERE owner_id = ANY(%s::uuid[])", ([owner, foreign],))
        admin.execute(
            "INSERT INTO onboarding_snapshots (owner_id,snapshot) VALUES (%s,%s) "
            "ON CONFLICT (owner_id) DO UPDATE SET snapshot=EXCLUDED.snapshot",
            (owner, json.dumps(eligible_snapshot())),
        )
    with _as_user(identities, owner) as direct:
        for statement, target in (
            ("INSERT INTO training_plans(owner_id,status,plan_approach) VALUES (%s,'active','kaioken')", owner),
            ("INSERT INTO training_plans(owner_id,status,plan_approach) VALUES (%s,'draft','kaio_path')", foreign),
            ("UPDATE training_plans SET plan_approach='kaioken' WHERE owner_id=%s", owner),
            ("DELETE FROM training_plans WHERE owner_id=%s", owner),
        ):
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                direct.execute(statement, (target,))
            direct.rollback()
            _adopt_claims(direct, owner)
    with _role_admin(identities.db_url) as admin:
        _reset_safe_role(admin)
        admin.execute(SQL("ALTER ROLE {} LOGIN PASSWORD {}").format(Identifier(LOGIN_ROLE), Literal(identities.password)))
    engine = create_engine("postgresql+psycopg://", creator=lambda: psycopg.connect(make_conninfo(identities.db_url, user=LOGIN_ROLE, password=identities.password)))
    try:
        factory, user = SqlAlchemyTrainingPlanTransactionFactory(engine, LOGIN_ROLE), UserContext(owner)
        first, same, changed = [save_training_plan_draft(user, SaveTrainingPlanDraftInput(approach), factory, date(2026, 7, 1)) for approach in ("mode_z", "mode_z", "kaio_path")]
        assert first.plan_id == same.plan_id == changed.plan_id
        with psycopg.connect(identities.db_url, autocommit=True) as admin:
            with pytest.raises(psycopg.errors.UniqueViolation):
                admin.execute("INSERT INTO training_plans(owner_id,status,plan_approach) VALUES (%s,'draft','kaio_path')", (owner,))
            admin.execute("UPDATE training_plans SET status='active' WHERE id=%s", (first.plan_id,))
            with pytest.raises(psycopg.errors.UniqueViolation):
                admin.execute("INSERT INTO training_plans(owner_id,status,plan_approach) VALUES (%s,'active','kaio_path')", (owner,))
        with pytest.raises(DraftPlanConflict):
            save_training_plan_draft(user, SaveTrainingPlanDraftInput("mode_z"), factory, date(2026, 7, 1))
        with _as_user(identities, foreign) as isolated:
            assert isolated.execute("SELECT count(*) FROM training_plans WHERE owner_id=%s", (owner,)).fetchone() == (0,)
    finally:
        engine.dispose()
        with _role_admin(identities.db_url) as admin:
            _reset_safe_role(admin)
