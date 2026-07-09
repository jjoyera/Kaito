import logging
import os

from fastapi import FastAPI
from fastapi.requests import Request
from fastapi.responses import JSONResponse

from app.core.auth.errors import AuthConfigError
from app.modules.auth.router import router as auth_router
from app.observability.sentry import init_sentry

logger = logging.getLogger(__name__)

init_sentry()

app = FastAPI(title="Kaito API")

app.include_router(auth_router)


@app.exception_handler(AuthConfigError)
def _handle_auth_config_error(request: Request, exc: AuthConfigError) -> JSONResponse:
    """Map missing auth config to 503 — distinct from the 401 token-failure contract."""
    return JSONResponse(
        status_code=503,
        content={"detail": "Authentication is not configured"},
    )


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
