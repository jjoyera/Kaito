"""
Shared pytest helpers for the Kaito API test suite.

Importable from test modules:

    from tests.conftest import clear_sentry_env, reload_main
"""

import importlib

import pytest

# ---------------------------------------------------------------------------
# Shared constants
# ---------------------------------------------------------------------------

_SENTRY_ENV_VARS: tuple[str, ...] = (
    "SENTRY_DSN",
    "SENTRY_ENVIRONMENT",
    "SENTRY_TRACES_SAMPLE_RATE",
    "SENTRY_PROFILES_SAMPLE_RATE",
)


# ---------------------------------------------------------------------------
# Helpers (callable with a monkeypatch instance)
# ---------------------------------------------------------------------------


def clear_sentry_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Remove all SENTRY_* env vars so each test starts from a clean slate."""
    for var in _SENTRY_ENV_VARS:
        monkeypatch.delenv(var, raising=False)


def reload_main():
    """Reload ``app.main`` and return the module (picks up current env state)."""
    import app.main as main_module  # noqa: PLC0415

    importlib.reload(main_module)
    return main_module
