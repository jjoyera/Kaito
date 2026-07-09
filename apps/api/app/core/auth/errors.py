"""
Infrastructure-level auth configuration error.

AuthConfigError signals that the backend is not configured for authentication
(e.g., SUPABASE_JWKS_URL is absent). It is distinct from the domain-level
AuthError (invalid/missing token) and maps to 503 at the application layer.
"""


class AuthConfigError(Exception):
    """Raised when auth verification cannot be performed due to missing config.

    This is a server-side misconfiguration signal, not a client token failure.
    It is intentionally distinct from app.modules.auth.verifier.AuthError.
    """
