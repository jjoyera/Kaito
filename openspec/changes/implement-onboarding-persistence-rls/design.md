# Design: Implement Onboarding Persistence and RLS

## Technical Approach

Store one owner-scoped JSONB snapshot through Supabase migrations and verified `UserContext`. Synchronous SQLAlchemy 2/psycopg 3 matches current handlers; validate writes and reads.

## Architecture Decisions

| Decision | Alternative / tradeoff | Choice and rationale |
|---|---|---|
| Schema authority | Alembic duplicates state | Supabase config/migrations exclusively own roles, table, grants, constraints, trigger, and RLS; ORM metadata only maps. |
| Snapshot shape | Normalization/history add other capabilities | `onboarding_snapshots(owner_id uuid PK/FK auth.users, snapshot jsonb, created_at, updated_at)`. Checks enforce object, version `"1"`, and valid state; no extra index/history. |
| Transactions | Async adds another model | One process engine/sessionmaker and explicit use-case transaction; repositories never commit. Atomic upsert gives one row/last-commit-wins; canonical retries preserve `updated_at`. |
| RLS identity | Privileged URLs can impersonate `authenticated` | Migration creates `kaito_api_login NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS`, grants only membership needed for `SET ROLE authenticated`, and no table grants. Operations add password/`LOGIN` outside migrations. Configuration accepts literal expected role `kaito_api_login`; unsupported hosting fails closed or needs a new PostgREST design. |

## Fail-Closed Role Guard and Data Flow

At FastAPI lifespan startup (never module import), require `DATABASE_URL` and expected role configuration, open a transaction, and execute this guard **before any `SET ROLE`**:

```sql
SELECT session_user = :expected,
       current_user = session_user,
       NOT r.rolsuper, NOT r.rolbypassrls,
       nullif(current_setting('request.jwt.claims', true), '') IS NULL
FROM pg_catalog.pg_roles r WHERE r.rolname = session_user;
```

No row/false result disposes the engine and aborts startup with sanitized `DatabaseConfigurationError`. The guard starts every owner transaction; ability to `SET ROLE` is never safety evidence. Failure rolls back, invalidates, logs a stable code, and maps to generic 503—never identities, URLs, claims, SQL, or payloads.

Only afterward: static `SET LOCAL ROLE authenticated`; parameterized `set_config('request.jwt.claims', {sub,role}, true)` from `UserContext.user_id`; assert login/effective role/`auth.uid()`, then owner-filtered CRUD. Policies use `USING` and `WITH CHECK`. Commit/rollback removes local settings; exceptions rollback/close, `pool_reset_on_return='rollback'`, reset failure invalidates, and every next transaction rechecks clean state.

`Bearer JWT -> UserContext -> guarded transaction -> local role/claims -> repository -> RLS -> JSONB`

Save clears hidden answers, validates runner-local date, and demotes invalid completion. Read revalidates/persists normalization; corrupt versions return sanitized 500.

## File Changes

| File | Action | Description |
|---|---|---|
| `supabase/config.toml`, `supabase/migrations/*_onboarding_snapshots.sql` | Create | Local stack, credential-free role/schema/RLS. |
| `apps/api/tests/integration/test_onboarding_rls.py`, `.github/workflows/ci.yml` | Create/modify | Executable proof and CI lifecycle. |
| `apps/api/app/core/{config,database}.py`, `.env.example` | Modify/create | Strict settings, engine, guard, reset. |
| `apps/api/app/modules/runner_profile/*.py`, `app/main.py` | Create/modify | Domain, repository, use cases, DTOs, router. |
| `apps/api/pyproject.toml`, `apps/api/uv.lock` | Modify | SQLAlchemy/psycopg and test dependencies; no Alembic. |

## Interfaces / Contracts

`PUT /runner-profile/onboarding` accepts `{snapshot, validation_date}`; `GET ...?validation_date=YYYY-MM-DD` returns `{snapshot, diagnostics}`. Extra owner/storage fields: 422; missing: 404; unavailable persistence: 503; corrupt storage: 500. Responses/logs omit identities/payloads.

## Executable Two-User RLS Proof

From repository root:

```bash
supabase start >/dev/null
supabase db reset --local
(cd apps/api && uv run pytest tests/integration/test_onboarding_rls.py -q)
supabase stop --no-backup
```

The fixture calls `supabase --workdir ../.. status -o json`, reads only `API_URL`, `DB_URL`, and `SERVICE_ROLE_KEY` without printing, creates an in-memory random role password, and uses admin DB only to `ALTER ROLE kaito_api_login LOGIN PASSWORD ...`. It creates two random Auth users through local Admin API. They are **claim identities, not database logins**: assertions connect as `kaito_api_login`, guard, then transaction-locally adopt one user’s `{sub,role:"authenticated"}`.

For each user, RED tests prove cross insert denial while target rows are absent; own inserts/select/update/delete affect one row; cross select/update/delete affect zero without mutation. They assert login attributes, effective role, and `auth.uid()`. `finally` deletes users/rows and sets `NOLOGIN PASSWORD NULL`; cleanup failure fails the suite. No tracing, secret files, DSNs, keys, emails, or UUIDs reach output. CI installs a pinned CLI, runs these commands, and always stops; any failure fails CI.

## Testing Strategy

Unit/API tests cover lifecycle, owner rejection, rollback/reset, both guards, and sanitization. Docker integration proves policy; admin access is setup/cleanup only.

## Threat Matrix

| Boundary | Applicability | Design response | Planned RED tests |
|---|---|---|---|
| Documentation-like paths | N/A — one fixed pytest path; no executable classification | None | None |
| Git repository selection | N/A — no Git invocation | None | None |
| Commit state | N/A — no commit automation | None | None |
| Push state | N/A — no push automation | None | None |
| PR commands | N/A — no PR command composition | None | None |

## Migration / Rollout

Two automatic chained slices, each under 400 authored changed lines: **(1)** Supabase migration, test dependency, RLS proof, CI—verified above and removable without API changes; **(2)** dependent guarded runtime, API, unit/API tests—rollback removes composition/runtime while preserving data. Destructive removal needs an authorized forward migration. UI, planning, analytics, history, Alembic, and broad docs remain excluded.

## Open Questions

None.
