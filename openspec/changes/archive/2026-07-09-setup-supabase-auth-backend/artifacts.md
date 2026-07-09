# Artifacts — setup-supabase-auth-backend

Artifact index and status tracking for the `setup-supabase-auth-backend`
OpenSpec change.

## Phase status

| Phase | Status | Artifact |
| --- | --- | --- |
| init | ✅ complete | `README.md` (this file + README) |
| proposal | ✅ complete | `proposal.md` |
| spec | ✅ complete | `spec.md` + `specs/backend-auth/spec.md` |
| design | ✅ complete | `design.md` |
| tasks | ✅ complete | `tasks.md` |
| apply | ✅ complete | `apply-progress.md` |
| verify | ✅ complete | `verify-report.md` |
| sync | ✅ complete | `sync-report.md` |

## Expected implementation targets

| Target | Role |
| --- | --- |
| `apps/api/app/core/auth/supabase.py` | Supabase JWT verification adapter (JWKS asymmetric signing keys) |
| `apps/api/app/core/auth/provider.py` | Provider-neutral verifier composition seam |
| `apps/api/app/modules/auth/dependencies.py` | FastAPI `get_current_user` dependency providing `UserContext` |
| `apps/api/app/modules/auth/` | Auth module: router, schemas, `UserContext` model, boundary protocol |
| `apps/api/app/core/config.py` | Extended auth settings: explicit `SUPABASE_JWKS_URL`, optional `SUPABASE_URL`, audience, optional issuer, JWKS cache TTL |
| `apps/api/.env.example` | Document required auth environment variables |
| `apps/api/tests/` | pytest: unit (JWT validation), integration (protected endpoint) |
| `apps/api/README.md` | Developer docs for auth setup and env config |

## Key references

- `docs/08-architecture.md` § 8 (auth/session flow)
- `docs/04-functional-requirements.md` (auth prerequisite)
- `docs/05-data-model.md` (`user_id` as FK anchor)
- `openspec/config.yaml` (SDD conventions and test runner)
