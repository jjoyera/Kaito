"""
Host-adapter integration tests for the FastAPI app in app/main.py.

These tests use TestClient (httpx backend) and must NOT use a real
Sentry DSN or make any Sentry network calls.
"""
# ruff: noqa

import logging
import traceback
from contextlib import nullcontext
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from tests.conftest import clear_sentry_env, reload_main


class _StartupEngine:
    def __init__(self, dispose_error=None): self.connected = self.disposed = False; self.dispose_error = dispose_error
    def connect(self): self.connected = True; return nullcontext()
    def dispose(self):
        self.disposed = True
        if self.dispose_error: raise self.dispose_error


def _database_lifespan(monkeypatch, *, dispose_error=None, guard_error=None, url="safe"):
    from app.core import database
    monkeypatch.setenv("DATABASE_URL", f"postgresql+psycopg://{url}")
    monkeypatch.setenv("DATABASE_EXPECTED_ROLE", "kaito_api_login")
    engine = _StartupEngine(dispose_error)
    monkeypatch.setattr(database, "create_engine_for_url", lambda _: engine)
    guard = lambda *_: (_ for _ in ()).throw(guard_error) if guard_error else None
    monkeypatch.setattr(database, "guard_connection", guard)
    return database, engine

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def client_no_sentry(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """Return a TestClient with all SENTRY_* vars cleared and debug route disabled."""
    clear_sentry_env(monkeypatch)
    monkeypatch.delenv("ENABLE_DEBUG_SENTRY", raising=False)
    return TestClient(reload_main().app)


@pytest.fixture()
def client_debug_sentry_enabled(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """Return a TestClient with ENABLE_DEBUG_SENTRY=true (debug route registered).

    SENTRY_DSN is left unset so init_sentry() returns False — no real network.
    """
    clear_sentry_env(monkeypatch)
    monkeypatch.delenv("ENABLE_DEBUG_SENTRY", raising=False)
    monkeypatch.setenv("ENABLE_DEBUG_SENTRY", "true")
    return TestClient(reload_main().app)


# ---------------------------------------------------------------------------
# /health
# ---------------------------------------------------------------------------


def test_health_returns_200_ok(client_no_sentry: TestClient) -> None:
    """/health must return 200 with {'status': 'ok'} when no DSN is set."""
    response = client_no_sentry.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_returns_ok_without_sentry_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Health must respond correctly even when all Sentry vars are absent."""
    clear_sentry_env(monkeypatch)
    monkeypatch.delenv("ENABLE_DEBUG_SENTRY", raising=False)
    client = TestClient(reload_main().app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_lifespan_eagerly_guards_and_disposes_database(monkeypatch: pytest.MonkeyPatch) -> None:
    clear_sentry_env(monkeypatch)
    database, engine = _database_lifespan(monkeypatch)
    guarded = []
    monkeypatch.setattr(database, "guard_connection", lambda *_: guarded.append(True))
    with TestClient(reload_main().app) as client: assert client.get("/health").status_code == 200
    assert engine.connected and engine.disposed and guarded == [True]


def test_database_failures_are_generic_and_logs_redact_connection_secrets(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    database, _ = _database_lifespan(monkeypatch, guard_error=RuntimeError("RAW_SQL_MARKER"), url="user:secret@db/private")
    with caplog.at_level(logging.ERROR, logger="app.main"):
        with pytest.raises(database.DatabaseConfigurationError) as raised:
            with TestClient(reload_main().app): pass
    assert "RAW_SQL_MARKER" not in "".join(traceback.format_exception(raised.value))
    assert raised.value.__cause__ is raised.value.__context__ is None
    assert any(record.message == "database_failure" for record in caplog.records)
    assert all("secret" not in record.message and "postgresql" not in record.message for record in caplog.records)
    response = reload_main()._handle_database_error(None, database.DatabaseConfigurationError("secret"))
    assert response.status_code == 503
    assert response.body == b'{"detail":"Service unavailable"}'


def test_lifespan_does_not_repeat_core_guard_failure_log(monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture) -> None:
    from app.core import database

    _, engine = _database_lifespan(monkeypatch)
    connection = type("Connection", (), {"rollback": lambda _: None, "invalidate": lambda _: None})()
    engine.connect = lambda: nullcontext(connection)
    monkeypatch.setattr(database, "guard_connection", lambda connection, _: database._fail(connection))
    with caplog.at_level(logging.ERROR):
        with pytest.raises(database.DatabaseConfigurationError):
            with TestClient(reload_main().app): pass
    assert [record.message for record in caplog.records] == ["database_failure"]


@pytest.mark.parametrize("failure", ["settings", "engine", "connect"])
def test_lifespan_logs_pre_core_failures(monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture, failure: str) -> None:
    from app.core import database

    _, engine = _database_lifespan(monkeypatch)
    main = reload_main()
    error = RuntimeError("RAW_SQL_MARKER")
    if failure == "settings":
        monkeypatch.setattr(main, "get_database_settings", lambda: (_ for _ in ()).throw(error))
    elif failure == "engine":
        monkeypatch.setattr(main, "create_engine_for_url", lambda _: (_ for _ in ()).throw(error))
    else:
        engine.connect = lambda: (_ for _ in ()).throw(error)
    with caplog.at_level(logging.ERROR, logger="app.main"):
        with pytest.raises(database.DatabaseConfigurationError) as raised:
            with TestClient(main.app): pass
    assert [record.message for record in caplog.records] == ["database_failure"]
    assert raised.value.__cause__ is raised.value.__context__ is None


@pytest.mark.parametrize("guard_error", [RuntimeError("root"), None])
def test_disposal_failure_is_safely_logged(monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture, guard_error: Exception | None) -> None:
    _, engine = _database_lifespan(monkeypatch, dispose_error=RuntimeError("secret"), guard_error=guard_error)
    with caplog.at_level(logging.ERROR, logger="app.main"):
        if guard_error:
            with pytest.raises(Exception, match="database_unavailable"):
                with TestClient(reload_main().app): pass
        else:
            with TestClient(reload_main().app) as client: assert client.get("/health").status_code == 200
    assert engine.disposed
    assert any(record.message == "database_disposal_failure" for record in caplog.records)
    assert all("secret" not in record.message for record in caplog.records)


# ---------------------------------------------------------------------------
# /debug-sentry — gate behaviour (ENABLE_DEBUG_SENTRY flag)
# ---------------------------------------------------------------------------


def test_debug_sentry_returns_404_when_flag_not_set(
    client_no_sentry: TestClient,
) -> None:
    """/debug-sentry must return 404 when ENABLE_DEBUG_SENTRY is not set."""
    response = client_no_sentry.get("/debug-sentry")
    assert response.status_code == 404


def test_debug_sentry_returns_404_when_flag_is_false(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """/debug-sentry must return 404 when ENABLE_DEBUG_SENTRY=false."""
    clear_sentry_env(monkeypatch)
    monkeypatch.setenv("ENABLE_DEBUG_SENTRY", "false")
    client = TestClient(reload_main().app)
    response = client.get("/debug-sentry")
    assert response.status_code == 404


def test_debug_sentry_returns_500_when_flag_true(
    client_debug_sentry_enabled: TestClient,
) -> None:
    """/debug-sentry must raise and return 500 when ENABLE_DEBUG_SENTRY=true."""
    client = TestClient(client_debug_sentry_enabled.app, raise_server_exceptions=False)
    response = client.get("/debug-sentry")
    assert response.status_code == 500


def test_debug_sentry_raises_zerodivision_when_flag_true(
    client_debug_sentry_enabled: TestClient,
) -> None:
    """/debug-sentry must propagate ZeroDivisionError when ENABLE_DEBUG_SENTRY=true."""
    client = TestClient(client_debug_sentry_enabled.app, raise_server_exceptions=True)
    with pytest.raises(ZeroDivisionError):
        client.get("/debug-sentry")


# ---------------------------------------------------------------------------
# /health with DSN present — SDK mocked (no real network)
# ---------------------------------------------------------------------------


_FAKE_DSN = "https://abc123@o000000.ingest.sentry.io/000000"


def test_health_with_dsn_present_and_sdk_mocked(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """/health must return 200 even when SENTRY_DSN is set (SDK init mocked).

    init_sentry() must have been invoked and returned True on app reload.
    """
    clear_sentry_env(monkeypatch)
    monkeypatch.setenv("SENTRY_DSN", _FAKE_DSN)
    monkeypatch.setenv("SENTRY_ENVIRONMENT", "testing")
    monkeypatch.delenv("ENABLE_DEBUG_SENTRY", raising=False)

    with patch("sentry_sdk.init") as mock_init:
        client = TestClient(reload_main().app)
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    mock_init.assert_called_once()
    _args, kwargs = mock_init.call_args
    assert kwargs["dsn"] == _FAKE_DSN
    assert kwargs["environment"] == "testing"


# ---------------------------------------------------------------------------
# Malformed DSN startup resilience
# ---------------------------------------------------------------------------


def test_app_starts_and_health_ok_with_malformed_dsn(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """App must start and /health must respond even when SENTRY_DSN is malformed.

    init_sentry() logs an error and continues with Sentry disabled rather
    than crashing the application.
    """
    clear_sentry_env(monkeypatch)
    monkeypatch.setenv("SENTRY_DSN", "totally-invalid-dsn-value")
    monkeypatch.delenv("ENABLE_DEBUG_SENTRY", raising=False)

    with caplog.at_level(logging.ERROR, logger="app.observability.sentry"):
        client = TestClient(reload_main().app)
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert any(
        record.levelno >= logging.ERROR for record in caplog.records
    ), "Expected an ERROR log from init_sentry when DSN is malformed"


# ---------------------------------------------------------------------------
# App import smoke
# ---------------------------------------------------------------------------


def test_app_imports_successfully_without_sentry_env(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The FastAPI app must import cleanly with no SENTRY_* vars set."""
    clear_sentry_env(monkeypatch)
    monkeypatch.delenv("ENABLE_DEBUG_SENTRY", raising=False)
    mod = reload_main()
    assert mod.app.title == "Kaito API"


def test_app_composes_the_protected_onboarding_router(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The production app exposes the protected onboarding API route."""
    clear_sentry_env(monkeypatch)
    monkeypatch.delenv("ENABLE_DEBUG_SENTRY", raising=False)

    paths = {route.path for route in reload_main().app.routes}

    assert "/runner-profile/onboarding" in paths


# ---------------------------------------------------------------------------
# CORS — browser access from the configured web origin only
# ---------------------------------------------------------------------------


def test_no_cors_headers_when_web_origin_is_not_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Fail closed: with KAITO_WEB_ORIGIN unset, no origin is allowed."""
    clear_sentry_env(monkeypatch)
    monkeypatch.delenv("ENABLE_DEBUG_SENTRY", raising=False)
    monkeypatch.delenv("KAITO_WEB_ORIGIN", raising=False)

    client = TestClient(reload_main().app)
    response = client.get("/health", headers={"origin": "http://localhost:3000"})

    assert "access-control-allow-origin" not in response.headers


def test_cors_allows_the_configured_web_origin(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A request from the configured web origin receives the CORS header."""
    clear_sentry_env(monkeypatch)
    monkeypatch.delenv("ENABLE_DEBUG_SENTRY", raising=False)
    monkeypatch.setenv("KAITO_WEB_ORIGIN", "http://localhost:3000")

    client = TestClient(reload_main().app)
    response = client.get("/health", headers={"origin": "http://localhost:3000"})

    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_cors_rejects_an_origin_outside_the_configured_allowlist(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A request from an unlisted origin does not receive the CORS header."""
    clear_sentry_env(monkeypatch)
    monkeypatch.delenv("ENABLE_DEBUG_SENTRY", raising=False)
    monkeypatch.setenv("KAITO_WEB_ORIGIN", "http://localhost:3000")

    client = TestClient(reload_main().app)
    response = client.get(
        "/health", headers={"origin": "https://attacker.example"}
    )

    assert "access-control-allow-origin" not in response.headers


def test_cors_supports_a_comma_separated_origin_allowlist(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """KAITO_WEB_ORIGIN accepts multiple comma-separated origins."""
    clear_sentry_env(monkeypatch)
    monkeypatch.delenv("ENABLE_DEBUG_SENTRY", raising=False)
    monkeypatch.setenv(
        "KAITO_WEB_ORIGIN", "http://localhost:3000, https://app.kaito.example"
    )

    client = TestClient(reload_main().app)
    response = client.get(
        "/health", headers={"origin": "https://app.kaito.example"}
    )

    assert response.headers["access-control-allow-origin"] == "https://app.kaito.example"
