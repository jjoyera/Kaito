# Apply Progress: Implement Onboarding Persistence and RLS

## Cumulative Tasks
- [x] 1.1–1.5 Slice 1 foundation and executable RLS proof (historical state retained).
- [ ] 2.1–2.6 Slice 2 guarded runner-profile runtime.

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
| Budget | N/A — nonbehavioral review limit. | 387 authored additions+deletions; generated lockfile excluded. | Compacted integration helpers. |

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
- PR 1: 397 authored additions+deletions: migration 85, test 238, config 1, CI 17, ignore 2, API config 5, task-state 10, progress 39. `uv.lock`: 161 generated additions, separately reported and excluded.
- No commit, push, PR, review, archive, agent, product-scope change, or Slice 2 work occurred.

## Historical Evidence Correction
The prior `8 passed` correction and its claimed raw RED are retained as historical records but superseded: the old cross-insert used `ON CONFLICT`, cleanup did not retain partial users, and role coverage was incomplete. This artifact does not represent its RED as evidence for this remediation.
