from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Connection, Engine

from app.core.database import owner_connection
from app.modules.auth.context import UserContext
from app.modules.planning.domain import Approach
from app.modules.planning.use_cases import DraftPlanConflict
from app.modules.shared.domain.value_objects import UserId

_READ_ONBOARDING = text(
    "SELECT snapshot FROM onboarding_snapshots WHERE owner_id = :owner_id"
)
_BACKEND_ROLE = text("RESET ROLE")
_LOCK_OWNER = text("SELECT pg_advisory_xact_lock(hashtextextended(:owner_id, 0))")
_READ_PLAN = text("""
    SELECT id AS plan_id, status, plan_approach
    FROM training_plans
    WHERE owner_id = :owner_id AND status IN ('draft', 'active')
    ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END
    FOR UPDATE
""")
_INSERT_DRAFT = text("""
    INSERT INTO training_plans (owner_id, status, plan_approach)
    VALUES (:owner_id, 'draft', :plan_approach)
    RETURNING id AS plan_id, status, plan_approach
""")
_UPDATE_DRAFT = text("""
    UPDATE training_plans
    SET plan_approach = :plan_approach
    WHERE id = :plan_id AND status = 'draft'
    RETURNING id AS plan_id, status, plan_approach
""")


class SqlAlchemyTrainingPlanRepository:
    def __init__(self, connection: Connection) -> None:
        self._connection = connection

    def read_onboarding(self, owner_id: UserId) -> Mapping[str, Any] | None:
        return self._connection.execute(
            _READ_ONBOARDING, {"owner_id": owner_id.value}
        ).scalar_one_or_none()

    def save_draft(self, owner_id: UserId, approach: Approach) -> Mapping[str, Any]:
        values = {"owner_id": owner_id.value, "plan_approach": approach}
        self._connection.execute(_BACKEND_ROLE)
        self._connection.execute(_LOCK_OWNER, {"owner_id": owner_id.value})
        existing = self._connection.execute(
            _READ_PLAN, {"owner_id": owner_id.value}
        ).mappings().first()
        if existing and existing["status"] == "active":
            raise DraftPlanConflict()
        if existing:
            if existing["plan_approach"] == approach:
                return existing
            saved = self._connection.execute(
                _UPDATE_DRAFT,
                {"plan_id": existing["plan_id"], "plan_approach": approach},
            ).mappings().one_or_none()
            if saved is None:
                raise DraftPlanConflict()
            return saved
        return self._connection.execute(_INSERT_DRAFT, values).mappings().one()


class SqlAlchemyTrainingPlanTransactionFactory:
    def __init__(self, engine: Engine, expected_role: str) -> None:
        self._engine = engine
        self._expected_role = expected_role

    @contextmanager
    def __call__(self, user: UserContext) -> Iterator[SqlAlchemyTrainingPlanRepository]:
        with owner_connection(self._engine, self._expected_role, user) as connection:
            yield SqlAlchemyTrainingPlanRepository(connection)
