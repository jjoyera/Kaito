# Design — Setup Supabase Auth Backend

## 1. Overview

This design turns the approved `backend-auth` spec into a concrete, minimal
implementation plan for `apps/api`. It introduces a provider-agnostic backend
authentication boundary, a canonical Kaito-owned `UserContext`, a Supabase JWKS
verification adapter isolated from domain code, a reusable FastAPI dependency,
and a protected `GET /auth/me` smoke endpoint.

> **JWKS correction (supersedes the original HS256 plan).** The user confirmed
> JWKS-only: Supabase's legacy JWT secret is no longer recommended, and current
> projects use asymmetric JWT Signing Keys exposed through the explicit
> `SUPABASE_JWKS_URL` provided by Supabase onboarding. This design now specifies
> asymmetric JWKS verification and removes `SUPABASE_JWT_SECRET`/HS256 entirely.
> `SUPABASE_URL` is optional/informational and is not used to derive JWKS.
> Sections below describe the target JWKS design; the correction work unit in
> `tasks.md` covers replacing the already-applied HS256 implementation.

Design principles, straight from the spec:

- Domain-facing code depends only on Kaito auth concepts (`UserContext` and an
  `AuthVerifier`-style boundary), never on Supabase claim names, JWT internals,
  or SDK types.
- Supabase is the first adapter, not the contract. The Supabase JWKS
  asymmetric-key verification strategy must be swappable for a future
  provider/strategy without touching the boundary, `UserContext`, the
  dependency, or the route handler.
- The slice stays narrow: identity verification + `/auth/me` proof. No signup,
  login, RBAC, persistence, or API-wide error framework.

The implementation follows existing backend conventions established by
`app/observability/sentry.py`: framework-agnostic modules, configuration read
from environment variables **at call time** (not import time), no new settings
framework, and graceful degradation when configuration is absent.

## 2. Module / file layout

The proposal names two homes: `apps/api/app/core/` (config, verification wiring,
adapter) and `apps/api/app/modules/auth/` (router, response schema, canonical
user-context and boundary). The split is chosen so the **provider-agnostic
domain surface lives in `modules/auth`** and **all Supabase/JWT specifics live
in `core`**. This physical separation is what the provider-isolation test
enforces.

### Domain-facing (provider-agnostic) — `apps/api/app/modules/auth/`

| File | Responsibility | May reference Supabase/JWT? |
| --- | --- | --- |
| `__init__.py` | Package marker | No |
| `context.py` | Canonical `UserContext` model: required `user_id: str`, optional `email: str \| None = None`. Frozen/immutable. No provider fields. | **No** |
| `verifier.py` | `AuthVerifier` boundary (typing `Protocol`) with `verify(token: str) -> UserContext`; plus the domain-neutral `AuthError` exception. | **No** |
| `dependencies.py` | `get_current_user(...) -> UserContext` FastAPI dependency, bearer extraction, `401` mapping. It may import only the provider-neutral composition seam `app.core.auth.provider.get_auth_verifier`; it must not import concrete adapters, Supabase claim names, or JWT libraries. | **No Supabase/JWT; only the composition seam import is allowed** |
| `schemas.py` | `MeResponse` Pydantic response model (`user_id`, `email`). | **No** |
| `router.py` | `APIRouter` exposing `GET /auth/me`. | **No** |

### Infrastructure / adapter (Supabase-aware) — `apps/api/app/core/`

