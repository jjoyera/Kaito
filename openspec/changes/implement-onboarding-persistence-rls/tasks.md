# Tasks: Implement Onboarding Persistence and RLS

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 1,180–1,800 |
| 400-line budget risk | High — obsolete; current cap is 2,500 |
| Chained PRs recommended | No |
| Suggested split | One PR on `feat/onboarding-persistence-21-pr2` |
| Delivery strategy / chain | single-pr-default / size-exception (approved cap) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

### Suggested Work Units

| Unit | Start → completion evidence | PR dependency/target | Focused command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Groundwork → current iteration ready | One PR | `cd apps/api && uv run pytest tests/runner_profile/test_domain.py -q` | N/A — value objects only | onboarding value-object files; remove/defer `PlanApproach` |
| 2 | Repository/use cases → green | Same PR | `cd apps/api && uv run pytest tests/runner_profile/test_use_cases.py -q` | Guarded transaction fakes | repository/use-case files and tests |
| 3 | Protected API → verified | Same PR | `cd apps/api && uv run pytest tests/runner_profile/test_router.py -q` | FastAPI TestClient + verified context | schemas/router/composition files |

## Phase 1: Prepare Iteration and Preserve Foundation

- [x] 1.1 **RED:** `apps/api/tests/integration/test_onboarding_rls.py` proves two-user own CRUD, cross insert denial, and cross select/update/delete isolation with role/`auth.uid()` assertions.
- [x] 1.2 **GREEN:** `supabase/config.toml` and migration add the current JSONB snapshot, invariants, timestamps, and authenticated owner-only RLS.
- [x] 1.3 **GREEN:** Migration hardens `kaito_api_login`; add SQLAlchemy/psycopg dependencies and lockfile, never Alembic.
- [x] 1.4 **GREEN:** Integration fixture uses local credentials in memory, creates two users, and sanitizes/fails closed during cleanup.
- [x] 1.5 **REFACTOR/verify:** Pin the Supabase CLI Docker lifecycle in `.github/workflows/ci.yml`; run the matrix and always stop.
- [x] 1.6 Remove `PlanApproach` and its tests from the Issue #21 scope.

## Phase 2: Repository and Use-Case TDD

- [x] 2.1 **RED:** `apps/api/tests/runner_profile/test_database.py` covers the exact pre-role guard, rollback/invalidate, and pool reset recheck.
- [x] 2.2 **GREEN:** Add guarded `app/core/database.py`, strict config, and `.env.example`; assert local role/claims and map failures to sanitized 503.
- [x] 2.3 **RED:** `apps/api/tests/runner_profile/test_use_cases.py` covers malformed/unknown no-mutation, drafts, demotion, hidden clearing, corrupt reads, sanitized 503, and dates.
- [x] 2.4 **GREEN:** Add owner-filtered `repository.py` and `use_cases.py`; use atomic upsert, no repository commits, and canonical validation at both boundaries.

## Phase 3: Protected API TDD

- [x] 3.1 **RED:** `apps/api/tests/runner_profile/test_router.py` covers protected PUT/GET, owner/storage 422, missing 404, and sanitized failures.
- [x] 3.2 **GREEN:** Add `schemas.py`, `router.py`, and `app/main.py` composition using verified `UserContext`; return snapshot and diagnostics only.

## Phase 4: Refactor and Verification

- [x] 4.1 **REFACTOR:** Remove duplication without changing guards, lifecycle normalization, owner scoping, or safe observability.
- [x] 4.2 **VERIFY:** Run focused suites, full pytest, Ruff, portable paths, diff check, lifecycle receipt, and final authored count <=2,500. Exclude UI, plans, history, Alembic, and broad docs. Verification passed; no receipt exists, covered only by the explicit maintainer tooling-incident exception.
