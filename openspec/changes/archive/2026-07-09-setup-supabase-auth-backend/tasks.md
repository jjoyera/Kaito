# Tasks — Setup Supabase Auth Backend

## Review Workload Forecast

| Field | Value |
| ------- | ------- |
| Estimated changed lines | ~550–650 additions/deletions |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: auth boundary + Supabase verifier + verifier tests → PR 2: FastAPI dependency, `/auth/me`, missing-config handling + endpoint/dependency tests → PR 3: provider-isolation guard, docs/env updates, final validation |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

> Strict TDD is active. Preserve RED → GREEN → REFACTOR evidence for each work unit: add the failing test first, run the focused command and record the expected failure, implement the smallest passing slice, then run focused and full validation.

> **JWKS correction (active work).** Work Units 0–3 below are the original,
> already-applied plan that used the legacy `SUPABASE_JWT_SECRET`/HS256 symmetric
> secret. That mechanism is superseded: the user confirmed JWKS-only verification
> with Supabase JWT Signing Keys. Treat Work Units 0–3 as historical record and
> perform **Work Unit 4 — JWKS correction** below to bring the implementation in
> line with the revised spec/design before archive. Strict TDD remains active; use
> small chunks/checkpoints so raw RED evidence is preserved this time.

> **Explicit JWKS URL correction (Work Unit 5).** After Work Unit 4, the user
> confirmed that `SUPABASE_JWKS_URL` should be read **explicitly** from the Supabase
> onboarding variables rather than derived from `SUPABASE_URL`. Work Unit 5 corrects
> this: `SUPABASE_JWKS_URL` is now the required auth signal; `SUPABASE_URL` is
> optional/informational; `SUPABASE_SECRET_KEY` must not be used for JWT verification.

## Work Unit 6 — Post-archive 4R Corrections

- [x] RED: add focused tests for process-scoped verifier/JWKS cache reuse, zero/negative JWKS TTL normalization, and generic operational logging for missing config and verification failures.
- [x] GREEN: add named JWKS TTL default/positive validation, process-scoped verifier cache keyed by `AuthSettings` with test-safe reset, and structured generic logs without token/secret/provider-sensitive material.
- [x] REFACTOR/docs: clarify PyJWKClient cache semantics and update archived SDD/project context stale references to explicit `SUPABASE_JWKS_URL`.
- [x] Run focused auth tests plus required validation commands after the corrections.

---

## Work Unit 5 — Explicit SUPABASE_JWKS_URL (correction from derived URL)

### 5a — Config/provider: explicit JWKS URL from SUPABASE_JWKS_URL

- [x] RED: update `apps/api/tests/auth/test_missing_config.py` to expect `SUPABASE_JWKS_URL` as the required auth config (not `SUPABASE_URL`); add `test_auth_settings_reads_explicit_jwks_url` (sets `SUPABASE_JWKS_URL`, expects `settings.jwks_url` to equal it), `test_config_module_has_no_secret_key_reference`, `url_only_client` fixture, and `test_auth_me_returns_503_with_url_but_no_jwks_url`. Run focused test and capture RED failure.
- [x] GREEN: rewrite `apps/api/app/core/config.py` so `AuthSettings.jwks_url: str` is read from `SUPABASE_JWKS_URL`; `AuthSettings.supabase_url: str | None = None` is optional/informational from `SUPABASE_URL`. Update `provider.py` to check `settings.jwks_url` (not `supabase_url`). Remove derived `jwks_url` property.
- [x] Run `cd apps/api && uv run pytest tests/auth/test_missing_config.py` and confirm all 10 pass.

### 5b — Test fixture updates and full validation

- [x] Update `apps/api/tests/auth/test_supabase_verifier.py` `_make_settings()` to pass `jwks_url=` directly instead of `supabase_url=`.
- [x] Update `apps/api/tests/auth/test_auth_me.py` `auth_client` fixture to set `SUPABASE_JWKS_URL` instead of `SUPABASE_URL`.
- [x] Update `apps/api/tests/auth/test_dependency.py` `protected_app` fixture to set `SUPABASE_JWKS_URL` instead of `SUPABASE_URL`.
- [x] Update `apps/api/.env.example`: add `SUPABASE_JWKS_URL=` as required, move `SUPABASE_URL=` to optional/informational, note that server-side API key is not used for JWT verification.
- [x] Update `apps/api/README.md` auth section: `SUPABASE_JWKS_URL` as required, `SUPABASE_URL` as optional, note server-side API key not used.
- [x] Run `cd apps/api && uv run pytest tests/auth -q` → 40 passed.
- [x] Run `cd apps/api && uv run pytest -q` → 65 passed.
- [x] Run `cd apps/api && uv run ruff check .` → All checks passed.
- [x] Run `cd apps/api && uv run python -c "from app.main import app"` → exit 0.