| File | Responsibility | May reference Supabase/JWT? |
| --- | --- | --- |
| `config.py` | `AuthSettings` dataclass + `get_auth_settings()` reading explicit `SUPABASE_JWKS_URL` and optional supporting vars (`SUPABASE_URL`, audience/issuer/JWKS cache TTL) from env at call time. | Yes (env var names) |
| `auth/__init__.py` | Package marker | Yes |
| `auth/errors.py` | `AuthConfigError` (infra misconfiguration, distinct from domain `AuthError`). | Yes |
| `auth/supabase.py` | `SupabaseJwtVerifier` implementing `AuthVerifier`: fetches the project JWKS, selects the signing key by `kid`, verifies the asymmetric signature + expiry (+ audience when configured), maps `sub` -> `user_id`, `email` -> `email`. The only place that knows Supabase claim names, the JWKS endpoint, and JWT details. | **Yes (only here)** |
| `auth/provider.py` | `get_auth_verifier() -> AuthVerifier` factory/dependency: reads settings, raises `AuthConfigError` when unconfigured (no `SUPABASE_JWKS_URL`), otherwise returns the cached/wired concrete adapter. Single wiring point for future strategy selection. | Yes |

### Application wiring — `apps/api/app/main.py`

- `app.include_router(auth_router)` to register `/auth/me`.
- Register an exception handler for `AuthConfigError` -> `503` (see §5).

### Tests — `apps/api/tests/auth/`

`test_supabase_verifier.py`, `test_dependency.py`, `test_auth_me.py`,
`test_missing_config.py`, `test_provider_isolation.py` (details in §9).

## 3. Dependency wiring & route registration

### Boundary (`modules/auth/verifier.py`)

```python
from typing import Protocol
from app.modules.auth.context import UserContext

class AuthError(Exception):
    """Raised when a token cannot be verified into a UserContext.

    Provider-neutral: carries no provider internals, secret material, or
    failure-specific detail that could reach a client response.
    """

class AuthVerifier(Protocol):
    def verify(self, token: str) -> UserContext: ...
```

### Dependency (`modules/auth/dependencies.py`)

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.auth.provider import get_auth_verifier
from app.modules.auth.context import UserContext
from app.modules.auth.verifier import AuthError, AuthVerifier

_bearer = HTTPBearer(auto_error=False)
_UNAUTHENTICATED = "Not authenticated"

def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    verifier: AuthVerifier = Depends(get_auth_verifier),
) -> UserContext:
    if (
        credentials is None
        or credentials.scheme.lower() != "bearer"
        or not credentials.credentials
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, _UNAUTHENTICATED)
    try:
        return verifier.verify(credentials.credentials)
    except AuthError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, _UNAUTHENTICATED)
```

Notes:

- `HTTPBearer(auto_error=False)` lets us produce the **exact** `401` body
  ourselves instead of FastAPI's default `403`/varying messages; this is what
  guarantees the consistent `{ "detail": "Not authenticated" }` contract.
- The dependency depends on `AuthVerifier` (the abstraction) and never imports
  `SupabaseJwtVerifier`, JWT libraries, or provider claim names. Its only allowed
  infrastructure import is the provider-neutral composition seam
  `get_auth_verifier`; the concrete adapter is resolved only inside that seam.
- `get_auth_verifier` raising `AuthConfigError` propagates out of dependency
  resolution and is mapped by the app-level exception handler (§5). It is
  intentionally not caught here, so the missing-config case stays distinct from
  token failures.

### Router (`modules/auth/router.py`)

```python
from fastapi import APIRouter, Depends
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.context import UserContext
from app.modules.auth.schemas import MeResponse

router = APIRouter(prefix="/auth", tags=["auth"])

@router.get("/me", response_model=MeResponse)
def read_current_user(user: UserContext = Depends(get_current_user)) -> MeResponse:
    return MeResponse(user_id=user.user_id, email=user.email)
