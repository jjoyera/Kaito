from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Connection, Engine

from app.core.database import owner_connection
from app.modules.auth.context import UserContext
from app.modules.planning.domain import Approach
from app.modules.planning.use_cases import (
    DraftPlanConflict,
    GeneratedPlanValues,
    GeneratedSessionValues,
)
from app.modules.shared.domain.value_objects import UserId

_READ_ONBOARDING = text(
    "SELECT snapshot FROM onboarding_snapshots WHERE owner_id = :owner_id"
)
_READ_ONBOARDING_FOR_DRAFT = text(
    "SELECT snapshot FROM onboarding_snapshots WHERE owner_id = :owner_id FOR UPDATE"
)
_READ_GENERATION_SOURCE = text("""
    SELECT tp.plan_approach, os.snapshot
    FROM training_plans AS tp
    JOIN onboarding_snapshots AS os ON os.owner_id = tp.owner_id
    WHERE tp.owner_id = :owner_id AND tp.status = 'draft'
""")
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
_INSERT_CANDIDATE = text("""
    INSERT INTO training_plans
      (owner_id, status, plan_approach, start_date, end_date, block_focus)
    VALUES
      (:owner_id, 'archived', :plan_approach, :start_date, :end_date, :block_focus)
    RETURNING id
""")
_INSERT_SESSION = text("""
    INSERT INTO training_sessions
      (plan_id, week_number, scheduled_date, session_type, session_category,
       planned_duration_minutes, planned_distance_kilometers,
       planned_elevation_meters, intensity_description, target_rpe_min,
       target_rpe_max, instructions, purpose, session_order)
    VALUES
      (:plan_id, :week_number, :scheduled_date, :session_type, :session_category,
       :planned_duration_minutes, :planned_distance_kilometers,
       :planned_elevation_meters, :intensity_description, :target_rpe_min,
       :target_rpe_max, :instructions, :purpose, :session_order)
""")
_ARCHIVE_ACTIVE = text("""
    UPDATE training_plans SET status = 'archived'
    WHERE owner_id = :owner_id AND status = 'active'
""")
_ACTIVATE_CANDIDATE = text("""
    UPDATE training_plans SET status = 'active'
    WHERE id = :plan_id AND status = 'archived'
""")
_READ_ACTIVE_PLAN = text("""
    SELECT tp.id AS plan_id, tp.plan_approach, tp.start_date, tp.end_date,
           tp.block_focus, ts.week_number, ts.session_order, ts.scheduled_date,
           ts.session_type, ts.session_category, ts.planned_duration_minutes,
           ts.planned_distance_kilometers, ts.planned_elevation_meters,
           ts.intensity_description, ts.target_rpe_min, ts.target_rpe_max,
           ts.instructions, ts.purpose
    FROM training_plans AS tp
    JOIN training_sessions AS ts ON ts.plan_id = tp.id
    WHERE tp.owner_id = :owner_id AND tp.status = 'active'
    ORDER BY ts.week_number, ts.session_order
""")


class SqlAlchemyTrainingPlanRepository:
    def __init__(self, connection: Connection) -> None:
        self._connection = connection

    def read_onboarding(
        self, owner_id: UserId, *, lock_for_draft: bool = False
    ) -> Mapping[str, Any] | None:
        values = {"owner_id": owner_id.value}
        if lock_for_draft:
            self._connection.execute(_LOCK_OWNER, values)
        return self._connection.execute(
            _READ_ONBOARDING_FOR_DRAFT if lock_for_draft else _READ_ONBOARDING,
            values,
        ).scalar_one_or_none()

    def read_generation_source(self, owner_id: UserId) -> Mapping[str, Any] | None:
        return self._connection.execute(
            _READ_GENERATION_SOURCE, {"owner_id": owner_id.value}
        ).mappings().one_or_none()

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

    def insert_candidate(self, owner_id: UserId, plan: GeneratedPlanValues) -> str:
        self._connection.execute(_BACKEND_ROLE)
        self._connection.execute(_LOCK_OWNER, {"owner_id": owner_id.value})
        values = {
            "owner_id": owner_id.value,
            **{
                field: getattr(plan, field)
                for field in GeneratedPlanValues.__dataclass_fields__
            },
        }
        return str(self._connection.execute(_INSERT_CANDIDATE, values).scalar_one())

    def insert_session(self, plan_id: str, session: GeneratedSessionValues) -> None:
        values = {
            "plan_id": plan_id,
            **{
                field: getattr(session, field)
                for field in GeneratedSessionValues.__dataclass_fields__
            },
        }
        self._connection.execute(_INSERT_SESSION, values)

    def archive_active(self, owner_id: UserId) -> None:
        self._connection.execute(_ARCHIVE_ACTIVE, {"owner_id": owner_id.value})

    def activate_candidate(self, plan_id: str) -> None:
        result = self._connection.execute(_ACTIVATE_CANDIDATE, {"plan_id": plan_id})
        if result.rowcount != 1:
            raise RuntimeError("candidate_plan_not_found")

    def read_active_plan(self, owner_id: UserId) -> list[Mapping[str, Any]]:
        self._connection.execute(_BACKEND_ROLE)
        return list(
            self._connection.execute(
                _READ_ACTIVE_PLAN, {"owner_id": owner_id.value}
            ).mappings()
        )


class SqlAlchemyTrainingPlanTransactionFactory:
    def __init__(self, engine: Engine, expected_role: str) -> None:
        self._engine = engine
        self._expected_role = expected_role

    @contextmanager
    def __call__(self, user: UserContext) -> Iterator[SqlAlchemyTrainingPlanRepository]:
        with owner_connection(self._engine, self._expected_role, user) as connection:
            yield SqlAlchemyTrainingPlanRepository(connection)
