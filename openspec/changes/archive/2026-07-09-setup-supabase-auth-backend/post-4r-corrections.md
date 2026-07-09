# Post-archive 4R Corrections — setup-supabase-auth-backend

Date: 2026-07-09

## Summary

Addressed final 4R findings after archive while preserving the final auth contract:

- `SUPABASE_JWKS_URL` is required for JWT verification.
- `SUPABASE_URL` remains optional/informational and is not used to derive JWKS.
- `SUPABASE_JWT_SECRET` and `SUPABASE_SECRET_KEY` are not supported JWT verification paths.
- Token/auth failures still return exactly `401 {"detail": "Not authenticated"}`.
- Missing auth config still returns exactly `503 {"detail": "Authentication is not configured"}`.
- `/auth/me` remains identity-only: `user_id` and nullable `email`.

## Corrections

| Finding | Correction |
| --- | --- |
| R1-001 / R4-001 | Added a process-scoped verifier cache in `app/core/auth/provider.py`, keyed by immutable `AuthSettings`, with `reset_auth_verifier_cache()` for tests/config invalidation. This reuses the same `SupabaseJwtVerifier`/`PyJWKClient` across requests with identical auth settings. |
| R4-002 | Added generic structured operational logging for missing auth config and JWT/JWKS verifier failures without token, secret, JWKS URL, or provider-sensitive material in log messages. Response bodies are unchanged. |
| R3-001 | Added `DEFAULT_JWKS_CACHE_TTL_SECONDS = 600` and normalized invalid, zero, or negative `SUPABASE_JWKS_CACHE_TTL_SECONDS` to the safe default before constructing `PyJWKClient`. |
| R3-002 / R2-003 | Centralized the cache TTL default and documented PyJWKClient/key-cache semantics in README/OpenSpec: process-scoped verifier cache; PyJWKClient caches keys by `kid` and can refresh on miss/rotation; TTL is PyJWT `lifespan` and must be positive. |
| R2-001 | Updated archived spec/proposal/design narrative to mark explicit `SUPABASE_JWKS_URL` as final and remove stale derivation language from normative narrative/design sections. Historical task/apply records remain as superseded history. |
| R2-002 | Updated `openspec/project-context.md` to point to the archived change path and reflect strict TDD enabled. |

## Strict TDD Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Process-scoped verifier/JWKS cache | `apps/api/tests/auth/test_auth_me.py` | Integration | `tests/auth -q`: 40 passed | New repeated-request test expected one JWKS fetch; RED initially blocked on missing `reset_auth_verifier_cache` and would fail per-request verifier construction | Focused suite: 5 passed; auth suite: 45 passed | Two protected requests with same token/settings prove cache reuse | Provider cache keyed by `AuthSettings`, lock-protected, test reset helper |
| TTL validation/default constant | `apps/api/tests/auth/test_missing_config.py` | Unit | `tests/auth -q`: 40 passed | New tests imported missing `DEFAULT_JWKS_CACHE_TTL_SECONDS` and asserted zero/negative fallback | Focused suite: 5 passed | Positive TTL test proves valid values are preserved | Named constant replaces repeated `600` literal in config |
| Operational logging | `apps/api/tests/auth/test_missing_config.py`, `apps/api/tests/auth/test_supabase_verifier.py` | Unit/Integration | `tests/auth -q`: 40 passed | New caplog tests expected generic missing-config and verifier-failure logs | Focused suite: 5 passed | Tests assert presence of operational message and absence of token/secret/provider URL material | Logs include generic message plus exception type in `extra`, not sensitive values |
| SDD/docs context cleanup | OpenSpec/README/project-context | Docs | N/A | Review findings supplied stale references as RED evidence | README/OpenSpec/project-context updated | N/A | Historical records retained only as superseded history |

## Validation

```bash
$ cd apps/api && uv run pytest tests/auth/test_missing_config.py tests/auth/test_supabase_verifier.py tests/auth/test_auth_me.py -q
32 passed, 160 warnings in 0.45s

$ cd apps/api && uv run pytest tests/auth -q
45 passed, 244 warnings in 0.53s

$ cd apps/api && uv run pytest -q
70 passed, 342 warnings in 0.59s

$ cd apps/api && uv run ruff check .
All checks passed!

$ cd apps/api && uv run python -c "from app.main import app"
exit 0
```

Warnings are existing FastAPI/Starlette deprecations under the local Python runtime.

## Files changed

- `apps/api/app/core/config.py`
- `apps/api/app/core/auth/provider.py`
- `apps/api/app/core/auth/supabase.py`
- `apps/api/tests/auth/conftest.py`
- `apps/api/tests/auth/test_auth_me.py`
- `apps/api/tests/auth/test_missing_config.py`
- `apps/api/tests/auth/test_supabase_verifier.py`
- `apps/api/README.md`
- `openspec/project-context.md`
- `openspec/specs/backend-auth/spec.md`
- `openspec/changes/archive/2026-07-09-setup-supabase-auth-backend/spec.md`
- `openspec/changes/archive/2026-07-09-setup-supabase-auth-backend/specs/backend-auth/spec.md`
- `openspec/changes/archive/2026-07-09-setup-supabase-auth-backend/proposal.md`
- `openspec/changes/archive/2026-07-09-setup-supabase-auth-backend/design.md`
- `openspec/changes/archive/2026-07-09-setup-supabase-auth-backend/tasks.md`
- `openspec/changes/archive/2026-07-09-setup-supabase-auth-backend/post-4r-corrections.md`

## Deviations / remaining notes

- No contract deviations.
- No commit/push/PR performed.
- `.env.example` content already documents explicit `SUPABASE_JWKS_URL`; the attempted TTL-comment refinement was not applied because the safety policy blocks editing `.env.example` through this tool session.
