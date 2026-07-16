from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from typing import Any

from sqlalchemy import bindparam, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.engine import Connection, Engine

from app.core.database import owner_connection
from app.modules.auth.context import UserContext
from app.modules.runner_profile.domain import OnboardingSnapshot
from app.modules.shared.domain.value_objects import UserId

JsonObject = Mapping[str, Any]

_READ_SNAPSHOT = text(
    "SELECT snapshot FROM onboarding_snapshots WHERE owner_id = :owner_id"
)
_UPSERT_SNAPSHOT = text("""
    INSERT INTO onboarding_snapshots (owner_id, snapshot)
    VALUES (:owner_id, :snapshot)
    ON CONFLICT (owner_id) DO UPDATE SET snapshot = EXCLUDED.snapshot
    WHERE onboarding_snapshots.snapshot IS DISTINCT FROM EXCLUDED.snapshot
""").bindparams(bindparam("snapshot", type_=JSONB()))


def _owner_value(owner_id: UserId | str) -> str:
    return owner_id.value if isinstance(owner_id, UserId) else owner_id


def _json_value(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {key: _json_value(item) for key, item in value.items()}
    if isinstance(value, tuple):
        return [_json_value(item) for item in value]
    return value


def _snapshot_json(snapshot: OnboardingSnapshot) -> dict[str, Any]:
    return {
        "contract_version": snapshot.contract_version,
        "state": snapshot.state.value,
        "profile": _json_value(snapshot.profile),
        "goal": _json_value(snapshot.goal),
    }


class SqlAlchemyOnboardingRepository:
    def __init__(self, connection: Connection) -> None:
        self._connection = connection

    def read(self, owner_id: UserId | str) -> JsonObject | None:
        return self._connection.execute(
            _READ_SNAPSHOT, {"owner_id": _owner_value(owner_id)}
        ).scalar_one_or_none()

    def upsert(self, owner_id: UserId | str, snapshot: OnboardingSnapshot) -> None:
        self._connection.execute(
            _UPSERT_SNAPSHOT,
            {"owner_id": _owner_value(owner_id), "snapshot": _snapshot_json(snapshot)},
        )


class SqlAlchemyOwnerTransactionFactory:
    def __init__(self, engine: Engine, expected_role: str) -> None:
        self._engine = engine
        self._expected_role = expected_role

    @contextmanager
    def __call__(self, user: UserContext) -> Iterator[SqlAlchemyOnboardingRepository]:
        with owner_connection(self._engine, self._expected_role, user) as connection:
            yield SqlAlchemyOnboardingRepository(connection)