---

## Work Unit 4 — JWKS correction (replace HS256 with Supabase JWT Signing Keys)

> Focused chunks to preserve RED evidence. Run and record each RED command output
> before implementing. Validation commands: `cd apps/api && uv run pytest`,
> `cd apps/api && uv run ruff check .`, `cd apps/api && uv run python -c "from app.main import app"`.

### 4a — Config: SUPABASE_URL-based JWKS settings

- [x] RED: update `apps/api/tests/auth/test_missing_config.py` (or add a focused config test) so missing config means `SUPABASE_URL` unset: `from app.main import app` imports, `GET /health` -> `200 {"status": "ok"}`, `GET /auth/me` -> `503 {"detail": "Authentication is not configured"}`; assert no `SUPABASE_JWT_SECRET` remains referenced. Run the focused test and capture the expected failure.
- [x] GREEN: rewrite `apps/api/app/core/config.py` `AuthSettings`/`get_auth_settings()` to read `SUPABASE_URL` (derive `jwks_url = {SUPABASE_URL}/auth/v1/.well-known/jwks.json`), optional `SUPABASE_JWT_AUDIENCE` (default `authenticated`), optional `SUPABASE_JWT_ISSUER`, and optional `SUPABASE_JWKS_CACHE_TTL_SECONDS`. Remove `jwt_secret` / `SUPABASE_JWT_SECRET` entirely.
- [x] GREEN: update `apps/api/app/core/auth/provider.py::get_auth_verifier()` to raise `AuthConfigError` when `SUPABASE_URL` is absent (no secret check).
- [x] Run the focused config/missing-config test and confirm it passes.

### 4b — Adapter: JWKS asymmetric verification

- [x] RED: rewrite `apps/api/tests/auth/test_supabase_verifier.py` to generate an ephemeral asymmetric keypair (e.g. EC P-256/ES256), build a fake JWKS with a fixed `kid`, stub the JWKS fetch (patch `PyJWKClient`/JWKS HTTP or inject a key), and cover: valid token -> `UserContext` (`user_id` from `sub`, `email` set); token without email -> `email is None`; missing/empty `sub` -> `AuthError`; expired token -> `AuthError`; bad signature (different key) -> `AuthError`; unknown/unmatched `kid` -> `AuthError`; `alg: none`/`HS*` token -> `AuthError`; malformed token -> `AuthError`; wrong audience (when on) -> `AuthError`. Run focused and capture the expected failure.
- [x] GREEN: rewrite `apps/api/app/core/auth/supabase.py` `SupabaseJwtVerifier` to use `PyJWKClient` against `settings.jwks_url`, select the signing key by `kid`, verify with asymmetric algorithms only (`["ES256", "RS256", "EdDSA"]`), verify expiry/audience/issuer as configured, and map `sub`/`email`. Collapse all `PyJWTError`/`PyJWKClientError` to `AuthError`.
- [x] GREEN: change the dependency in `apps/api/pyproject.toml` from `pyjwt==2.10.1` to `pyjwt[crypto]==2.10.1` and update `apps/api/uv.lock` via `cd apps/api && uv sync`.
- [x] Run `cd apps/api && uv run pytest tests/auth/test_supabase_verifier.py` and confirm the verifier slice passes.
- [x] REFACTOR: confirm no Supabase/JWKS/JWT names leak into `apps/api/app/modules/auth/*`; run `apps/api/tests/auth/test_provider_isolation.py`.

### 4c — Docs, env, and full validation

