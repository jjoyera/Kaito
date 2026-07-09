"""
Framework-agnostic Sentry bootstrap for the Kaito backend.

This module MUST NOT import FastAPI, Starlette, or any host-adapter code.
It reads environment variables at call time and decides whether to initialise
the Sentry SDK.  Any host (FastAPI, plain ASGI, CLI) may call `init_sentry()`
during its startup phase.
"""

import logging
import math
import os

import sentry_sdk

logger = logging.getLogger(__name__)


def _parse_sample_rate(var_name: str, raw: str | None, default: float = 0.0) -> float:
    """Parse a float environment-variable value with warning + fallback.

    Args:
        var_name: The environment variable name (used in warning messages).
        raw:      The raw string value from ``os.getenv``, or ``None``.
        default:  The fallback value when *raw* is absent or non-numeric.

    Returns:
        The parsed float, or *default* when parsing fails.
    """
    if raw is None or raw.strip() == "":
        return default
    try:
        value = float(raw)
    except (TypeError, ValueError):
        logger.warning(
            "Invalid %s=%r; falling back to %s",
            var_name,
            raw,
            default,
        )
        return default
    if not math.isfinite(value) or not (0.0 <= value <= 1.0):
        logger.warning(
            "%s=%r is out of range [0.0, 1.0] or non-finite; " "falling back to %s",
            var_name,
            value,
            default,
        )
        return default
    return value


def init_sentry() -> bool:
    """Initialise the Sentry SDK if a DSN is configured.

    Reads configuration from environment variables at call time:

    - ``SENTRY_DSN``                  — required; empty/unset means skip init.
    - ``SENTRY_ENVIRONMENT``          — defaults to ``"development"``.
    - ``SENTRY_TRACES_SAMPLE_RATE``   — float, defaults to ``0.0``.
    - ``SENTRY_PROFILES_SAMPLE_RATE`` — float, defaults to ``0.0``.

    Returns:
        ``True`` when the SDK was initialised, ``False`` when skipped.
    """
    dsn = (os.getenv("SENTRY_DSN") or "").strip()
    if not dsn:
        return False

    environment = os.getenv("SENTRY_ENVIRONMENT", "development")
    traces_sample_rate = _parse_sample_rate(
        "SENTRY_TRACES_SAMPLE_RATE",
        os.getenv("SENTRY_TRACES_SAMPLE_RATE"),
    )
    profiles_sample_rate = _parse_sample_rate(
        "SENTRY_PROFILES_SAMPLE_RATE",
        os.getenv("SENTRY_PROFILES_SAMPLE_RATE"),
    )

    try:
        sentry_sdk.init(
            dsn=dsn,
            environment=environment,
            traces_sample_rate=traces_sample_rate,
            profiles_sample_rate=profiles_sample_rate,
        )
    except Exception as exc:
        logger.error(
            "Sentry initialisation failed (check SENTRY_DSN): %s "
            "— continuing with Sentry disabled.",
            exc,
        )
        return False
    return True
