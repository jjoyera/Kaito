"""
Unit tests for the framework-agnostic Sentry bootstrap module.

These tests MUST NOT use a real Sentry DSN or make network calls.
The bootstrap module MUST NOT import FastAPI or Starlette.
"""

import ast
import importlib.util
import logging
import math
import pathlib
from unittest.mock import patch

import pytest

from tests.conftest import clear_sentry_env


def _assert_float_close(actual: float, expected: float) -> None:
    """Assert float equivalence without direct equality checks."""
    assert math.isclose(actual, expected, rel_tol=0.0, abs_tol=1e-12)


# ---------------------------------------------------------------------------
# Framework boundary test — AST / source-level inspection
# ---------------------------------------------------------------------------


def test_bootstrap_has_no_fastapi_or_starlette_imports() -> None:
    """The observability.sentry module must not import FastAPI or Starlette.

    Uses AST-level source inspection so that *any* import form —
    ``import fastapi``, ``from fastapi import FastAPI``,
    ``import starlette.routing`` — is detected deterministically.
    """
    spec = importlib.util.find_spec("app.observability.sentry")
    assert (
        spec is not None and spec.origin is not None
    ), "Module app.observability.sentry must be importable"

    source = pathlib.Path(spec.origin).read_text(encoding="utf-8")
    tree = ast.parse(source, filename=spec.origin)

    forbidden = {"fastapi", "starlette"}

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                root = alias.name.split(".")[0].lower()
                assert (
                    root not in forbidden
                ), f"bootstrap must not contain 'import {alias.name}'"
        elif isinstance(node, ast.ImportFrom):
            module = (node.module or "").split(".")[0].lower()
            assert (
                module not in forbidden
            ), f"bootstrap must not contain 'from {node.module} import ...'"


# ---------------------------------------------------------------------------
# DSN gating
# ---------------------------------------------------------------------------