- [x] Update `apps/api/.env.example`: remove `SUPABASE_JWT_SECRET`; add `SUPABASE_URL=`, keep `SUPABASE_JWT_AUDIENCE=authenticated`, `SUPABASE_JWT_ISSUER=`, and `SUPABASE_JWKS_CACHE_TTL_SECONDS=600` per design §10.
- [x] Update `apps/api/README.md` `Autenticación` section: describe JWKS asymmetric verification via `{SUPABASE_URL}/auth/v1/.well-known/jwks.json` (kid-selected keys, no shared secret) and `SUPABASE_URL`-absent behavior (`/health` works, `/auth/me` -> `503`).
- [x] Update `apps/api/tests/auth/test_auth_me.py` and `test_dependency.py` helpers to sign tokens with the asymmetric test key instead of an HS256 secret.
- [x] Run focused auth validation: `cd apps/api && uv run pytest tests/auth`.
- [x] Run full validation: `cd apps/api && uv run pytest`, `cd apps/api && uv run ruff check .`, `cd apps/api && uv run python -c "from app.main import app"`.
- [x] Capture RED/GREEN evidence and final `git diff --stat` in `apply-progress.md`; note that this correction supersedes the HS256 apply.

---

## Work Unit 0 — Preflight and chain decision *(historical — HS256, superseded by Work Unit 4)*

- [x] Confirm delivery mode before apply: use the recommended chained split above, or record an explicit size exception if the user keeps one PR despite the high 400-line budget risk.
- [x] Review current backend test helpers in `apps/api/tests/conftest.py`, `apps/api/tests/test_main.py`, and existing reload/env patterns before adding auth tests.
- [x] Confirm validation commands for this change: `cd apps/api && uv run pytest`, `cd apps/api && uv run ruff check .`, and `cd apps/api && uv run python -c "from app.main import app"`.

## Work Unit 1 — Auth boundary and Supabase JWT verifier *(historical — HS256, superseded by Work Unit 4)*

- [x] RED: add `apps/api/tests/auth/test_supabase_verifier.py` covering valid token, valid token without `email`, missing/empty `sub`, expired token, bad signature, malformed token, and wrong audience; run `cd apps/api && uv run pytest tests/auth/test_supabase_verifier.py` and capture the expected import/failure output.
- [x] GREEN: add provider-agnostic domain files `apps/api/app/modules/auth/__init__.py`, `apps/api/app/modules/auth/context.py`, and `apps/api/app/modules/auth/verifier.py` with immutable `UserContext(user_id: str, email: str | None)` plus `AuthVerifier` and `AuthError`.
- [x] GREEN: add `apps/api/app/core/config.py`, `apps/api/app/core/auth/__init__.py`, `apps/api/app/core/auth/errors.py`, `apps/api/app/core/auth/supabase.py`, and `apps/api/app/core/auth/provider.py` implementing call-time env settings, `AuthConfigError`, `SupabaseJwtVerifier`, and `get_auth_verifier()`.
- [x] GREEN: add `pyjwt==2.10.1` to `apps/api/pyproject.toml` and update `apps/api/uv.lock` with `cd apps/api && uv sync` or the project-standard lock update command.
- [x] GREEN: run `cd apps/api && uv run pytest tests/auth/test_supabase_verifier.py` and confirm the verifier slice passes.
- [x] REFACTOR: inspect `apps/api/app/modules/auth/*` to ensure no Supabase names, JWT imports, provider claims, or secret material are present in the domain-facing boundary.

## Work Unit 2 — FastAPI dependency, protected route, and missing config *(historical — HS256, superseded by Work Unit 4)*

- [x] RED: add `apps/api/tests/auth/test_dependency.py` with a temporary protected sentinel route proving missing header, malformed scheme/header, and invalid token return exactly `401 {"detail": "Not authenticated"}` and do not execute the handler body; run `cd apps/api && uv run pytest tests/auth/test_dependency.py` and capture the expected failure.
- [x] GREEN: add `apps/api/app/modules/auth/dependencies.py` using `HTTPBearer(auto_error=False)`, `Depends(get_auth_verifier)`, and `AuthError` mapping to the exact `401` body; keep the only allowed infrastructure import as `app.core.auth.provider.get_auth_verifier`.
- [x] GREEN: run `cd apps/api && uv run pytest tests/auth/test_dependency.py` and confirm dependency and sentinel behavior pass.
- [x] RED: add `apps/api/tests/auth/test_auth_me.py` covering `GET /auth/me` success with email, success without email, no/invalid token `401`, exact response keys `{"user_id", "email"}`, and absence of provider/raw/domain fields; run `cd apps/api && uv run pytest tests/auth/test_auth_me.py` and capture the expected failure.
- [x] GREEN: add `apps/api/app/modules/auth/schemas.py` and `apps/api/app/modules/auth/router.py`, then update `apps/api/app/main.py` to include the auth router.
- [x] GREEN: run `cd apps/api && uv run pytest tests/auth/test_auth_me.py` and confirm the endpoint contract passes.
- [x] RED: add `apps/api/tests/auth/test_missing_config.py` covering `from app.main import app` with `SUPABASE_JWT_SECRET` unset, `GET /health` still returning `200 {"status": "ok"}`, and `GET /auth/me` returning `503 {"detail": "Authentication is not configured"}` without secret/provider leakage; run `cd apps/api && uv run pytest tests/auth/test_missing_config.py` and capture the expected failure.
- [x] GREEN: update `apps/api/app/main.py` with an `AuthConfigError` exception handler that returns `503 {"detail": "Authentication is not configured"}` and does not affect public routes.
- [x] GREEN: run `cd apps/api && uv run pytest tests/auth/test_missing_config.py tests/auth/test_auth_me.py tests/auth/test_dependency.py` and confirm protected-route behavior passes.
- [x] REFACTOR: verify dependency resolution keeps missing-config behavior deterministic and distinct from unauthorized token failures.