```

`get_current_user` is the reusable, documented default pattern: any future
protected domain router uses `Depends(get_current_user)` to receive a
`UserContext`, with no verification logic of its own.

## 4. Response contracts

### Success — `200 OK`

Identity only, exactly two fields:

```json
{ "user_id": "b1c2...", "email": "runner@example.com" }
```

When the token carries no email claim:

```json
{ "user_id": "b1c2...", "email": null }
```

`MeResponse` is a closed Pydantic model with only `user_id: str` and
`email: str | None`; no provider fields, raw claims, roles, or domain state can
appear. A test asserts the response key set is exactly `{"user_id", "email"}`.

### Unauthorized — `401 Unauthorized`

Exact body across every token failure (missing header, malformed scheme,
bad signature, expired, malformed JWT, missing `sub`):

```json
{ "detail": "Not authenticated" }
```

A standard `WWW-Authenticate: Bearer` response header MAY be present; the spec
constrains the JSON body only, and the header does not add body fields or leak
internals. No failure-specific reason strings are ever emitted.

## 5. Missing auth-config behavior

Requirement: the app must import and boot with no `SUPABASE_JWKS_URL`, public
endpoints keep working, and protected routes fail clearly without crashing.

Design:

- `get_auth_settings()` and `get_auth_verifier()` read env **at call time**, so
  module import never fails when config is absent. `app.main` importing and
  `app.include_router` do not touch auth config.
- `get_auth_verifier()` raises `AuthConfigError("Authentication is not configured")`
  when `SUPABASE_JWKS_URL` is empty/unset, and logs a generic operational error
  without token, secret, or provider URL material.
- An app-level exception handler maps `AuthConfigError` to:

```python
from fastapi.responses import JSONResponse
from app.core.auth.errors import AuthConfigError

@app.exception_handler(AuthConfigError)
def _handle_auth_config_error(request, exc):
    return JSONResponse(
        status_code=503,
        content={"detail": "Authentication is not configured"},
    )
```

### Decision: 503 for missing config, not 401 (resolved ambiguity)

The spec mandates the exact `{ "detail": "Not authenticated" }` body only for
**unauthorized token failures** (Requirement: *Minimal consistent 401 response
contract*), and requires the missing-config case to "fail clearly and
consistently ... without crashing" without prescribing a status code. Missing
config here means `SUPABASE_JWKS_URL` is absent.

We resolve this by returning **`503 Service Unavailable`** with
`{ "detail": "Authentication is not configured" }` for the missing-config case,
distinct from the client-facing `401`. Rationale:

- Missing `SUPABASE_JWKS_URL` is a **server misconfiguration**, not a client
  presenting bad/absent credentials. Conflating it with `401` would mislead
  clients into thinking their token was rejected.
- Keeps the `401` contract semantically pure and its body invariant intact.
- `503` is clear, stable, crashes nothing, and leaks no secret material or
  provider internals (generic message only).

Config availability is checked **before** bearer parsing (via dependency
resolution order of `get_auth_verifier`), so a protected request with no config
returns `503` regardless of whether a token was supplied — deterministic and
consistent. (Alternative considered: always `401` even when unconfigured;
rejected because it hides operational misconfiguration behind a client-auth
status.)

## 6. JWT verification approach (JWKS asymmetric signing keys)

`SupabaseJwtVerifier` (in `app/core/auth/supabase.py`) uses **PyJWT with the
crypto extra** and PyJWT's `PyJWKClient` to fetch the Supabase project JWKS,
select the signing key by the token header `kid`, and verify the **asymmetric**
signature. No shared secret is involved.

JWKS endpoint: explicit `SUPABASE_JWKS_URL` from Supabase onboarding.

```python
import jwt  # PyJWT
from jwt import PyJWKClient
from app.modules.auth.context import UserContext
from app.modules.auth.verifier import AuthError

# Asymmetric algorithms Supabase signing keys may advertise. HS* and "none"
# are intentionally excluded to prevent algorithm-confusion attacks.
_ALLOWED_ALGS = ["ES256", "RS256", "EdDSA"]

class SupabaseJwtVerifier:
    def __init__(self, settings: AuthSettings) -> None:
        self._settings = settings
        # PyJWKClient caches keys in-process and refreshes on kid miss.
        self._jwk_client = PyJWKClient(
            settings.jwks_url,
            cache_keys=True,
            lifespan=settings.jwks_cache_ttl_seconds,
        )

    def verify(self, token: str) -> UserContext:
        try:
            signing_key = self._jwk_client.get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=_ALLOWED_ALGS,
                audience=self._settings.jwt_audience,      # optional; see below
                issuer=self._settings.jwt_issuer,          # optional; see below
                options={
                    "verify_aud": self._settings.jwt_audience is not None,
                    "verify_iss": self._settings.jwt_issuer is not None,
                },
            )
        except (jwt.PyJWTError, jwt.PyJWKClientError) as exc:
            raise AuthError("token verification failed") from exc

        user_id = claims.get("sub")
        if not user_id:
            raise AuthError("token has no subject")
        email = claims.get("email")  # optional
        return UserContext(user_id=user_id, email=email)
