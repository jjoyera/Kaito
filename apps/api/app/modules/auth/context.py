"""
Canonical Kaito auth identity model.

This module is provider-agnostic: it MUST NOT reference Supabase types,
JWT internals, claim names, or any infrastructure-layer concepts.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class UserContext:
    """Verified identity available to protected routes and domain modules.

    Attributes:
        user_id: Required canonical user identifier derived from the token subject.
        email:   Optional email. May be absent; its absence does not fail auth.
    """

    user_id: str
    email: str | None = None