## Work Unit 3 — Provider isolation guard, docs, and final validation *(historical — HS256, superseded by Work Unit 4)*

- [x] RED: add `apps/api/tests/auth/test_provider_isolation.py` scanning `apps/api/app/modules/auth/` to forbid `supabase`, `import jwt`, provider claim tokens such as `"sub"`/`"aud"`, and all `app.core.auth.*` imports except the single allowed `app.core.auth.provider.get_auth_verifier` import in `dependencies.py`; also test `get_current_user` with a fake in-memory verifier through FastAPI dependency overrides; run `cd apps/api && uv run pytest tests/auth/test_provider_isolation.py` and capture the expected failure if the guard is not yet satisfied.
- [x] GREEN: adjust only the minimal implementation needed for `test_provider_isolation.py` to pass without weakening the provider-agnostic boundary.
- [x] GREEN: run `cd apps/api && uv run pytest tests/auth/test_provider_isolation.py` and confirm provider isolation passes.
- [x] REFACTOR: review `apps/api/app/core/auth/supabase.py`, `apps/api/app/core/auth/provider.py`, `apps/api/app/modules/auth/dependencies.py`, and `apps/api/app/modules/auth/router.py` for small, explicit code; remove dead abstractions, provider leakage, and failure-specific client messages.
- [x] Update `apps/api/.env.example` with `SUPABASE_JWT_SECRET=`, `SUPABASE_JWT_AUDIENCE=authenticated`, and reserved `SUPABASE_JWT_ISSUER=` guidance matching the design.
- [x] Update `apps/api/README.md` with a Spanish `Autenticación` section covering the provider-agnostic boundary, Supabase as first adapter, required env vars, no-secret behavior (`/health` works, `/auth/me` returns `503`), `/auth/me` curl verification, and `Depends(get_current_user)` as the default future protected-route pattern.
- [x] Run focused auth validation: `cd apps/api && uv run pytest tests/auth`.
- [x] Run full backend validation: `cd apps/api && uv run pytest`, `cd apps/api && uv run ruff check .`, and `cd apps/api && uv run python -c "from app.main import app"`.
- [x] Capture final evidence in the apply notes: RED failure summaries for each test-first step, GREEN pass commands, final validation output, changed-line count from `git diff --stat`, and whether the selected delivery mode stayed within or intentionally exceeded the review budget.

## Rollback boundaries

- If Work Unit 1 fails irrecoverably, revert `apps/api/app/modules/auth/context.py`, `apps/api/app/modules/auth/verifier.py`, `apps/api/app/core/config.py`, `apps/api/app/core/auth/*`, `apps/api/tests/auth/test_supabase_verifier.py`, and the PyJWT dependency/lock changes.
- If Work Unit 2 fails irrecoverably, revert `apps/api/app/modules/auth/dependencies.py`, `apps/api/app/modules/auth/schemas.py`, `apps/api/app/modules/auth/router.py`, related `apps/api/app/main.py` wiring, and dependency/endpoint/missing-config tests while keeping Work Unit 1 if it is independently passing.
- If Work Unit 3 fails irrecoverably, revert `apps/api/tests/auth/test_provider_isolation.py`, documentation/env changes, and any refactors made only for cleanup while keeping passing auth behavior from Work Units 1–2.
