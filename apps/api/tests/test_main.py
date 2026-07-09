"""
Host-adapter integration tests for the FastAPI app in app/main.py.

These tests use TestClient (httpx backend) and must NOT use a real
Sentry DSN or make any Sentry network calls.
"""

import logging
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from tests.conftest import clear_sentry_env, reload_main

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
