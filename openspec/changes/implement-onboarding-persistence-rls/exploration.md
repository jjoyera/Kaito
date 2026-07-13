## Exploration: implement-onboarding-persistence-rls

### Current State

Issue #20 is closed and its canonical contract is `openspec/specs/onboarding-contract/spec.md`. It defines the provider-agnostic payload, exact initial `contract_version` of `"1"`, resumable `incomplete` drafts, authoritative `completed` validation, automatic demotion after invalid edits, and deterministic conditional clearing. It deliberately excludes storage, migrations, endpoints, and UI sequencing.

The runtime has a protected but otherwise minimal FastAPI API: `UserContext.user_id` is derived only from a verified Supabase JWT, and protected handlers use `Depends(get_current_user)`. The web application protects `/onboarding`, but renders only a placeholder. It has an authenticated-fetch adapter that forwards a fresh bearer token to FastAPI. There is no `runner_profile` module, onboarding API, persistence repository, database dependency, Supabase CLI project, local database, or RLS policy yet.

The documented target architecture assigns onboarding to `apps/api/app/modules/runner_profile`, keeps the web as UX, and identifies SQLAlchemy plus Alembic as the backend persistence and migration path. The current API dependencies do not include SQLAlchemy, Alembic, or a PostgreSQL driver. The approved direction supersedes the migration portion of that documentation: Supabase CLI is the sole authority for DDL, migrations, indexes, constraints, and RLS policies; SQLAlchemy is runtime CRUD/access from FastAPI only. The architecture documentation requires later reconciliation, outside #21.

### Affected Areas

- `openspec/specs/onboarding-contract/spec.md` — canonical validation and lifecycle boundary that persistence must preserve without redefining.
- `apps/api/app/modules/auth/context.py` and `apps/api/app/modules/auth/dependencies.py` — provide the verified, provider-neutral ownership context for onboarding use cases.
- `apps/api/app/main.py` — will eventually compose a new protected `runner_profile` router; it currently exposes only `/health` and `/auth/me`.
- `apps/api/app/modules/runner_profile/` — planned capability boundary; absent today and should own onboarding application/domain/repository seams rather than extending `auth`.
- `apps/api/pyproject.toml` — lacks runtime database dependencies and test fixtures; it must not add Alembic as a second migration authority.
- `apps/web/features/auth/_adapters/private-fetch.ts` — existing client-to-FastAPI bearer-token path for later UI work; it should remain the route used by #22 rather than making the UI a second persistence authority.
- `apps/web/app/(private)/onboarding/page.tsx` — protected placeholder only; its form, progress, and presentation states belong to #22, not this change.
- Supabase migration/config paths — no `supabase/` directory, `supabase/config.toml`, migrations, or RLS policies exist. Supabase CLI must establish the committed schema and policy source of truth.
- `apps/api/tests/` — pytest and FastAPI `TestClient` provide strong isolated API/auth tests, but no Docker-backed local Supabase integration harness exists to exercise actual RLS.

### Contract-to-Persistence Map

| Contract concern | Persistence obligation for #21 | Boundary |
| --- | --- | --- |
| `contract_version == "1"` | Store the submitted version with the current record; reject unknown versions before persistence or through an explicit translator. | API validation/application layer |
| Incomplete drafts | Preserve structurally parseable typed answers, including completion-invalid values, without declaring completion. | API validation + current record |
| Completed state | Persist only a fully completion-valid payload as `completed`; reads must not present an invalid record as complete. | API validation + record state |
| Invalid completed edit | Preserve typed answers, clear hidden fields, and persist/retrieve the automatically demoted `incomplete` state. | API application layer |
| Ownership | Derive owner only from `UserContext.user_id`; never accept an owner identifier in request data. | Auth dependency + repository |
| RLS | Supabase CLI migrations enable RLS and enforce owner-only select/insert/update/delete for the authenticated database role. | Database migration/policies |
| Validation boundaries | Web validation is later UX feedback; FastAPI remains authoritative before writes and after reads. Database constraints protect record shape/invariants that remain meaningful outside the API. | #21 API; #22 UI |

### Approaches

1. **Approved: one current owner-scoped JSONB snapshot** — Store one current onboarding record per owner with `owner_id`, `contract_version`, `state`, canonical payload JSONB, and timestamps. Draft saves, completion, and later edits update that same record; no immutable onboarding history is created for #21.
   - Pros: Closest to the versioned, storage-independent contract; preserves sparse drafts and conditional clearing without an EAV schema; one-row ownership makes RLS simple; minimizes sensitive-data retention.
   - Cons: Database-level querying on individual answers is less convenient; future analytics/planning may need explicit projections or read models; audit history is intentionally unavailable.
   - Effort: Medium.

