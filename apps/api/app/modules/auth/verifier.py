"""
Provider-agnostic auth verification boundary.

This module defines the AuthVerifier protocol and the domain-neutral AuthError.
It MUST NOT reference Supabase types, JWT internals, claim names, or any
infrastructure-layer concepts. Domain-facing code depends only on this boundary.
"""

from typing import Protocol

from .context import UserContext


class AuthError(Exception):
    """Raised when a token cannot be verified into a UserContext.

    Provider-neutral: carries no provider internals, secret material, or
    failure-specific detail that could reach a client response.
    """


class AuthVerifier(Protocol):
    """Protocol boundary for token verification.

    Implementors map a raw bearer token string to a canonical UserContext on
    success, or raise AuthError on any verification failure.
    """

    def verify(self, token: str) -> UserContext: ...
