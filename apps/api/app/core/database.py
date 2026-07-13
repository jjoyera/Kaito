import json
import logging
from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Connection, Engine

from app.modules.auth.context import UserContext


class DatabaseConfigurationError(Exception):
    """Raised without connection details when the database boundary is unsafe."""

    def __init__(self, code: str, *, reported: bool = False) -> None:
        super().__init__(code)
        self.reported = reported


_GUARD = text("""SELECT session_user = :expected, current_user = session_user,
NOT r.rolsuper, NOT r.rolbypassrls,
nullif(current_setting('request.jwt.claims', true), '') IS NULL
FROM pg_catalog.pg_roles r WHERE r.rolname = session_user""")


def create_engine_for_url(url: str) -> Engine:
    return create_engine(
        url, connect_args={"connect_timeout": 5}, pool_reset_on_return="rollback"
    )


def guard_connection(connection: Connection, expected_role: str) -> None:
    try:
        if all(connection.execute(_GUARD, {"expected": expected_role}).one()):
            return
    except Exception:
        pass
    _fail(connection)


def _invalidate(connection: Connection) -> None:
    logging.getLogger(__name__).error("database_failure")
    for action in (connection.rollback, connection.invalidate):
        try:
            action()
        except Exception:
            pass


def _fail(connection: Connection) -> None:
    _invalidate(connection)
    raise DatabaseConfigurationError("database_unavailable", reported=True)


def configure_owner_transaction(
    connection: Connection, expected_role: str, user: UserContext
) -> None:
    guard_connection(connection, expected_role)
    connection.execute(text("SET LOCAL ROLE authenticated"))
    claims = json.dumps({"sub": user.user_id, "role": "authenticated"})
    connection.execute(
        text("SELECT set_config('request.jwt.claims', :claims, true)"),
        {"claims": claims},
    )
    try:
        valid_identity = connection.execute(
            text("SELECT session_user = :expected AND current_user = 'authenticated' "
                 "AND auth.uid()::text = :owner"),
            {"expected": expected_role, "owner": user.user_id},
        ).scalar_one()
    except Exception:
        valid_identity = False
    if valid_identity is not True:
        _fail(connection)


@contextmanager
def owner_connection(
    engine: Engine, expected_role: str, user: UserContext
) -> Iterator[Connection]:
    failed = False
    with engine.begin() as connection:
        try:
            configure_owner_transaction(connection, expected_role, user)
        except DatabaseConfigurationError:
            raise
        except Exception:
            failed = True
            _invalidate(connection)
        if failed:
            raise DatabaseConfigurationError("database_unavailable")
        yield connection
