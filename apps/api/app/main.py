import logging
import os

from fastapi import FastAPI

from app.observability.sentry import init_sentry

logger = logging.getLogger(__name__)

init_sentry()

app = FastAPI(title="Kaito API")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


if os.getenv("ENABLE_DEBUG_SENTRY", "").strip().lower() == "true":
    logger.warning("ENABLE_DEBUG_SENTRY is true; /debug-sentry is registered.")

    @app.get("/debug-sentry")
    def debug_sentry() -> None:
        """Verification-only endpoint: intentionally raises an unhandled exception.

        Registered **only** when the environment variable
        ``ENABLE_DEBUG_SENTRY=true`` is explicitly set before the application
        module is loaded.  When the flag is absent or set to any value other
        than ``true`` the route does not exist and requests return 404.

        DO NOT use this endpoint for any purpose other than Sentry verification.
        """
        raise ZeroDivisionError("Sentry debug trigger: 1 / 0")  # noqa: EM101
