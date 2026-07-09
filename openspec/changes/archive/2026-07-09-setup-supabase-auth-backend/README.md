# setup-supabase-auth-backend

OpenSpec change container for the Supabase Auth backend integration slice.

## Status

**Phase: initialized** — awaiting proposal.

## Intent

Wire Supabase Auth JWT validation into `apps/api` (FastAPI) so that every
domain API request is authenticated against a verified Supabase identity before
any business logic runs. This establishes the canonical user-context boundary
that all subsequent Kaito domain modules (`runner_profile`, `planning`,
`training_log`, etc.) will rely on.

## Scope summary

- Validate Supabase-issued JWTs in the FastAPI backend using JWT Signing Keys via
  the project JWKS endpoint (asymmetric verification; legacy shared secret not used).
- Extract a typed `UserContext` (at minimum `user_id`) from validated token
  claims and make it available to domain route handlers via FastAPI dependency
  injection.
- Reject unauthenticated requests with a proper `401 Unauthorized` before they
  reach any domain logic.
- Environment-driven configuration (`SUPABASE_JWKS_URL` for the explicit JWKS endpoint, optional
  audience/issuer/JWKS cache TTL); no hard-coded credentials; graceful startup
  when values are present/absent.
- Provide a protected smoke endpoint (`GET /me` or similar) for integration
  verification.
- Unit and integration tests (pytest) for the JWT validation path, dependency
  injection, and error cases.

## Out of scope (this change)

- Frontend auth flow, session handling, or Supabase Auth SDK in `apps/web`.
- Database persistence (`runner_profile`, `users` table) — that is a separate
  domain change.
- Role-based authorization (RBAC) beyond identity verification.
- OAuth/social providers configuration (delegated to Supabase dashboard).

## Relevant architecture context

- `docs/08-architecture.md` § 8 — Auth/session flow: web sends JWT, api
  validates, domain executes.
- `docs/04-functional-requirements.md` — Auth is a prerequisite for all user
  data flows.
- `docs/05-data-model.md` — `user_id` (Supabase UUID) is the primary FK anchor
  for all domain entities.
- Existing backend: `apps/api/app/main.py` with Sentry observability already
  wired in. Module layout: `apps/api/app/core/`, `apps/api/app/modules/auth/`.

## Planned artifacts

| File | Phase | Description |
| --- | --- | --- |
| `proposal.md` | proposal | Confirmed intent, assumptions, scope, affected areas |
| `spec.md` | spec | Normative acceptance criteria (behavior, error codes, env vars) |
| `design.md` | design | Implementation structure, JWT validation strategy, DI wiring |
| `tasks.md` | tasks | Implementation checklist with test requirements |
| `apply-progress.md` | apply | Cumulative evidence and validation results |
| `verify-report.md` | verify | Final verification report before archive |

## Next phase

**Proposal** — define confirmed assumptions (JWKS asymmetric signing keys — legacy
symmetric secret excluded per user decision, `UserContext` shape, env var names,
error response contract, protected endpoint for verification) before writing spec.
