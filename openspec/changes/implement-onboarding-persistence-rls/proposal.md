# Proposal: Implement Onboarding Persistence and RLS

## Intent

Issue #21 makes the canonical onboarding contract resumable for authenticated runners. Kaito has verified `UserContext` and the contract, but no schema, persistence/API seam, local Supabase stack, or RLS proof.

## Scope

### In Scope
- Persist one current JSONB snapshot per user while preserving `onboarding-contract` lifecycle semantics.
- Add protected FastAPI save/read seams and SQLAlchemy CRUD in `runner_profile`; derive ownership only from verified `UserContext.user_id` and scope every repository operation.
- Establish Supabase CLI schema migrations and owner-only RLS; prove two-user isolation against Docker-backed local Supabase in development and CI.
- Expected delivery exceeds 400 changed lines; use an automatic two-PR chain: database/RLS proof, then dependent API persistence, each within budget.

### Out of Scope
- Issue #22 UI or direct browser persistence.
- Plan generation, analytics, or audit history.
- Alembic and broad architecture-document reconciliation.

## Capabilities

### New Capabilities
- `onboarding-persistence`: Owner-scoped current-snapshot storage, protected API access, lifecycle validation, and executable RLS isolation.

### Modified Capabilities
None. `onboarding-contract` remains the unchanged canonical payload and lifecycle boundary.

## Approach

Supabase CLI is the sole DDL, migration, index, constraint, and RLS authority; SQLAlchemy performs runtime CRUD only. FastAPI validates before writes and after reads, omits owner/storage fields from payloads, and combines repository owner filters with caller-effective RLS. Privileged connections cannot satisfy the RLS proof.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `supabase/` | New | Local stack, migrations, policies |
| `apps/api/app/modules/runner_profile/` | New | Use cases, repository, protected API |
| `apps/api/app/main.py`, `apps/api/pyproject.toml` | Modified | Composition and runtime dependencies |
| `apps/api/tests/`, CI workflows | Modified | Unit/API tests and real two-user RLS proof |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Privileged tests imply false RLS safety | High | Use two authenticated database identities |
| Contract drift or payload leakage | Medium | Reuse validation; exclude payloads from logs |
| Competing migration authorities | Medium | Reject Alembic |

## Rollback Plan

Revert slices independently. Disable API composition first; remove policies/table through a forward CLI migration only after preserving or intentionally discarding data.

## Dependencies

- Issue #20 canonical contract, Supabase CLI, Docker, PostgreSQL driver, and SQLAlchemy.

## Success Criteria

- [ ] A user can save, resume, complete, edit, and retrieve one canonical current snapshot.
- [ ] Owner identity is never client supplied; API scoping and RLS deny cross-user access.
- [ ] Docker-backed CI proves two-user select/update/delete isolation with real RLS.
- [ ] No Alembic, UI, planning, audit history, or broad documentation work is introduced.