def test_init_sentry_returns_false_when_dsn_unset(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When SENTRY_DSN is unset, init_sentry() must return False."""
    clear_sentry_env(monkeypatch)
    from app.observability.sentry import init_sentry  # noqa: PLC0415

    assert not init_sentry()


def test_init_sentry_returns_false_when_dsn_empty(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When SENTRY_DSN is an empty string, init_sentry() must return False."""
    clear_sentry_env(monkeypatch)
    monkeypatch.setenv("SENTRY_DSN", "")
    from app.observability.sentry import init_sentry  # noqa: PLC0415

    assert not init_sentry()


def test_init_sentry_returns_false_when_dsn_whitespace(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When SENTRY_DSN is whitespace only, init_sentry() must return False."""
    clear_sentry_env(monkeypatch)
    monkeypatch.setenv("SENTRY_DSN", "   ")
    from app.observability.sentry import init_sentry  # noqa: PLC0415

    assert not init_sentry()


# ---------------------------------------------------------------------------
# Malformed (non-empty) DSN — graceful degradation (regression guard)
# ---------------------------------------------------------------------------


def test_init_sentry_returns_false_for_malformed_dsn(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A malformed non-empty SENTRY_DSN must not crash the app.

    ``init_sentry()`` must return False and the application must remain
    importable.  No real network call is made: the Sentry SDK rejects an
    unparsable DSN string synchronously before any transport is created.
    """
    clear_sentry_env(monkeypatch)
    monkeypatch.setenv("SENTRY_DSN", "not-a-valid-dsn-at-all")
    from app.observability.sentry import init_sentry  # noqa: PLC0415

    # Must not raise; must return False (SDK raises BadDsn/ValueError which
    # init_sentry() catches and logs as an error).
    assert not init_sentry()


def test_init_sentry_logs_error_for_malformed_dsn(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """A malformed DSN must emit an ERROR-level log identifying the failure."""
    clear_sentry_env(monkeypatch)
    monkeypatch.setenv("SENTRY_DSN", "malformed://not-sentry")

    with caplog.at_level(logging.ERROR, logger="app.observability.sentry"):
        from app.observability.sentry import init_sentry  # noqa: PLC0415

        init_sentry()

    assert any(
        record.levelno >= logging.ERROR for record in caplog.records
    ), "Expected at least one ERROR record when Sentry init fails"


def test_init_sentry_returns_false_when_sdk_init_raises(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Even if sentry_sdk.init raises for any reason, init_sentry must not propagate.

    This deterministic mock-based test covers any exception from the SDK
    (e.g. BadDsn, network-related, or unexpected errors).
    """
    clear_sentry_env(monkeypatch)
    monkeypatch.setenv("SENTRY_DSN", "https://fake@o0.ingest.sentry.io/0")

    with caplog.at_level(logging.ERROR, logger="app.observability.sentry"):
        with patch(
            "sentry_sdk.init", side_effect=ValueError("Got an invalid DSN: fake")
        ):
            from app.observability.sentry import init_sentry  # noqa: PLC0415

            result = init_sentry()

    assert not result
    assert any(record.levelno >= logging.ERROR for record in caplog.records)


# ---------------------------------------------------------------------------
# Sample-rate defaults
# ---------------------------------------------------------------------------


def test_parse_sample_rate_returns_default_when_unset() -> None:
    """_parse_sample_rate must return the default when the raw value is None."""
    from app.observability.sentry import _parse_sample_rate  # noqa: PLC0415

    _assert_float_close(_parse_sample_rate("SENTRY_TRACES_SAMPLE_RATE", None), 0.0)
    _assert_float_close(_parse_sample_rate("SENTRY_PROFILES_SAMPLE_RATE", None), 0.0)


def test_parse_sample_rate_returns_default_for_empty_string() -> None:
    """_parse_sample_rate must return the default when the raw value is empty."""
    from app.observability.sentry import _parse_sample_rate  # noqa: PLC0415

    _assert_float_close(_parse_sample_rate("SENTRY_TRACES_SAMPLE_RATE", ""), 0.0)


def test_parse_sample_rate_parses_valid_float() -> None:
    """_parse_sample_rate must parse a valid float string correctly."""
    from app.observability.sentry import _parse_sample_rate  # noqa: PLC0415

    _assert_float_close(_parse_sample_rate("SENTRY_TRACES_SAMPLE_RATE", "0.5"), 0.5)
    _assert_float_close(_parse_sample_rate("SENTRY_TRACES_SAMPLE_RATE", "1.0"), 1.0)
    _assert_float_close(_parse_sample_rate("SENTRY_TRACES_SAMPLE_RATE", "0"), 0.0)


# ---------------------------------------------------------------------------
# Invalid numeric warning + fallback
# ---------------------------------------------------------------------------


def test_parse_sample_rate_warns_and_falls_back_on_invalid(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """_parse_sample_rate must log a WARNING and return 0.0 for non-numeric input."""
    from app.observability.sentry import _parse_sample_rate  # noqa: PLC0415

    with caplog.at_level(logging.WARNING, logger="app.observability.sentry"):
        result = _parse_sample_rate("SENTRY_TRACES_SAMPLE_RATE", "invalid")

    _assert_float_close(result, 0.0)
    warned = any(
        "SENTRY_TRACES_SAMPLE_RATE" in record.message for record in caplog.records
    )
    assert warned, "Expected a warning mentioning SENTRY_TRACES_SAMPLE_RATE"


def test_parse_sample_rate_warns_on_non_numeric_profiles(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Same invalid-input behaviour must apply to profiles sample rate."""
    from app.observability.sentry import _parse_sample_rate  # noqa: PLC0415

    with caplog.at_level(logging.WARNING, logger="app.observability.sentry"):
        result = _parse_sample_rate("SENTRY_PROFILES_SAMPLE_RATE", "notanumber")

    _assert_float_close(result, 0.0)
    warned = any(
        "SENTRY_PROFILES_SAMPLE_RATE" in record.message for record in caplog.records
    )
    assert warned


# ---------------------------------------------------------------------------
# Sample-rate range / finiteness validation
# ---------------------------------------------------------------------------


def test_parse_sample_rate_warns_and_falls_back_for_out_of_range(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Values outside [0.0, 1.0] must log a WARNING and fall back to 0.0."""
    from app.observability.sentry import _parse_sample_rate  # noqa: PLC0415

    with caplog.at_level(logging.WARNING, logger="app.observability.sentry"):
        result_high = _parse_sample_rate("SENTRY_TRACES_SAMPLE_RATE", "1.5")
        result_neg = _parse_sample_rate("SENTRY_TRACES_SAMPLE_RATE", "-0.1")

    _assert_float_close(result_high, 0.0)
    _assert_float_close(result_neg, 0.0)
    assert len(caplog.records) >= 2, "Expected at least 2 warning records"


def test_parse_sample_rate_warns_and_falls_back_for_non_finite(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Non-finite values (inf, nan) must log a WARNING and fall back to 0.0."""
    from app.observability.sentry import _parse_sample_rate  # noqa: PLC0415

    with caplog.at_level(logging.WARNING, logger="app.observability.sentry"):
        result_inf = _parse_sample_rate("SENTRY_TRACES_SAMPLE_RATE", "inf")
        result_nan = _parse_sample_rate("SENTRY_TRACES_SAMPLE_RATE", "nan")

    _assert_float_close(result_inf, 0.0)
    _assert_float_close(result_nan, 0.0)
    assert (
        len(caplog.records) >= 2
    ), "Expected at least 2 warning records for non-finite"


# ---------------------------------------------------------------------------
# DSN-present path — deterministic (sentry_sdk.init mocked, no real network)
# ---------------------------------------------------------------------------


_FAKE_DSN = "https://abc123@o000000.ingest.sentry.io/000000"


def test_init_sentry_returns_true_and_calls_sdk_init_when_dsn_present(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Non-empty SENTRY_DSN must call sentry_sdk.init with all expected kwargs.

    sentry_sdk.init is patched to prevent any real network transport.
    """
    clear_sentry_env(monkeypatch)
    monkeypatch.setenv("SENTRY_DSN", _FAKE_DSN)
    monkeypatch.setenv("SENTRY_ENVIRONMENT", "production")
    monkeypatch.setenv("SENTRY_TRACES_SAMPLE_RATE", "0.5")
    monkeypatch.setenv("SENTRY_PROFILES_SAMPLE_RATE", "0.25")

    with patch("sentry_sdk.init") as mock_init:
        from app.observability.sentry import init_sentry  # noqa: PLC0415

        result = init_sentry()

    assert result
    mock_init.assert_called_once_with(
        dsn=_FAKE_DSN,
        environment="production",
        traces_sample_rate=0.5,
        profiles_sample_rate=0.25,
    )


def test_init_sentry_uses_defaults_when_optional_vars_absent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When only SENTRY_DSN is set, defaults (development, 0.0, 0.0) must be used."""
    clear_sentry_env(monkeypatch)
    monkeypatch.setenv("SENTRY_DSN", _FAKE_DSN)

    with patch("sentry_sdk.init") as mock_init:
        from app.observability.sentry import init_sentry  # noqa: PLC0415

        result = init_sentry()

    assert result
    _args, kwargs = mock_init.call_args
    assert kwargs["dsn"] == _FAKE_DSN
    assert kwargs["environment"] == "development"
    _assert_float_close(kwargs["traces_sample_rate"], 0.0)
    _assert_float_close(kwargs["profiles_sample_rate"], 0.0)
