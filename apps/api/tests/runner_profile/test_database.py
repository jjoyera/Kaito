 # ruff: noqa
import traceback

import pytest

from app.modules.auth.context import UserContext


class FakeResult:
    def __init__(self, value): self.value = value
    def one(self): return self.value
    def scalar_one(self): return self.value
class FakeConnection:
    def __init__(self, guard=(True,) * 5, identity=True, reset=False, error=None):
        self.__dict__.update(guard=guard, identity=identity, reset=reset, error=error)
        self.calls, self.rolled_back, self.invalidated = [], 0, 0

    def execute(self, statement, params=None):
        self.calls.append((str(statement), params))
        if self.error and len(self.calls) == 2: raise self.error
        if len(self.calls) == 4: return FakeResult(self.identity)
        if "session_user" in str(statement):
            if isinstance(self.guard, Exception): raise self.guard
            return FakeResult(self.guard)
        return FakeResult(None)

    def rollback(self):
        self.rolled_back += 1
        if self.reset: raise RuntimeError()

    def invalidate(self): self.invalidated += 1
class FakeEngine:
    def __init__(self, connection): self.connection = connection
    def begin(self): return self
    def __enter__(self): return self.connection
    def __exit__(self, *_): return False
@pytest.mark.parametrize("failed_predicate", ["login", "current_user", "superuser", "bypassrls", "claims"])
def test_guard_rejects_each_unsafe_pre_role_predicate(failed_predicate):
    from app.core.database import DatabaseConfigurationError, guard_connection
    predicates = [True] * 5
    predicates[["login", "current_user", "superuser", "bypassrls", "claims"].index(failed_predicate)] = False
    connection = FakeConnection(guard=tuple(predicates))
    with pytest.raises(DatabaseConfigurationError): guard_connection(connection, "kaito_api_login")
    assert connection.rolled_back and connection.invalidated
    assert not any("SET LOCAL ROLE" in sql for sql, _ in connection.calls)
@pytest.mark.parametrize("guard", [None, RuntimeError("query failed")])
def test_guard_fails_closed_for_no_row_or_execution_error(guard):
    from app.core.database import DatabaseConfigurationError, guard_connection
    connection = FakeConnection(guard=guard)
    with pytest.raises(DatabaseConfigurationError, match="database_unavailable"):
        guard_connection(connection, "kaito_api_login")
    assert connection.rolled_back and connection.invalidated


def test_owner_transaction_sets_local_role_and_parameterized_claims():
    from app.core.database import configure_owner_transaction
    user, connection = UserContext("owner-id"), FakeConnection()
    configure_owner_transaction(connection, "kaito_api_login", user)
    sql = " ".join(call[0] for call in connection.calls)
    assert "SET LOCAL ROLE authenticated" in sql and "set_config('request.jwt.claims'" in sql
    assert user.user_id not in sql and "session_user = :expected" in sql


def test_owner_transaction_generic_failure_invalidates_and_redacts_traceback():
    from app.core import database
    connection = FakeConnection(reset=True, error=RuntimeError("RAW_SQL_MARKER"))
    with pytest.raises(database.DatabaseConfigurationError) as raised:
        with database.owner_connection(FakeEngine(connection), "kaito_api_login", UserContext("owner-id")): pass
    assert connection.rolled_back == connection.invalidated == 1
    assert "RAW_SQL_MARKER" not in "".join(traceback.format_exception(raised.value))
    assert raised.value.__cause__ is raised.value.__context__ is None


def test_dirty_pooled_connection_is_rejected_on_reuse():
    from app.core.database import DatabaseConfigurationError, owner_connection
    connection, owner = FakeConnection(), UserContext("owner-id")
    with owner_connection(FakeEngine(connection), "kaito_api_login", owner): pass
    connection.guard = (True, True, True, True, False)
    with pytest.raises(DatabaseConfigurationError):
        with owner_connection(FakeEngine(connection), "kaito_api_login", owner): pass
    assert connection.invalidated


def test_database_engine_uses_timeout_and_rollback_reset(monkeypatch):
    from app.core import database
    options = {}
    monkeypatch.setattr(database, "create_engine", lambda _, **kwargs: options.update(kwargs))
    database.create_engine_for_url("postgresql+psycopg://localhost/test")
    assert options == {"connect_args": {"connect_timeout": 5}, "pool_reset_on_return": "rollback"}


def test_owner_transaction_does_not_repeat_core_failure_side_effects(caplog):
    from app.core import database
    connection = FakeConnection(guard=(False,) + (True,) * 4)
    with caplog.at_level("ERROR", logger="app.core.database"):
        with pytest.raises(database.DatabaseConfigurationError) as raised:
            with database.owner_connection(FakeEngine(connection), "kaito_api_login", UserContext("owner-id")): pass
    assert connection.rolled_back == connection.invalidated == 1
    assert [record.message for record in caplog.records] == ["database_failure"]
    assert raised.value.__cause__ is raised.value.__context__ is None


def test_database_configuration_requires_literal_expected_role(monkeypatch):
    from app.core.config import get_database_settings
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://safe")
    monkeypatch.delenv("DATABASE_EXPECTED_ROLE", raising=False)
    with pytest.raises(ValueError, match="database_unavailable"): get_database_settings()