2. **Normalized question and answer tables** — Persist catalog metadata and answer values as relational rows keyed by owner, question identifier, and version.
   - Pros: Direct SQL querying and analytics; per-answer indexing.
   - Cons: Reintroduces catalog/schema semantics that #20 intentionally made contract-owned; complicates conditional clearing and typed values; creates more RLS policy surfaces; outside the approved MVP shape.
   - Effort: High.

3. **Append-only versioned snapshots plus a current projection** — Retain every draft/completion transition in immutable snapshots and maintain a current record for reads.
   - Pros: Auditability, recovery, and future plan-input provenance.
   - Cons: Requires retention, correction, and exposure rules not requested by #21; doubles write-path complexity and sensitive-data lifecycle obligations; outside the approved MVP scope.
   - Effort: High.

### Approved Operational Decisions

| Decision | Resolution |
| --- | --- |
| Schema and policy authority | Supabase CLI is the sole authority for DDL, migrations, indexes, constraints, and RLS policies. SQLAlchemy is limited to runtime CRUD/access from FastAPI. Alembic will not be introduced. Reconcile the existing architecture documentation later, outside #21. |
| Snapshot retention | Store one current owner-scoped onboarding snapshot per user. Draft saves, completion, and later edits update the same record. No immutable onboarding history or audit log is included in #21. |
| RLS verification | Use Docker-backed local Supabase in development and CI for real RLS integration tests. Prove isolation with two authenticated users; retain fast unit tests separately. |

### Recommendation

Implement the approved **one current owner-scoped JSONB snapshot** in a new `runner_profile` capability. Use Supabase CLI migrations as the only schema and RLS authority, and use SQLAlchemy only for FastAPI runtime CRUD/access. FastAPI use cases receive `UserContext`, derive ownership exclusively from it, apply the canonical contract validation before writes and after reads, and retain owner scoping even though RLS provides defense in depth.

RLS is a separate enforcement layer, not a replacement for API authorization. The Docker-backed local Supabase suite must execute real requests as two distinct authenticated database identities and prove that neither can read, update, nor delete the other user's record. A server connection that bypasses RLS is not RLS proof. The existing authenticated-fetch path remains the future #22 UI path.

### Scope Boundaries

| Belongs in #21 | Deferred |
| --- | --- |
| Supabase CLI database foundation; a current owner-scoped record; indexes, constraints, and owner RLS policies defined only in CLI migrations; runtime SQLAlchemy access from FastAPI; authoritative API validation, persistence, and retrieval; draft resume; completion/demotion semantics; and Docker-backed two-user RLS integration proof. | Alembic adoption or any second migration authority; reconciliation of pre-existing architecture documentation that names Alembic. |
| API endpoint shapes needed for persistence and safe retrieval, without exposing storage or owner fields; fast isolated unit tests remain separate from the RLS integration suite. | Form step order, fields/components, client form state, progress UI, loading/error/success presentation, and client-side Zod feedback (#22). |
| Completion status exposed as a domain result if needed by protected API consumers. | Immutable onboarding history/audit logs, training-plan generation, feasibility warnings, eligibility, plan snapshots, and downstream analytical projections. |

### Delivery Forecast

The implementation is expected to exceed the 400 changed-line review budget once Supabase CLI setup, migrations, RLS policies, Docker-backed integration proof, API capability code, and tests are included. Session mode is auto-forecast with automatic chained PRs above the threshold.

Decision needed before apply: No
Chained PRs recommended: Yes
400-line budget risk: High

1. **Database foundation and RLS proof** — Supabase CLI configuration and migration, current-record schema, indexes/constraints, owner policies, Docker-backed local Supabase setup, and two-user isolation verification. This is security concentrated and independently reviewable.
2. **Runner-profile API persistence** — SQLAlchemy runtime access, contract parser/validator integration, owner-scoped use cases and protected endpoints, draft/completion/demotion behavior, and fast unit/API tests.

The main review risk is false confidence: reviewing API owner filters without the executable two-user RLS proof, or treating a privileged backend connection as policy verification. A second risk is expanding #21 into UI behavior, audit history, or normalized analytics schema before a real consumer requires it.

### Risks

- The repository has no database runtime, Supabase CLI configuration, migrations, or local Supabase integration harness; this foundation must be introduced before persistence can be safely delivered.
- Existing architecture documentation names SQLAlchemy plus Alembic for migrations. Implementing Alembic would create conflicting schema authorities; record the documentation reconciliation as later work without broadening #21.
- RLS semantics depend on the database role and propagated identity. A privileged backend connection may bypass policies, so only the Docker-backed two-user suite proves policy isolation.
- Onboarding data includes self-reported restrictions. Observability, logs, and test fixtures must avoid leaking payload content or identity data.

### Ready for Proposal

Yes — all three operational decisions are approved. The proposal should state the Supabase CLI-only migration authority, current-snapshot MVP retention, Docker-backed two-user RLS proof, the deferred architecture-documentation reconciliation, and the automatic chained delivery forecast. #22 remains the UI consumer.
