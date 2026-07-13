# Tasks: Implement Onboarding Persistence and RLS

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated authored changed lines | PR 0: 377 planning-only; PR 1: 387 Slice 1; PR 2: 360–395 Slice 2; total 1,124–1,159 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 0 planning artifacts → PR 1 foundation → PR 2 runtime |
| Delivery strategy / chain | auto-chain / stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Start → completion evidence | PR dependency/target | Focused command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 0 | No project → approved planning artifacts | PR 0 → `main`; none | Artifact review only | N/A — no runtime behavior | `openspec/changes/implement-onboarding-persistence-rls/{exploration,proposal,specs,design,tasks}.md`; no apply-progress |
| 1 | PR 0 merged → migration/matrix pass | PR 1 → `main`; PR 0 | `cd apps/api && uv run pytest tests/integration/test_onboarding_rls.py -q` | `supabase start; supabase db reset --local; …; supabase stop --no-backup` | `supabase/`, test, CI/deps, lockfile, apply-progress |
| 2 | PR 1 merged → protected lifecycle passes | PR 2 → `main`; PR 1 | `cd apps/api && uv run pytest tests/runner_profile tests/test_main.py -q` | TestClient + verified `UserContext`; guard fakes | `runner_profile/`, composition, tests/routes |

## Phase 1: Slice 1 — Supabase Foundation and RLS Proof

- [x] 1.1 **RED:** Create `apps/api/tests/integration/test_onboarding_rls.py`: two claim identities prove own CRUD; cross insert denial; cross select/update/delete zero/no mutation; assert login/effective role/`auth.uid()`.
- [x] 1.2 **GREEN:** Add `supabase/config.toml` and `supabase/migrations/*_onboarding_snapshots.sql`: `onboarding_snapshots(owner_id uuid PK/FK, snapshot jsonb, timestamps)`, JSONB/version/state checks, update trigger, no extra index/history, `authenticated` owner `USING`/`WITH CHECK` RLS.
- [x] 1.3 **GREEN:** Migration creates only `kaito_api_login NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS`, membership for `SET ROLE authenticated`, and no table grants; add `apps/api` SQLAlchemy/psycopg test dependencies and lockfile, never Alembic.
- [x] 1.4 **GREEN:** Fixture reads only local `API_URL`/`DB_URL`/`SERVICE_ROLE_KEY`, sets an in-memory random password, creates Auth users, and finally deletes rows/users then `NOLOGIN PASSWORD NULL`; cleanup fails closed without outputting secrets, IDs, DSNs, or payloads.
- [x] 1.5 **REFACTOR/verify:** Add pinned Supabase CLI Docker CI lifecycle in `.github/workflows/ci.yml`; run the named matrix and always stop. Keep PR 1 Issue #21-ready/linkable; do not create a PR.

## Phase 2: Slice 2 — Guarded Runner-Profile Runtime

- [ ] 2.1 **RED:** Create `apps/api/tests/runner_profile/test_database.py` for the exact pre-role `session_user=:expected`, `current_user=session_user`, `NOT rolsuper`, `NOT rolbypassrls`, and `nullif(current_setting('request.jwt.claims', true), '') IS NULL` guard; assert rollback/invalidate and `pool_reset_on_return='rollback'` recheck.
- [ ] 2.2 **GREEN:** Add `app/core/database.py`, strict `app/core/config.py`, and `.env.example`; lifespan requires `DATABASE_URL`/`kaito_api_login`, guards before `SET ROLE`, then local `authenticated`/parameterized claims and role/`auth.uid()` assertions. Map failures to sanitized stable-code 503.
- [ ] 2.3 **RED:** Create `apps/api/tests/runner_profile/test_use_cases.py` and `test_router.py` for unknown/malformed no-mutation, owner/storage 422, missing 404, corrupt 500, sanitized 503, sparse draft, completion/demotion, hidden clearing, and explicit validation date.
- [ ] 2.4 **GREEN:** Add `app/modules/runner_profile/{domain,repository,use_cases,schemas,router}.py`; ORM mapping only, owner-filtered CRUD, repository never commits, atomic upsert, before-write/after-read validation, no owner/storage/payload responses/logs.
- [ ] 2.5 **GREEN:** Compose the protected `PUT/GET /runner-profile/onboarding` router in `app/main.py` using verified `UserContext`; return `{snapshot, diagnostics}` only.
- [ ] 2.6 **REFACTOR/verify:** Remove duplication while preserving fail-closed guards and lifecycle behavior; run slice command and full `cd apps/api && uv run pytest tests/ -q`. Keep PR 2 linked to Issue #21; no UI (#22), plans, history, Alembic, or broad docs.
