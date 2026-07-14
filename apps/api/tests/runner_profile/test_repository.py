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
        self.calls.append((str(statement), parameters))
        return FakeResult(self.snapshot)

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


def _snapshot():
    return OnboardingSnapshot(
        state=OnboardingState.INCOMPLETE,
        profile={"prior_history": {"training_years": 1.5}},
        goal={},
    )


def test_upsert_is_atomic_owner_scoped_and_does_not_control_transactions():
    from app.modules.runner_profile.repository import SqlAlchemyOnboardingRepository

    connection = RecordingConnection()
    repository = SqlAlchemyOnboardingRepository(connection)

    repository.upsert("owner-1", _snapshot())

    statement, parameters = connection.calls[0]
    assert "INSERT INTO onboarding_snapshots" in statement
    assert "ON CONFLICT (owner_id) DO UPDATE" in statement
    assert (
        "WHERE onboarding_snapshots.snapshot IS DISTINCT FROM EXCLUDED.snapshot"
        in statement
    )
    assert parameters["owner_id"] == "owner-1"
    assert parameters["snapshot"]["contract_version"] == "1"
    assert connection.commits == connection.rollbacks == 0


def test_read_returns_snapshot_without_transaction_control():
    from app.modules.runner_profile.repository import SqlAlchemyOnboardingRepository

    connection = RecordingConnection(snapshot={"contract_version": "1"})
    repository = SqlAlchemyOnboardingRepository(connection)

    assert repository.read("owner-1") == {"contract_version": "1"}

    statement, parameters = connection.calls[0]
    assert "WHERE owner_id = :owner_id" in statement
    assert parameters == {"owner_id": "owner-1"}
    assert connection.commits == connection.rollbacks == 0
