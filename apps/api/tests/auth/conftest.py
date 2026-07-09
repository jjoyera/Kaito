"""Shared auth-test fixtures."""

from collections.abc import Generator

import pytest


@pytest.fixture(autouse=True)
def reset_auth_verifier_cache_between_tests() -> Generator[None, None, None]:
    """Keep process-scoped verifier cache from coupling independent auth tests."""
    from app.core.auth.provider import reset_auth_verifier_cache

    reset_auth_verifier_cache()
    yield
    reset_auth_verifier_cache()