```

Algorithm / audience / issuer / caching considerations (kept minimal, not overbuilt):

- **Algorithm**: asymmetric only. `algorithms=_ALLOWED_ALGS` is passed explicitly
  so a token declaring `alg: none` or `HS*` is rejected (prevents alg confusion).
  Supabase signing keys are asymmetric (ES256 by default for new projects; RS256
  and EdDSA also possible).
- **Key selection**: `PyJWKClient.get_signing_key_from_jwt` reads the token header
  `kid`, fetches/caches the JWKS from `SUPABASE_JWKS_URL`, and returns the matching
  public key. A `kid` with no matching key raises a
  `PyJWKClientError` that maps to `AuthError` -> `401`.
- **Caching & rotation**: `get_auth_verifier()` keeps a process-scoped verifier cache
  keyed by the auth settings snapshot, so a fresh `PyJWKClient` is not constructed per
  request. `PyJWKClient` caches keys by `kid`; on a `kid` miss it can refetch, which
  handles Supabase key rotation. `jwks_cache_ttl_seconds` is passed as PyJWT's
  `lifespan` and must be positive; invalid, zero, or negative values fall back to
  `DEFAULT_JWKS_CACHE_TTL_SECONDS` (`600`). No JWKS fetch happens per-request in the
  steady state.
- **Expiry**: PyJWT verifies `exp` by default — expired tokens raise
  `ExpiredSignatureError` (a `PyJWTError`) and map to `AuthError` -> `401`.
- **Audience**: Supabase access tokens carry `aud: "authenticated"`.
  `SUPABASE_JWT_AUDIENCE` defaults to `authenticated`; when set, audience is
  verified, when explicitly emptied it is skipped. One small env knob.
- **Issuer**: `SUPABASE_JWT_ISSUER` is optional. When set (typically
  `{SUPABASE_URL}/auth/v1`) issuer is verified; when empty it is skipped. Kept
  optional to avoid overbuilding.
- **Failure opacity**: every PyJWT/JWKS failure collapses to a single
  provider-neutral `AuthError`; no distinct reason strings, no key/claim material
  crosses the boundary.

Dependency addition: `pyjwt[crypto]==2.10.1` in `[project].dependencies` of
`apps/api/pyproject.toml` (the `crypto` extra pulls in `cryptography` for
asymmetric verification). Tests generate an ephemeral asymmetric keypair, serve a
fake JWKS (e.g. by overriding the verifier via `app.dependency_overrides` or
stubbing the JWKS fetch), and sign real tokens with the private key — no live
network call to Supabase in tests.

## 7. Preserving the future provider/strategy path

The seam is `app/core/auth/provider.py::get_auth_verifier()`. It is the single
place that decides which concrete `AuthVerifier` to construct from settings.

- Today: returns `SupabaseJwtVerifier(settings)`, which uses Supabase JWKS
  asymmetric signing keys.
- Later: a new adapter (e.g. `OidcVerifier` or another provider) implements the
  same `AuthVerifier.verify(token) -> UserContext` protocol and is selected here
  based on a settings switch (e.g. a future `AUTH_VERIFICATION_MODE`).

Because the boundary, `UserContext`, `get_current_user`, `MeResponse`, and
`router.py` all depend only on the `AuthVerifier` protocol, none of them change
when the strategy changes. A test explicitly asserts this contract by exercising
`get_current_user` against a fake verifier via `app.dependency_overrides`,
proving the route works with any `AuthVerifier` implementation.

## 8. Provider leakage prevention

| Concern | Allowed location | Forbidden location |
| --- | --- | --- |
| Env var names (`SUPABASE_JWKS_URL`, optional `SUPABASE_URL`, etc.) | `app/core/config.py` | `app/modules/auth/*` |
| Supabase claim names (`sub`, `email`, `aud`), JWKS endpoint, `import jwt`, asymmetric verification details | `app/core/auth/supabase.py` | `app/modules/auth/*`, `app/core/auth/provider.py` (only constructs) |
| `AuthConfigError` (infra) | `app/core/auth/*` and app-level exception handler | domain callers depend only on behavior/status |
| `app.core.auth.provider.get_auth_verifier` composition seam | `app/modules/auth/dependencies.py` as the single allowed infrastructure import | all other `app/modules/auth/*` files; concrete adapter imports remain forbidden |
| `UserContext`, `AuthVerifier`, `AuthError` | `app/modules/auth/*` | — (these are the shared vocabulary) |

Enforcement: `test_provider_isolation.py` reads the source of every file under
`app/modules/auth/` and asserts (case-insensitive) the absence of `supabase`,
`import jwt`, and provider claim tokens (`"sub"`, `"aud"`). It also asserts that
no module under `app/modules/auth/` imports `app.core.auth.*` except the single
explicitly allowed composition-seam import of `app.core.auth.provider.get_auth_verifier`
inside `app/modules/auth/dependencies.py`. Direct imports of concrete adapters such
as `app.core.auth.supabase` are always forbidden. This makes the architectural rule
executable rather than aspirational.

## 9. Test design

Location: `apps/api/tests/auth/` (pytest, `TestClient`, matching the existing
`tests/` layout and CI's `uv run pytest tests/`). Helpers generate an ephemeral
asymmetric keypair (e.g. EC P-256 for ES256), build a fake JWKS document from the
public key with a fixed `kid`, and sign real tokens with the private key. The
JWKS fetch is stubbed (e.g. patching `PyJWKClient`/the JWKS HTTP call or injecting
a pre-built key) so tests never hit the network. Env is set via
`monkeypatch.setenv` and read at call time, so no module reload is required for
settings.

1. **Verifier / adapter** — `test_supabase_verifier.py`
   - success: valid token signed by the JWKS key -> `UserContext` with `user_id`
     from `sub`, `email` set.
   - token without email -> `UserContext.email is None`, still succeeds.
   - missing/empty `sub` -> `AuthError`.
   - expired token -> `AuthError`.
   - bad signature (token signed by a different/unknown key) -> `AuthError`.
   - unknown/unmatched `kid` (no key in JWKS) -> `AuthError`.
   - token declaring `alg: none` or an `HS*` alg -> `AuthError` (alg confusion).
   - malformed/garbage token -> `AuthError`.
   - wrong audience (when audience verification on) -> `AuthError`.

2. **Protected dependency / 401 contract** — `test_dependency.py`
   - missing `Authorization` header -> `401`, body exactly
     `{"detail": "Not authenticated"}`.
   - malformed scheme (`Authorization: Token x`, `Authorization: abc`) -> `401`,
     same exact body.
      - invalid token -> `401`, same exact body.
      - a temporary protected route with a sentinel side effect proves the handler
        body does not execute for missing, malformed, or invalid auth.
      - assert body has no extra keys and identical string across all cases.

3. **`GET /auth/me`** — `test_auth_me.py`
   - valid token -> `200`; response JSON keys are exactly
     `{"user_id", "email"}`; values match token identity.
   - valid token without email -> `200`, `email` is `null`.
   - no/invalid token -> `401` with the exact body.
   - assert no provider fields / raw claims present.

4. **Missing config** — `test_missing_config.py`
   - `from app.main import app` succeeds with `SUPABASE_JWKS_URL` unset.
   - `GET /health` -> `200 {"status": "ok"}` with config absent.
   - `GET /auth/me` -> `503 {"detail": "Authentication is not configured"}`;
     assert no config/provider material in the body.

5. **Provider-agnostic boundary** — `test_provider_isolation.py`
   - source-scan assertions described in §8, including the explicit allowlist for
     the single `get_auth_verifier` composition-seam import and denial of all
     concrete adapter imports from `app/modules/auth/*`.
   - `get_current_user` works against a fake in-memory `AuthVerifier` via
     `app.dependency_overrides`, proving the dependency is decoupled from Supabase.

## 10. Documentation & env example updates

- `apps/api/.env.example` (English, matching the existing file): add

  ```
  # Supabase Auth — backend token verification via JWT Signing Keys (JWKS).
  # SUPABASE_JWKS_URL is provided explicitly by Supabase onboarding; it is not derived from SUPABASE_URL.
  # Leave empty to boot without auth: public routes work, protected routes 503.
  SUPABASE_JWKS_URL=
  # Optional project URL for context/documentation only; not used for JWT verification.
  SUPABASE_URL=
  # Expected token audience (Supabase default). Empty disables audience check.
  SUPABASE_JWT_AUDIENCE=authenticated
  # Optional issuer check (typically {SUPABASE_URL}/auth/v1). Empty disables it.
  SUPABASE_JWT_ISSUER=
  # Optional JWKS in-process cache lifetime in seconds; must be > 0.
  SUPABASE_JWKS_CACHE_TTL_SECONDS=600
  ```

- `apps/api/README.md` (Spanish, extending the existing Spanish doc per repo
  convention): add an "Autenticación" section covering:
  - the provider-agnostic boundary (`AuthVerifier` + `UserContext`) and that
    Supabase is the first adapter while domain code depends on `UserContext`;
  - required env vars and the JWKS asymmetric signing-key verification model
    (keys fetched/cached from explicit `SUPABASE_JWKS_URL`, selected by `kid`; no
    shared secret);
  - local behavior when `SUPABASE_JWKS_URL` is absent (health/public work;
    `/auth/me` returns `503`);
  - how to exercise `GET /auth/me` with a bearer token (`curl -H "Authorization:
    Bearer <token>"`), including expected `200` identity body and `401`/`503`
    cases;
  - a note that `Depends(get_current_user)` is the **default required pattern**
    for protecting future domain routes.

## 11. Migration, rollback & review workload

- **Migration**: none. No database, model, or Alembic change — this slice adds
  no persistence. Purely additive code + docs + one runtime dependency.
- **Rollback**: remove `app/modules/auth/`, `app/core/auth/`, `app/core/config.py`,
  the `include_router` + exception-handler lines in `main.py`, the `pyjwt[crypto]`
  dependency, the `apps/api/tests/auth/` tests, and the auth sections of
  `.env.example`/`README.md`. The backend returns to its prior unauthenticated
  scaffold state; no data cleanup needed.
- **Review workload**: estimated ~600 changed lines (production code ~250–300,
  tests ~250, docs/env ~60), which exceeds the 400-line session review budget.
  Recommend the orchestrator split review/apply into two chunks:
  1. boundary + adapter + wiring + config (`modules/auth`, `core/auth`, `config`,
     `main`, `pyproject`);
  2. tests + documentation + env example.
  Flag this to the parent before the apply phase for a chained-PR decision.

## 12. Resolved ambiguities (summary)

- **Missing-config status code** -> `503` (not `401`); missing config now means
  `SUPABASE_JWKS_URL` absent; rationale in §5.
- **Verification mechanism** -> JWKS asymmetric signing keys only; legacy
  `SUPABASE_JWT_SECRET`/HS256 removed per user decision (§1, §6).
- **Audience verification** -> on by default (`authenticated`), one env knob to
  override/disable; issuer optional (§6). Kept minimal to avoid overbuild while
  rejecting `alg: none`/`HS*` and audience mismatch.
- **`WWW-Authenticate` header** on `401` -> permitted; only the JSON body is
  contractually fixed (§4).

Scope remains strictly the backend token-verification boundary and `/auth/me`.
No registration, login, frontend session, RBAC, persistence, or API-wide error
framework is introduced.
