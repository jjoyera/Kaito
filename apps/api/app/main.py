import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.requests import Request
from fastapi.responses import JSONResponse

from app.core.auth.errors import AuthConfigError
from app.core.config import get_database_settings, get_web_settings
from app.core.database import (
    DatabaseConfigurationError,
    create_engine_for_url,
    guard_connection,
)
from app.modules.auth.router import router as auth_router
from app.modules.planning.router import router as planning_router
from app.modules.runner_profile.repository import SqlAlchemyOwnerTransactionFactory
from app.modules.runner_profile.router import router as runner_profile_router
from app.observability.sentry import init_sentry

logger = logging.getLogger(__name__)

init_sentry()

engine = None
database_settings = None


def _dispose_safely(candidate) -> None:
    try:
        candidate.dispose()
    except Exception:
        logger.error("database_disposal_failure")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global database_settings, engine
    failed = False
    reported_failure = None
    try:
        database_settings = get_database_settings()
        engine = create_engine_for_url(database_settings.url)
        with engine.connect() as connection:
            guard_connection(connection, database_settings.expected_role)
        app.state.onboarding_transactions = SqlAlchemyOwnerTransactionFactory(
            engine, database_settings.expected_role
        )
    except DatabaseConfigurationError as error:
        failed = True
        reported_failure = error
    except Exception:
        failed = True
    if failed:
        if engine:
            _dispose_safely(engine)
            engine = None
        if reported_failure is None or not reported_failure.reported:
            logger.error("database_failure")
        if reported_failure is not None:
            raise reported_failure
        raise DatabaseConfigurationError("database_unavailable")
    try:
        yield
    finally:
        if hasattr(app.state, "onboarding_transactions"):
            del app.state.onboarding_transactions
        if engine:
            _dispose_safely(engine)
        engine = database_settings = None


app = FastAPI(title="Kaito API", lifespan=lifespan)

web_settings = get_web_settings()
if web_settings.allowed_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(web_settings.allowed_origins),
        allow_methods=["GET", "PUT"],
        allow_headers=["authorization", "content-type"],
    )

app.include_router(auth_router)
app.include_router(runner_profile_router)
app.include_router(planning_router)


@app.exception_handler(AuthConfigError)
def _handle_auth_config_error(request: Request, exc: AuthConfigError) -> JSONResponse:
    """Map missing auth config to 503 — distinct from the 401 token-failure contract."""
    return JSONResponse(
        status_code=503,
        content={"detail": "Authentication is not configured"},
    )


@app.exception_handler(DatabaseConfigurationError)
def _handle_database_error(
    request: Request, exc: DatabaseConfigurationError
) -> JSONResponse:
    return JSONResponse(status_code=503, content={"detail": "Service unavailable"})


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
