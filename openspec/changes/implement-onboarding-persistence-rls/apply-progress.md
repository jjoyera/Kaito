# Apply Progress: Implement Onboarding Persistence and RLS

## Cumulative Tasks
- [x] 1.1–1.5 Slice 1 foundation and executable RLS proof (historical state retained).
- [x] 2.1–2.2 PR2A guarded database runtime (post-remediation evidence passes).
- [ ] 2.3–2.6 PR2B/2C-only runtime work.

## Focused Remediation (Slice 1)
- Cross-owner insert uses a plain `INSERT` while the foreign row is absent, verifies denial and admin-visible zero rows; separate data-present tests cover select/update/delete.
- Correction `review-4213e0b0b813b578`: RED target count was 0 with decoys, owner-scoped proof raised `NameError`, and `SET FALSE` did not raise; failure injection already passed before implementation. GREEN `20 passed in 4.23s` proves target `conrelid`, owner-only deletion, fail-closed membership, and exact sanitized cleanup continuation.
- Proof-isolation correction: each unsafe attribute case resets `NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION`, grants only non-admin `authenticated`, then injects exactly one attribute; extra membership and admin-option cases reset independently.
- The temporary test login is revoked immediately after each connection; every case restores the safe role in `finally`, direct table-grant denial remains asserted, and generated `apps/api/uv.lock` is excluded from authored review count.

## Strict-TDD Evidence (truthful)
| Work | RED | GREEN | REFACTOR |
|---|---|---|---|
| Absent-row insert | Test was written before migration edits, but the first Docker reset returned transient 502; no valid behavior RED was captured. | Focused Docker harness: `15 passed in 3.04s`. | Split absent-row INSERT from foreign-row data-access matrix. |
| Partial setup cleanup | Failure-injection test was written first; it passes after immediate recording and aggregate cleanup helper. | `15 passed in 3.04s`; tests prove actions after a failure run and error text omits opaque identity. | Compact action-list helper. |
| Role hardening | Attribute/membership tests were written first; transient reset blocked the first execution. This proof-isolation correction records no reconstructed RED. | Docker focused harness: `18 passed in 3.91s`. | Safe baseline/reset helper plus temporary connection login. |
| Budget | N/A — nonbehavioral review limit. | 399 authored additions+deletions; generated lockfile excluded. | Compacted integration helpers. |

**Strict-TDD gate:** Maintainer exception accepted on 2026-07-13 only for the missing historical RED in absent-row insert and role hardening after a transient Supabase reset 502. No RED was reconstructed; all current GREEN, isolation, cleanup, and safety-net evidence remains mandatory, and strict TDD stays active for every other task.

## Work Unit Evidence
| Evidence | Exact result |
|---|---|
| Focused test | Pinned start succeeded; reset applied migration then exited 502 on restart; direct focused run → exit 0, `20 passed in 4.23s`. |
| Runtime harness | Docker-backed local Supabase; 7 isolated unsafe attributes plus extra/admin membership reruns failed for the migration's safe error, then reset; `stop --no-backup` ran and `.temp/.branches` is absent. |
| API safety net | `cd apps/api && uv run ruff check . && uv run pytest tests/ -q --ignore=tests/integration && uv sync --frozen` → pass, `70 passed, 343 warnings`; warnings are dependency deprecations. |
| Hygiene | `node scripts/check-portable-paths.mjs` and `git diff --check` → exit 0. |
| Rollback | Revert migration, integration proof, API dependency config/lock, CI, ignore entries, task-state delta, and this progress; Slice 2/data remain untouched. |

## Delivery and Budget
- Stacked-to-main PR 1: Slice 1 only; PR 2 remains runtime-only.
- PR 0 planning: 377 authored additions (exploration 96, proposal 62, design 85, spec 93, tasks 41).
- PR 1: 399 authored additions+deletions: migration 85, test 238, config 1, CI 17, ignore 2, API config 5, task-state 12, progress 39. `uv.lock`: 161 generated additions, separately reported and excluded.
- Reviews include corrections `review-4213e0b0b813b578` and `review-7e808ebfd3998846`; the latter RED was `2 failed, 19 passed` for inherited membership/non-UTC accuracy and GREEN was `21 passed in 4.07s` with retry preservation. No new commit, push, PR, archive, agent, product-scope change, or Slice 2 work occurred.

## Historical Evidence Correction
The prior `8 passed` correction and its claimed raw RED are retained as historical records but superseded: the old cross-insert used `ON CONFLICT`, cleanup did not retain partial users, and role coverage was incomplete. This artifact does not represent its RED as evidence for this remediation.

## PR 2A Remediation (2026-07-13)
- Slice 1 history retained. [x] 2.1/2.2 guard/reuse, sanitized 503/logs/disposal; [ ] 2.3–2.6 PR2B/2C-only.
| TDD task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 2.1 | Dirty reuse already passed; no RED fabricated. | Focused suite passes. | One connection proof. |
| 2.2 | Logging `1 failed`; disposal `2 failed, 2 passed`; traceback chains `2 failed, 23 passed`. | Focused suite passes. | Shared fakes. |
| Work unit | Exact result |
|---|---|
| Focused/runtime | PR2A follow-up RED: `3 failed, 27 passed`; GREEN: focused `30 passed, 196 warnings`, non-integration `91 passed, 431 warnings`; TestClient/fake owner exercise startup and transactions; frozen sync/Ruff/portable paths/diff check pass. |
| Rollback/delivery | Revert PR2A core/config/main/env/tests/artifacts only; stacked-to-main after PR1, no PR2B/2C behavior. |
