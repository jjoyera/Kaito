import pytest
from sqlalchemy.dialects.postgresql import JSONB

from app.modules.runner_profile.domain import OnboardingSnapshot, OnboardingState


class FakeResult:
    def __init__(self, snapshot=None):
        self.snapshot = snapshot

    def scalar_one_or_none(self):
        return self.snapshot


class RecordingConnection:
    def __init__(self, snapshot=None):
        self.snapshot = snapshot
        self.calls = []
        self.commits = 0
        self.rollbacks = 0

    def execute(self, statement, parameters):
        self.calls.append((statement, parameters))
        return FakeResult(self.snapshot)

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


def _assert_bounded_equal(actual: object, expected: object, message: str) -> None:
    if actual != expected:
        pytest.fail(message, pytrace=False)


def _assert_bounded_absent(key: str, mapping: dict, message: str) -> None:
    if key in mapping:
        pytest.fail(message, pytrace=False)


def _snapshot():
    return OnboardingSnapshot(
        state=OnboardingState.INCOMPLETE,
        profile={
            "availability": {
                "minutes_by_day": {"monday": 45, "wednesday": 75, "saturday": 120}
            }
        },
        goal={},
    )


def test_upsert_is_atomic_owner_scoped_and_does_not_control_transactions():
    from app.modules.runner_profile.repository import SqlAlchemyOnboardingRepository

    connection = RecordingConnection()
    repository = SqlAlchemyOnboardingRepository(connection)

    repository.upsert("owner-1", _snapshot())

    ((statement, parameters),) = connection.calls
    statement_text = str(statement)
    assert "INSERT INTO onboarding_snapshots" in statement_text
    assert "ON CONFLICT (owner_id) DO UPDATE" in statement_text
    assert (
        "WHERE onboarding_snapshots.snapshot IS DISTINCT FROM EXCLUDED.snapshot"
        in statement_text
    )
    _assert_bounded_equal(parameters["owner_id"], "owner-1", "owner binding mismatch")
    assert parameters["snapshot"]["contract_version"] == "1"
    _assert_bounded_equal(
        parameters["snapshot"]["profile"]["availability"]["minutes_by_day"],
        {"monday": 45, "wednesday": 75, "saturday": 120},
        "availability round-trip mismatch",
    )
    assert connection.commits == connection.rollbacks == 0


def test_upsert_binds_only_the_exact_sparse_availability_jsonb_shape():
    from app.modules.runner_profile.repository import SqlAlchemyOnboardingRepository

    connection = RecordingConnection()
    repository = SqlAlchemyOnboardingRepository(connection)

    repository.upsert("owner-1", _snapshot())

    ((_, parameters),) = connection.calls
    availability = parameters["snapshot"]["profile"]["availability"]
    _assert_bounded_equal(
        availability,
        {"minutes_by_day": {"monday": 45, "wednesday": 75, "saturday": 120}},
        "availability round-trip mismatch",
    )
    _assert_bounded_absent(
        "training_years",
        parameters["snapshot"]["profile"],
        "noncanonical field emitted",
    )
    _assert_bounded_absent(
        "technicality", parameters["snapshot"]["goal"], "noncanonical field emitted"
    )


def test_upsert_binds_snapshot_as_postgresql_jsonb():
    from app.modules.runner_profile.repository import SqlAlchemyOnboardingRepository

    connection = RecordingConnection()
    repository = SqlAlchemyOnboardingRepository(connection)

    repository.upsert("owner-1", _snapshot())

    ((statement, _),) = connection.calls
    assert isinstance(statement._bindparams["snapshot"].type, JSONB)


def test_read_returns_snapshot_without_transaction_control():
    from app.modules.runner_profile.repository import SqlAlchemyOnboardingRepository

    connection = RecordingConnection(snapshot={"contract_version": "1"})
    repository = SqlAlchemyOnboardingRepository(connection)

    _assert_bounded_equal(
        repository.read("owner-1"),
        {"contract_version": "1"},
        "repository read mismatch",
    )

    ((statement, parameters),) = connection.calls
    assert "WHERE owner_id = :owner_id" in str(statement)
    _assert_bounded_equal(parameters, {"owner_id": "owner-1"}, "owner binding mismatch")
    assert connection.commits == connection.rollbacks == 0
