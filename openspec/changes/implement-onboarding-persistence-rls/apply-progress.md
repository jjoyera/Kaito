# Apply Progress: Implement Onboarding Persistence and RLS

## Cumulative Tasks

- [x] 1.1–1.5 Slice 1 foundation and executable RLS proof (historical state retained).
- [x] 1.6 Removed the out-of-scope `PlanApproach` value object and its domain test coverage.
- [x] 2.1–2.2 PR2A guarded database runtime (post-remediation evidence passes).
- [x] 2.3 PR2B use-case RED contract tests (implementation intentionally deferred).
- [x] 2.4 PR2B repository/use-case GREEN implementation.
- [x] 3.1 PR2C protected API RED contract tests.
- [x] 3.2 PR2C protected API GREEN composition.
- [x] 4.1 PR2C behavior-preserving refactor.
- [ ] 4.2 PR2C final verification work.

## Focused Remediation (Slice 1)

- Cross-owner insert uses a plain `INSERT` while the foreign row is absent, verifies denial and admin-visible zero rows; separate data-present tests cover select/update/delete.
- Correction `review-4213e0b0b813b578`: RED target count was 0 with decoys, owner-scoped proof raised `NameError`, and `SET FALSE` did not raise; failure injection already passed before implementation. GREEN `20 passed in 4.23s` proves target `conrelid`, owner-only deletion, fail-closed membership, and exact sanitized cleanup continuation.
- Proof-isolation correction: each unsafe attribute case resets `NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION`, grants only non-admin `authenticated`, then injects exactly one attribute; extra membership and admin-option cases reset independently.
- The temporary test login is revoked immediately after each connection; every case restores the safe role in `finally`, direct table-grant denial remains asserted, and generated `apps/api/uv.lock` is excluded from authored review count.

## Strict-TDD Evidence (truthful)

| Work | RED | GREEN | REFACTOR |
| --- | --- | --- | --- |
| Absent-row insert | Test was written before migration edits, but the first Docker reset returned transient 502; no valid behavior RED was captured. | Focused Docker harness: `15 passed in 3.04s`. | Split absent-row INSERT from foreign-row data-access matrix. |
| Partial setup cleanup | Failure-injection test was written first; it passes after immediate recording and aggregate cleanup helper. | `15 passed in 3.04s`; tests prove actions after a failure run and error text omits opaque identity. | Compact action-list helper. |
| Role hardening | Attribute/membership tests were written first; transient reset blocked the first execution. This proof-isolation correction records no reconstructed RED. | Docker focused harness: `18 passed in 3.91s`. | Safe baseline/reset helper plus temporary connection login. |
| Budget | N/A — nonbehavioral review limit. | 399 authored additions+deletions; generated lockfile excluded. | Compacted integration helpers. |

**Strict-TDD gate:** Maintainer exception accepted on 2026-07-13 only for the missing historical RED in absent-row insert and role hardening after a transient Supabase reset 502. No RED was reconstructed; all current GREEN, isolation, cleanup, and safety-net evidence remains mandatory, and strict TDD stays active for every other task.

## Work Unit Evidence

| Evidence | Exact result |
| --- | --- |
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

## PR 2B Groundwork — Domain Value Objects (2026-07-14)

- Added minimal immutable domain value objects for onboarding and near-term planning use cases: `UserId`, `OnboardingState`, `PlanApproach`, positive measurements, `TargetDate`, `WeeklyAvailability`, and leakage-safe `OnboardingSnapshot`.
- Verification: focused domain tests passed (`37 passed`), API non-integration suite passed (`129 passed`, one pre-existing JWT warning), Ruff passed, portable-paths passed, `git diff --check` passed, and diagnostics for the new files were clean.
- Scope guard: no repository, use-case, router, endpoint, persistence, or task checkbox behavior was added; tasks 2.3–2.6 remain open.
- Delivery note: files are staged locally, but the commit is blocked by the Gentle lifecycle gate because review receipt creation currently fails with `EPERM: operation not permitted, fsync`.

## Current Delivery Policy (2026-07-14)

- Current branch: `feat/onboarding-persistence-21-pr2`; execution mode is interactive and artifact storage is hybrid.
- Issue #21 PR 2 is one PR capped at 2,500 authored changed lines. The former 400-line rule and chained-PR plan remain historical PR 1 evidence only.
- Lifecycle receipt, strict RED-GREEN-REFACTOR TDD, verification gates, and final authored-line counting remain mandatory. Plan generation/eligibility/analytics, UI #22, history/audit, Alembic, Node upgrade, and broad architecture reconciliation remain out of scope.

## Task 1.6 — Remove Out-of-Scope PlanApproach (2026-07-14)

- Removed only `PlanApproach` from `runner_profile.domain` and its import/value assertions from the domain test suite. No other value object, repository, use case, router, or persistence behavior changed.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 1.6 | `apps/api/tests/runner_profile/test_domain.py` | Unit | `37 passed in 0.05s` | Temporary absence assertion: `1 failed, 37 passed in 0.19s` because `PlanApproach` existed. | Removed the enum: `38 passed in 0.08s`. | Skipped: structural removal has one valid final state (the symbol is absent). | Removed the temporary proof and obsolete import/assertions: `37 passed in 0.08s`. |

### Work Unit Evidence

| Evidence | Exact result |
|---|---|
| Focused test command and exact result | `cd apps/api && uv run pytest tests/runner_profile/test_domain.py -q` → exit 0, `37 passed in 0.08s`. |
| Runtime harness command/scenario and exact result | N/A — this is a pure domain-symbol removal with no runtime boundary; the focused pytest suite exercises the remaining domain contract. |
| Rollback boundary | Revert only the `PlanApproach` enum deletion, its test import/value assertions, task 1.6 checkbox, and this evidence section; no unrelated value objects or runtime code are affected. |

### Delivery

- Mode: single PR with maintainer-approved `size:exception`, capped at 2,500 authored changed lines.
- Work unit: onboarding-only foundation cleanup.

## Task 2.3 — Use-Case RED Contract Tests (2026-07-14)

- Added behavior-first use-case tests for malformed/unknown snapshot rejection with no transaction, sparse drafts, completed-state demotion, hidden restriction-detail clearing, corrupt persisted reads, sanitized persistence failure, and explicit local-date validation.
- Added `use_cases.py` only as an import-safe executable-contract scaffold: approved immutable types, protocols, failure declarations, and `save_onboarding`/`read_onboarding` signatures. Both functions explicitly raise `NotImplementedError`; no persistence, normalization, mapping, transaction, or error-handling behavior exists.
- The first scaffold execution exposed only an invalid `ContextManager` import; it was corrected before recording RED evidence. The valid RED command then collected all tests and failed only at the intentionally unimplemented use-case functions.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 2.3 | `apps/api/tests/runner_profile/test_use_cases.py` | Unit with transaction/repository fakes | N/A — new test file | `uv run pytest tests/runner_profile/test_use_cases.py -q` → exit 1, `8 failed in 0.14s`; every failure reaches the explicit `NotImplementedError` scaffold body. | Not run — intentionally deferred to task 2.4. | Eight distinct contract scenarios: malformed, unknown version, draft, demotion, clearing, corrupt read, sanitized failure, and date. | Not run — RED-only task; no production behavior to refactor. |

### Work Unit Evidence

| Evidence | Exact result |
|---|---|
| Focused test command and exact result | `cd apps/api && uv run pytest tests/runner_profile/test_use_cases.py -q` → exit 1, `8 failed in 0.14s`; all failures are expected `NotImplementedError` at `save_onboarding` or `read_onboarding`, after successful collection. |
| Runtime harness command/scenario and exact result | N/A — task 2.3 is deliberately RED-only. The fakes exercise the future use-case transaction/repository seam, but a real runtime boundary cannot exist until task 2.4 implements that approved behavior. |
| Rollback boundary | Revert only `apps/api/tests/runner_profile/test_use_cases.py`, the import-safe `apps/api/app/modules/runner_profile/use_cases.py` scaffold, task 2.3 checkbox, and this Task 2.3 evidence; no existing runtime behavior is removed. |

### Delivery

- Mode: single PR with maintainer-approved `size:exception`, capped at 2,500 authored changed lines.
- Historical task 2.3 boundary: it ended at confirmed RED; task 2.4 subsequently completed the GREEN implementation.

## Task 2.4 — Repository/Use-Case GREEN (2026-07-14)

- Added canonical parse/normalization that preserves typed sparse drafts, rejects malformed and unsupported versions before a transaction, clears hidden restriction and modality fields, and demotes completion-invalid snapshots using only the supplied local validation date.
- Added owner-filtered SQLAlchemy repository read and atomic `ON CONFLICT` upsert. Repository methods neither commit nor roll back; the transaction factory delegates the single transaction to guarded `owner_connection`.
- Save and read derive `UserId` exclusively from verified `UserContext`; results contain only the immutable canonical snapshot and diagnostics. Read revalidation persists only normalization changes; corrupt stored data does not upsert. Persistence errors map to `service_unavailable` without raw details.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 2.4 | `apps/api/tests/runner_profile/test_use_cases.py`, `test_repository.py` | Unit with transaction/repository fakes | Existing 2.3 RED: `8 failed in 0.21s`, each at the approved `NotImplementedError`; no unrelated pre-existing failure. | Existing use-case RED was written first by 2.3. Additional repository RED: `uv run pytest tests/runner_profile/test_repository.py -q` → exit 1, `2 failed in 0.13s`, missing `repository` module. A missing-read test then RED: `1 failed in 0.23s`. | `uv run pytest tests/runner_profile/test_use_cases.py tests/runner_profile/test_repository.py -q` → exit 0, `11 passed in 0.44s`. | Eleven paths cover malformed/unknown no-transaction behavior, sparse draft, demotion, clearing, corrupt/missing read, sanitized failure, explicit date, atomic upsert/no commits, and owner-filtered read. | Simplified transaction-control ownership and imports, then reran focused GREEN: `11 passed in 0.44s`. |

### Work Unit Evidence

| Evidence | Exact result |
|---|---|
| Focused test command and exact result | `cd apps/api && uv run pytest tests/runner_profile/test_use_cases.py tests/runner_profile/test_repository.py -q` → exit 0, `11 passed in 0.44s`. |
| Runtime harness command/scenario and exact result | Guarded transaction/repository harness in the focused suite → exit 0, `11 passed in 0.44s`; it exercises owner-derived transaction entry, owner-filtered SQL construction, atomic upsert, no repository transaction control, and clean transaction exit before missing/corrupt domain failures. API composition is explicitly deferred to 3.2. |
| Regression commands and exact result | `cd apps/api && uv run pytest tests/runner_profile/test_domain.py tests/runner_profile/test_database.py -q` → exit 0, `51 passed in 0.47s`; `git diff --check` → exit 0. |
| Rollback boundary | Revert only `apps/api/app/modules/runner_profile/{repository,use_cases,validation}.py`, `apps/api/tests/runner_profile/test_repository.py`, task 2.4 checkbox, and this Task 2.4 evidence. This removes the uncomposed persistence/use-case behavior without router, schema, or application composition changes. |

### Delivery

- Mode: single PR with maintainer-approved `size:exception`, capped at 2,500 authored changed lines.
- Work unit: repository/use-cases GREEN; stops before schemas, router, and application composition.

## Task 3.1 — Protected API RED Contract Tests (2026-07-14)

- Added behavior-first FastAPI TestClient contracts for protected `PUT` and `GET /runner-profile/onboarding`. The tests require the exact save/read payload and response shape, explicit `validation_date`, strict client owner/storage-field rejection, missing-snapshot mapping, corrupt-data mapping, and sanitized persistence-unavailable mapping.
- Added only import-safe task-3.1 scaffolding: a strict save request DTO and protected router declarations with explicit 501 placeholder handlers. The test fixture composes this router into a local FastAPI app only; `app/main.py` remains untouched, no transaction factory is wired, and no persistence/use-case behavior or HTTP error mapping was implemented.
- The first test execution exposed a TestClient API misuse for `GET(json=...)`; the test was corrected before final evidence. The final run collects every scenario and fails only where the intentionally unimplemented handlers return 501 instead of the approved 200/404/500/503 contracts.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 3.1 | `apps/api/tests/runner_profile/test_router.py` | FastAPI TestClient integration | N/A — new test file and import-safe declarations only | `cd apps/api && uv run pytest tests/runner_profile/test_router.py -q` → exit 1, `5 failed, 4 passed in 0.67s`. Each failure reaches a declared protected placeholder and receives 501, not a missing import/route. | Not run — task 3.2 owns the implementation/composition. | Nine executable requests cover unauthenticated PUT/GET, save/read contracts with date, two forbidden fields, missing, corrupt, and unavailable outcomes. | Not run — RED-only task; no production behavior exists to refactor. |

### Work Unit Evidence

| Evidence | Exact result |
|---|---|
| Focused test command and exact result | `cd apps/api && uv run pytest tests/runner_profile/test_router.py -q` → exit 1, `5 failed, 4 passed in 0.67s`. The four passing requests prove real framework protections: unauthenticated PUT/GET return 401 and outer `owner_id`/`created_at` fields return 422. The five approved endpoint contracts are RED because the scaffold returns 501. |
| Runtime harness command/scenario and exact result | Same focused command uses FastAPI `TestClient` with the actual `get_current_user` JWT dependency and a local app that includes only the runner-profile router. It runs without network or database access; 5 intended RED / 4 framework-contract passes. |
| Rollback boundary | Revert only `apps/api/tests/runner_profile/test_router.py`, `apps/api/app/modules/runner_profile/{schemas,router}.py`, the task 3.1 checkbox, and this Task 3.1 evidence. This removes the uncomposed HTTP contract scaffold without affecting `app/main.py`, persistence, or prior use-case behavior. |

### Delivery

- Mode: single PR with maintainer-approved `size:exception`, capped at 2,500 authored changed lines.
- Work unit: confirmed API RED only; task 3.2 remains unchecked and owns handler behavior, exception mapping, and `app/main.py` composition.

## Task 3.2 — Protected API GREEN Composition (2026-07-14)

- Replaced the protected route placeholders with use-case calls that derive ownership exclusively from the verified `UserContext` supplied by `get_current_user`.
- Added a request-scoped transaction-factory dependency that reads `app.state` only after lifespan startup; `app/main.py` constructs `SqlAlchemyOwnerTransactionFactory` only after the existing guarded database check, so imports never open connections.
- Composed the runner-profile router without changing auth, middleware, lifespan failure handling, or Sentry initialization. Responses serialize only canonical `snapshot` and `diagnostics`; error details are fixed and sanitized.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 3.2 | `apps/api/tests/runner_profile/test_router.py`, `apps/api/tests/test_main.py` | FastAPI TestClient integration | `cd apps/api && uv run pytest tests/test_main.py -q` → exit 0, `17 passed in 1.16s`. Router baseline is the intentional 3.1 RED, not a pre-existing failure. | Existing 3.1 behavior contracts: `cd apps/api && uv run pytest tests/runner_profile/test_router.py -q` → exit 1, `5 failed, 4 passed in 0.69s`, all five at 501 placeholders. New composition RED: `cd apps/api && uv run pytest tests/test_main.py::test_app_composes_the_protected_onboarding_router -q` → exit 1, `1 failed in 1.17s`; production app lacked `/runner-profile/onboarding`. | `cd apps/api && uv run pytest tests/runner_profile/test_router.py tests/test_main.py::test_app_composes_the_protected_onboarding_router tests/runner_profile/test_use_cases.py tests/runner_profile/test_repository.py -q` → exit 0, `21 passed in 1.15s`. | Router contracts exercise authenticated PUT/GET success, explicit date, strict owner/storage rejection, missing, corrupt, and unavailable branches; production composition adds the real-app route assertion. | Local serialization cleanup recursively converts immutable mappings/tuples before FastAPI encoding; reran focused GREEN with `21 passed in 1.15s`. No task 4.1 refactor was performed. |

### Work Unit Evidence

| Evidence | Exact result |
|---|---|
| Focused test command and exact result | `cd apps/api && uv run pytest tests/runner_profile/test_router.py tests/test_main.py::test_app_composes_the_protected_onboarding_router tests/runner_profile/test_use_cases.py tests/runner_profile/test_repository.py -q` → exit 0, `21 passed in 1.15s`. |
| Runtime harness command/scenario and exact result | Same command uses FastAPI `TestClient`, real JWT-backed `get_current_user`, protected PUT/GET routes, and test-local owner transaction/repository fakes. It verifies owner identity originates from the verified dependency and covers 200/404/500/503 responses without network or database access: exit 0, `21 passed in 1.15s`. |
| Relevant regressions | `cd apps/api && uv run pytest tests/auth/test_auth_me.py tests/auth/test_dependency.py tests/test_main.py tests/runner_profile/test_domain.py tests/runner_profile/test_database.py -q` → exit 0, `84 passed in 1.13s`. |
| Hygiene | `cd apps/api && uv run ruff check app/main.py app/modules/runner_profile/router.py app/modules/runner_profile/schemas.py tests/runner_profile/test_router.py tests/test_main.py` → exit 0, `All checks passed!`; `git diff --check` → exit 0. |
| Rollback boundary | Revert only `apps/api/app/main.py`, `apps/api/app/modules/runner_profile/router.py`, `apps/api/tests/runner_profile/test_router.py`, `apps/api/tests/test_main.py`, task 3.2 checkbox, and this evidence. This disables API composition while preserving the existing persistence/use-case implementation and stored data. |

### Delivery

- Mode: single PR with maintainer-approved `size:exception`, capped at 2,500 authored changed lines.
- Work unit: protected API GREEN; starts at the confirmed 3.1 RED contracts and ends with router behavior plus guarded app composition. It does not perform task 4.1 refactor or task 4.2 final verification.

## Task 4.1 — Behavior-Preserving Refactor (2026-07-14)

- Inspected the onboarding persistence call path and found one concrete duplicate condition in `read_onboarding`: an explicit state comparison duplicated the state comparison already performed by `_normalized_changed`.
- Removed only that redundant comparison. The existing helper still compares contract version, lifecycle state, profile, and goal before deciding whether normalized data is atomically persisted.
- No guards, transaction boundaries, owner derivation/filtering, lifecycle normalization/demotion/clearing, public HTTP contracts, immutable response serialization, or sanitized observability changed.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 4.1 | `apps/api/tests/runner_profile/test_{domain,use_cases,repository,router,database}.py`, `apps/api/tests/test_main.py` | Unit and FastAPI TestClient integration | `cd apps/api && uv run pytest tests/runner_profile/test_domain.py tests/runner_profile/test_use_cases.py tests/runner_profile/test_repository.py tests/runner_profile/test_router.py tests/test_main.py tests/runner_profile/test_database.py -q` → exit 0, `89 passed in 1.55s`. | N/A — behavior-preserving refactor; existing contract tests are the approval safety net and no RED was fabricated. | Same focused suite after the one-line cleanup → exit 0, `89 passed in 1.64s`. | Existing suite spans lifecycle normalization, owner scoping, atomic upsert, API failure mapping, and guarded composition. | Removed the duplicate state comparison; reran the full focused safety net immediately after the single cleanup. |

### Work Unit Evidence

| Evidence | Exact result |
|---|---|
| Focused test command and exact result | Before: `cd apps/api && uv run pytest tests/runner_profile/test_domain.py tests/runner_profile/test_use_cases.py tests/runner_profile/test_repository.py tests/runner_profile/test_router.py tests/test_main.py tests/runner_profile/test_database.py -q` → exit 0, `89 passed in 1.55s`. After: same command → exit 0, `89 passed in 1.64s`. |
| Runtime harness command/scenario and exact result | The same focused suite includes FastAPI TestClient contracts with the real JWT-backed dependency and test-local owner transaction/repository fakes; it exercises protected PUT/GET success and 404/500/503 mappings without a network/database. After refactor → exit 0, `89 passed in 1.64s`. |
| Relevant regressions | `cd apps/api && uv run ruff check app/modules/runner_profile/use_cases.py` → exit 0, `All checks passed!`; `git diff --check` → exit 0. |
| Rollback boundary | Revert only the redundant condition removal in `apps/api/app/modules/runner_profile/use_cases.py`, this task 4.1 checkbox/evidence, and the mirrored Engram state. The existing normalization helper and all unrelated persistence/API behavior remain intact. |

### Delivery

- Mode: single PR with maintainer-approved `size:exception`, capped at 2,500 authored changed lines.
- Work unit: narrowly scoped onboarding persistence cleanup; no commit, push, PR, bounded review, or task 4.2 verification was performed.

## Pre-review Verification — Task 4.2 Remediation Retry (2026-07-14)

- Status: **blocked/failed**. The Ruff blocker is corrected, but the integration-inclusive API suite failed before the remaining required gates. Task 4.2 remains unchecked; the lifecycle receipt is still missing.
- Correction scope was limited to `validation.py`, `test_repository.py`, and `test_use_cases.py`. Ruff safe autofix sorted imports; Ruff formatting wrapped style-only lines; the final overlong test identifier was shortened. Assertions and production behavior were not changed.
- Strict TDD remains active. This mechanical lint correction uses the pre-change focused suite as approval coverage; no behavioral RED was fabricated.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 4.2 remediation retry | Existing runner-profile, application, and API suites | Verification / approval coverage | Focused suite before correction → exit 0, `89 passed in 2.07s`. | N/A — import ordering and line wrapping only; no behavioral test was added or fabricated. | Candidate-file Ruff → exit 0, `All checks passed!`; post-correction focused suite → exit 0, `89 passed in 1.35s`. | N/A — no behavior changed. | Ruff formatting only; full verification stopped at integration-inclusive suite failure. |

### Command Evidence

| Check | Command | Exit / exact result | Notes |
|---|---|---|---|
| Safety net before correction | `cd apps/api && uv run pytest tests/runner_profile/test_domain.py tests/runner_profile/test_use_cases.py tests/runner_profile/test_repository.py tests/runner_profile/test_router.py tests/test_main.py tests/runner_profile/test_database.py -q` | exit 0; `89 passed in 2.07s` | Existing approval coverage. |
| Authorized Ruff correction | `cd apps/api && uv run ruff check --fix app/modules/runner_profile/validation.py tests/runner_profile/test_repository.py tests/runner_profile/test_use_cases.py` | exit 1; `Found 31 errors (1 fixed, 30 remaining)` | Safe autofix resolved import ordering only. |
| Authorized Ruff formatting | `cd apps/api && uv run ruff format app/modules/runner_profile/validation.py tests/runner_profile/test_repository.py tests/runner_profile/test_use_cases.py` | exit 0; `3 files reformatted` | Style-only wrapping; one remaining long test name was shortened without changing its body. |
| Candidate-file Ruff | `cd apps/api && uv run ruff check app/modules/runner_profile/validation.py tests/runner_profile/test_repository.py tests/runner_profile/test_use_cases.py` | exit 0; `All checks passed!` | Corrected candidate files are clean. |
| Focused onboarding suite | command above | exit 0; `89 passed in 1.35s` | Re-run after correction; includes FastAPI TestClient coverage. |
| Configured complete non-integration API suite | `cd apps/api && uv run pytest tests/ --ignore=tests/integration -q` | exit 0; `150 passed, 1 warning in 2.06s` | Existing JWT `InsecureKeyLengthWarning` for the intentionally short test key. |
| Supabase lifecycle setup | `npx supabase@2.39.2 start` then `npx supabase@2.39.2 db reset --local` | exit 0; output suppressed | Pinned CI lifecycle completed before integration-inclusive execution. |
| Complete API suite including integration | `cd apps/api && uv run pytest tests/ -q` | **exit 1; `151 passed, 1 warning, 20 errors in 4.83s`** | Each RLS fixture setup errors with `FileNotFoundError: [WinError 2]` when Python invokes bare `npx`; this is an environment PATH/executable-resolution failure, not an assertion failure. |
| Frozen dependency verification | `cd apps/api && uv sync --frozen` | Not run | Hard stop after required integration-inclusive suite failure. |
| Required API Ruff | `cd apps/api && uv run ruff check .` | Not run | Hard stop after required integration-inclusive suite failure. |
| Portable paths | `node scripts/check-portable-paths.mjs` | Not run | Hard stop after required integration-inclusive suite failure. |
| Diff whitespace | `git diff --check` | Not run | Hard stop after required integration-inclusive suite failure. |
| Docker-backed RLS proof | `cd apps/api && uv run pytest tests/integration/test_onboarding_rls.py -q` | Not run separately | The integration-inclusive suite exposed the fixture executable-resolution blocker first. |
| Supabase lifecycle cleanup | `npx supabase@2.39.2 stop --no-backup` | exit 0; output suppressed | Cleanup ran after failure; no secrets or identities were emitted. |

### Work Unit Evidence

| Evidence | Exact result |
|---|---|
| Focused test command and exact result | Post-correction focused onboarding command → exit 0, `89 passed in 1.35s`. |
| Runtime harness command/scenario and exact result | Pinned Supabase start/reset succeeded, but the full API suite's RLS fixture failed before its scenarios because Python cannot resolve bare `npx` on Windows; `151 passed, 20 setup errors`. Cleanup succeeded. |
| Rollback boundary | Revert only the style-only changes in `apps/api/app/modules/runner_profile/validation.py`, `apps/api/tests/runner_profile/test_repository.py`, `apps/api/tests/runner_profile/test_use_cases.py`, and this updated evidence/mirrored Engram artifact. |

### Delivery / Receipt State

- Mode: single PR with maintainer-approved `size:exception`, capped at 2,500 authored changed lines.
- Authored changed-line count: not calculated. Required gates after the integration-inclusive suite, plus Docker RLS proof, remain incomplete; count only after all gates pass. `.codegraph/` and `.gga` remain the only pre-authorized exclusions.
- Lifecycle receipt: missing by design. Do not start review while this evidence is blocked.

## Windows `npx` Resolution Correction and Verification Retry (2026-07-14)

- Status: **blocked**. The Windows Python-to-`npx` resolution defect is corrected under Strict TDD, but Docker Desktop was unavailable when the required Supabase lifecycle began. Task 4.2 remains unchecked and no lifecycle receipt exists.
- Scope: only `apps/api/tests/integration/test_onboarding_rls.py` plus this hybrid evidence. No production files changed.
- `_resolve_npx()` resolves `npx.cmd` first, then portable `npx`, through `shutil.which`; `_status()` passes that explicit path as the first `subprocess.run` argument. The process remains list-based with `shell=False`, preserves `supabase@2.39.2`, `--workdir ../..`, captured output, and existing sanitized fixture behavior. Missing executables raise only `local_supabase_cli_unavailable`.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 4.2 Windows resolver correction | `apps/api/tests/integration/test_onboarding_rls.py` | Unit-level fixture helper | Existing Docker suite was blocked by the verified bare-`npx` `FileNotFoundError`; no unrelated assertion failure was present. | `cd apps/api && uv run pytest tests/integration/test_onboarding_rls.py -q -k resolve_npx` → exit 1, `3 failed, 21 deselected in 1.16s`; all failures were the missing `_resolve_npx` symbol. | Same command → exit 0, `3 passed, 21 deselected in 0.48s`; candidate-file Ruff also passed. | Windows shim (`npx.cmd`), portable executable (`npx`), and absent executable fail-closed behavior are distinct deterministic cases. | Extracted one small resolver; no further cleanup needed. |

### Work Unit Evidence

| Evidence | Exact result |
|---|---|
| Focused test command and exact result | `cd apps/api && uv run pytest tests/integration/test_onboarding_rls.py -q -k resolve_npx` → exit 0, `3 passed, 21 deselected in 0.48s`. |
| Runtime harness command/scenario and exact result | Supabase lifecycle could not start because the Docker Desktop Linux engine pipe was unavailable; no integration scenario ran. Cleanup was attempted and also could not contact the unavailable daemon. |
| Rollback boundary | Revert only the `shutil` import, `_resolve_npx`, its three deterministic tests, `_status()` executable argument, and this correction evidence. No production behavior, schema, credentials, identities, claims, payloads, DSNs, or secrets are affected. |

### Complete Pre-review Command Table

| Check | Command | Exit / exact result | Notes |
|---|---|---|---|
| Safety-net reproduction | `cd apps/api && uv run pytest tests/integration/test_onboarding_rls.py -q` | exit 1; `1 passed, 20 errors in 1.92s` | Verified pre-change bare `npx` `FileNotFoundError` in fixture setup. |
| RED resolver contracts | `cd apps/api && uv run pytest tests/integration/test_onboarding_rls.py -q -k resolve_npx` | exit 1; `3 failed, 21 deselected in 1.16s` | Missing resolver only. |
| GREEN resolver contracts | same command | exit 0; `3 passed, 21 deselected in 0.48s` | Windows, POSIX, and fail-closed cases. |
| Candidate-file Ruff | `cd apps/api && uv run ruff check tests/integration/test_onboarding_rls.py` | exit 0; `All checks passed!` | Resolver/test file clean. |
| Focused onboarding suite | `cd apps/api && uv run pytest tests/runner_profile/test_domain.py tests/runner_profile/test_use_cases.py tests/runner_profile/test_repository.py tests/runner_profile/test_router.py tests/test_main.py tests/runner_profile/test_database.py -q` | exit 0; `89 passed in 3.74s` | Passed before Docker lifecycle. |
| Configured non-integration API suite | `cd apps/api && uv run pytest tests/ --ignore=tests/integration -q` | exit 0; `150 passed, 1 warning in 2.63s` | Existing short-test-key warning only. |
| Supabase start/reset | `npx supabase@2.39.2 start` then `npx supabase@2.39.2 db reset --local` | exit 1 at start; reset not run | Docker Desktop Linux engine pipe unavailable; no sensitive output recorded. |
| Integration-inclusive API suite | `cd apps/api && uv run pytest tests/ -q` | Not run | Hard stop after required lifecycle gate failure. |
| Individual Docker-backed RLS proof | `cd apps/api && uv run pytest tests/integration/test_onboarding_rls.py -q` | Not run after correction | Hard stop after required lifecycle gate failure. |
| Frozen sync | `cd apps/api && uv sync --frozen` | Not run | Hard stop. |
| Full API Ruff | `cd apps/api && uv run ruff check .` | Not run | Hard stop. |
| Portable paths | `node scripts/check-portable-paths.mjs` | Not run | Hard stop. |
| Global diff whitespace | `git diff --check` | Not run | Hard stop. Focused resolver diff check passed. |
| Docker cleanup | `npx supabase@2.39.2 stop --no-backup` | exit 1 | Attempted in `finally`; Docker daemon remained unavailable. |

### Diff and Delivery State

- Inspected diff: 43 additions and 1 deletion in `apps/api/tests/integration/test_onboarding_rls.py`; one import, three deterministic test cases, one resolver, and list-based `_status()` formatting. Focused `git diff --check -- apps/api/tests/integration/test_onboarding_rls.py` passed.
- Authored-line count is intentionally not calculated: the complete required gate set did not finish. The only authorized PR exclusions remain unrelated unmodified `.codegraph/` and `.gga`; no other exclusion is asserted.
- Task 4.2 and Engram task artifact #483 remain unchecked/consistent. Do not start or finalize review, commit, push, or create a PR. Next action after Docker Desktop is available: rerun the complete task 4.2 gate sequence from scratch, then have the parent run `review/start(target)` only after a valid receipt.

## Final Pre-review Verification Rerun — Task 4.2 (2026-07-14)

- Status: **blocked**. This is a fresh verification-only rerun after the Docker Desktop Linux engine was reported ready. Task 4.2 remains unchecked because the repository-configured portable-path gate failed before Supabase lifecycle startup; no lifecycle receipt exists.
- Strict TDD remains active. No production code or tests were changed and no RED/GREEN/REFACTOR cycle was fabricated; this section validates accumulated evidence only.
- No bounded review, commit, push, or PR operation was performed.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 4.2 final verification rerun | Existing onboarding and resolver suites | Verification / accumulated approval coverage | Focused onboarding suite and resolver regression passed in this rerun. | N/A — verification-only; no test or production change. | Existing accumulated GREEN remains validated by the focused rerun. | N/A — no behavior changed. | N/A — no refactor performed. |

### Command Evidence

| Gate | Exact command | Exit / exact result | Notes |
|---|---|---|---|
| Focused onboarding suite | `cd apps/api && uv run pytest tests/runner_profile/test_domain.py tests/runner_profile/test_use_cases.py tests/runner_profile/test_repository.py tests/runner_profile/test_router.py tests/test_main.py tests/runner_profile/test_database.py -q` | exit 0; `89 passed in 2.00s` | Includes unit and FastAPI TestClient onboarding contracts. |
| Resolver regression | `cd apps/api && uv run pytest tests/integration/test_onboarding_rls.py -q -k resolve_npx` | exit 0; `3 passed, 21 deselected in 0.47s` | Validates the accumulated Windows-safe `npx.cmd`/`npx` resolver regression. |
| Complete configured non-integration API suite | `cd apps/api && uv run pytest tests/ --ignore=tests/integration -q` | exit 0; `150 passed, 1 warning in 3.31s` | Warning: existing `InsecureKeyLengthWarning` from a deliberately short test-only HMAC key. |
| Frozen dependency verification | `cd apps/api && uv sync --frozen` | exit 0; `Audited 37 packages in 9ms` | Frozen environment is synchronized. |
| Required API Ruff | `cd apps/api && uv run ruff check .` | exit 0; `All checks passed!` | No Ruff warnings. |
| Portable paths | `corepack pnpm test:portable-paths` | **exit 1; `23 passed, 2 failed`** | Both failures are trusted-Git-resolution tests reporting no trusted Git executable in fixed system locations on this Windows environment. The portable-path scanner tests passed; this remains a required configured-gate failure. |
| Diff whitespace / Supabase start-reset / integration-inclusive suite / individual Docker RLS proof / authored count | Not run | Hard stop after portable-path gate failure | No Supabase stack was started in this rerun. |
| Guaranteed Supabase cleanup | `npx supabase@2.39.2 stop --no-backup` | exit 0; output suppressed | Cleanup ran after failure; no Docker output was retained. |

### Work Unit Evidence

| Evidence | Exact result |
|---|---|
| Focused test command and exact result | Focused onboarding suite: exit 0, `89 passed in 2.00s`; resolver regression: exit 0, `3 passed, 21 deselected in 0.47s`. |
| Runtime harness command/scenario and exact result | N/A in this rerun: the required portable-path gate failed before Supabase startup. Docker-backed RLS scenarios and the integration-inclusive suite were not run; cleanup command still completed with exit 0. |
| Rollback boundary | Revert only this appended evidence section and the mirrored Engram apply-progress section. No source, test, migration, dependency, configuration, commit, or review-lifecycle behavior changed. |

### Delivery / Receipt State

- Mode: single PR with maintainer-approved `size:exception`, capped at 2,500 authored changed lines.
- Authored additions+deletions versus `main`: **not calculated**. The mandatory portable-path check failed, so the required complete gate set and final diff accounting did not complete. `.codegraph/` and `.gga` remain unrelated local untracked tooling artifacts and are excluded from the intended PR count; no additional exclusion was asserted.
- Docker cleanup: succeeded (exit 0, sanitized output). No credentials, identities, claims, payloads, SQL, DSNs, secrets, or sensitive Docker output were recorded.
- Lifecycle receipt: missing. Keep OpenSpec task 4.2 and Engram tasks artifact #483 unchecked. Do not start or finalize bounded review, commit, push, or create a PR.

## Portable-Path Fixture Correction and Complete Pre-review Retry — Task 4.2 (2026-07-14)

- Status: **blocked**. Corrected only two host-platform omissions in POSIX trusted-Git fixtures, then restarted the required verification sequence. All gates through diff whitespace passed; local Supabase reset failed with sanitized output. Cleanup completed. Task 4.2 remains unchecked and no lifecycle receipt exists.
- Authorized correction scope was honored: only `scripts/check-portable-paths.test.mjs` changed outside this evidence artifact. No resolver, approved root, PATH policy, fail-closed behavior, or security assertion changed.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 4.2 portable-path fixture correction | `scripts/check-portable-paths.test.mjs` | Node unit / security regression | Existing valid RED retained: `23 passed, 2 failed`; no duplicate RED was fabricated. | Existing two failures: POSIX `/usr/bin/git` fixtures inherited Windows host platform and therefore correctly failed closed. | `corepack pnpm test:portable-paths` → exit 0, `25 passed`, `0 failed`. | The two fixtures cover effective UID 0 and non-root writable/owner rejection paths. | None needed; fixture-only platform declaration. |
| 4.2 complete pre-review retry | Existing onboarding and resolver suites | Verification / accumulated approval coverage | Focused suites passed before lifecycle. | N/A — verification-only after the fixture GREEN. | Blocked at Supabase reset before integration-inclusive tests. | N/A — no production behavior changed. | N/A — no refactor. |

### Command Evidence

| Gate | Exact command | Exit / exact result | Notes |
|---|---|---|---|
| Fixture GREEN, immediate | `corepack pnpm test:portable-paths` | exit 0; `25 passed`, `0 failed` in `563.8615ms` | Run immediately after the two fixture declarations were added. |
| Fixture-only diff | `git diff -- scripts/check-portable-paths.test.mjs; git diff --check -- scripts/check-portable-paths.test.mjs` | exit 0 | Exactly two additions: `platform: "linux"` in the two POSIX dependency objects. Git emitted LF→CRLF checkout warnings only. |
| Focused onboarding suite | `cd apps/api && uv run pytest tests/runner_profile/test_domain.py tests/runner_profile/test_use_cases.py tests/runner_profile/test_repository.py tests/runner_profile/test_router.py tests/test_main.py tests/runner_profile/test_database.py -q` | exit 0; `89 passed in 1.86s` | Unit and FastAPI TestClient coverage. |
| Resolver regression | `cd apps/api && uv run pytest tests/integration/test_onboarding_rls.py -q -k resolve_npx` | exit 0; `3 passed, 21 deselected in 0.39s` | Existing Windows-safe resolver regression. |
| Complete non-integration API suite | `cd apps/api && uv run pytest tests/ --ignore=tests/integration -q` | exit 0; `150 passed, 1 warning in 1.91s` | Existing short test-only HMAC-key warning. |
| Frozen dependency verification | `cd apps/api && uv sync --frozen` | exit 0; `Audited 37 packages in 8ms` | Passed. |
| Full API Ruff | `cd apps/api && uv run ruff check .` | exit 0; `All checks passed!` | Passed. |
| Portable paths, complete rerun | `corepack pnpm test:portable-paths` | exit 0; `25 passed`, `0 failed` in `395.6156ms` | Passed after all preceding gates. |
| Diff whitespace | `git diff --check; git diff --cached --check` | exit 0 | LF→CRLF checkout warnings only; no whitespace errors. |
| Supabase lifecycle | `npx supabase@2.39.2 start; npx supabase@2.39.2 db reset --local` | start exit 0; reset non-zero (sanitized output) | Hard stop at reset; no credentials, identities, claims, payloads, SQL, DSNs, or Docker output retained. |
| Integration-inclusive API suite / individual Docker RLS proof / final count | Not run | Hard stop after reset failure | Required gates remain incomplete. |
| Guaranteed cleanup | `npx supabase@2.39.2 stop --no-backup` in `finally` | exit 0 | Sanitized cleanup completed. |

### Work Unit Evidence

| Evidence | Exact result |
|---|---|
| Focused test command and exact result | `corepack pnpm test:portable-paths` → exit 0, `25 passed`, `0 failed`; onboarding → exit 0, `89 passed in 1.86s`; resolver → exit 0, `3 passed, 21 deselected in 0.39s`. |
| Runtime harness command/scenario and exact result | Pinned Supabase start completed; reset failed before the integration-inclusive suite or individual two-user RLS proof. `stop --no-backup` completed with exit 0. |
| Rollback boundary | Revert only the two `platform: "linux"` fixture declarations in `scripts/check-portable-paths.test.mjs` and this appended evidence section. No production resolver or application behavior is removed. |

### Delivery / Receipt State

- Mode: one PR with maintainer-approved `size:exception`, cap 2,500 authored additions+deletions.
- Authored-line methodology/result: count `git diff --numstat main` plus intended untracked source/test/OpenSpec files, excluding only unrelated `.codegraph/` and `.gga`; **not run** because the mandatory Supabase reset gate failed. No additional exclusion is asserted.
- Lifecycle receipt: missing. Keep OpenSpec task 4.2 and Engram task artifact #483 unchecked. Do not start/finalize bounded review, commit, push, or create a PR.

## Complete Pre-review Verification — Task 4.2 (2026-07-14)

- Status: **passed**. This verification-only rerun began after stale local Supabase Vector cleanup and completed every required pre-review gate. Task 4.2 remains unchecked because no lifecycle review receipt exists.
- Strict TDD remains active. No source or test code was changed during this batch; this is accumulated-evidence validation, so no RED/GREEN/REFACTOR cycle is fabricated. No review start/finalization, commit, push, or PR operation occurred.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 4.2 complete pre-review verification | Existing onboarding, resolver, and Docker RLS suites | Verification / accumulated approval coverage | Focused onboarding and resolver suites passed in this rerun. | N/A — verification-only; no test or production change. | Existing accumulated GREEN validated by all required gates. | N/A — no behavior changed. | N/A — no refactor. |

### Command Evidence

| Gate | Exact command | Exit / exact result | Notes |
|---|---|---|---|
| Focused onboarding suite | `cd apps/api && uv run pytest tests/runner_profile/test_domain.py tests/runner_profile/test_use_cases.py tests/runner_profile/test_repository.py tests/runner_profile/test_router.py tests/test_main.py tests/runner_profile/test_database.py -q` | exit 0; `89 passed in 3.67s` | Unit and FastAPI TestClient onboarding coverage. |
| Windows npx resolver regression | `cd apps/api && uv run pytest tests/integration/test_onboarding_rls.py -q -k resolve_npx` | exit 0; `3 passed, 21 deselected in 0.34s` | Existing deterministic `npx.cmd`/portable/absent resolver coverage. |
| Complete non-integration API suite | `cd apps/api && uv run pytest tests/ --ignore=tests/integration -q` | exit 0; `150 passed, 1 warning in 2.36s` | Existing short test-only HMAC-key warning. |
| Frozen dependency verification | `cd apps/api && uv sync --frozen` | exit 0; `Audited 37 packages in 13ms` | Frozen environment synchronized. |
| Full API Ruff | `cd apps/api && uv run ruff check .` | exit 0; `All checks passed!` | Passed. |
| Portable paths | `corepack pnpm test:portable-paths` | exit 0; `25 passed`, `0 failed` in `1849.8145ms` | Passed. |
| Diff whitespace | `git diff --check; git diff --cached --check` | exit 0 | LF→CRLF checkout warnings only; no whitespace errors. |
| Pinned Supabase lifecycle | `npx supabase@2.39.2 start; npx supabase@2.39.2 db reset --local` | start exit 0; reset exit 0 | Docker output sanitized. |
| Integration-inclusive complete API suite | `cd apps/api && uv run pytest tests/ -q` | exit 0; `174 passed, 1 warning in 21.69s` | Existing short test-only HMAC-key warning. |
| Individual Docker-backed RLS proof | `cd apps/api && uv run pytest tests/integration/test_onboarding_rls.py -q` | exit 0; `24 passed in 21.46s` | Two-user owner CRUD/cross-owner isolation proof. |
| Supabase cleanup | `npx supabase@2.39.2 stop --no-backup` | exit 0 | Ran in a `finally` path; Docker output sanitized. |
| Intended PR count versus `main` | `git diff --numstat main` plus `git diff --no-index --numstat -- NUL <each intended untracked source/test file>` | `2,094` additions + `110` deletions = `2,204` changed lines; within 2,500 | Method includes staged and unstaged tracked files and intended untracked source/test files; excludes only `.codegraph/` and `.gga`. |

### Work Unit Evidence

| Evidence | Exact result |
|---|---|
| Focused test command and exact result | Onboarding suite: exit 0, `89 passed in 3.67s`; resolver regression: exit 0, `3 passed, 21 deselected in 0.34s`. |
| Runtime harness command/scenario and exact result | Pinned local Supabase start/reset, integration-inclusive suite: exit 0, `174 passed, 1 warning in 21.69s`; direct two-user RLS proof: exit 0, `24 passed in 21.46s`; cleanup exit 0. |
| Rollback boundary | Revert only this appended final-verification evidence section and its mirrored Engram apply-progress entry. No source, test, migration, dependency, configuration, commit, or review-lifecycle behavior changed in this batch. |

### Delivery / Receipt State

- Mode: one PR with maintainer-approved `size:exception`, cap 2,500 authored additions+deletions.
- The final count is recalculated after this evidence write so it includes the evidence itself. It includes all staged/unstaged tracked changes versus `main` plus all intended untracked source/test files. `.codegraph/` (including its untracked `.gitignore`) and `.gga` are the only exclusions because they are unrelated local tooling artifacts; no other path is excluded.
- Lifecycle receipt: missing. Keep OpenSpec task 4.2 and Engram tasks artifact #483 unchecked. The next action is parent `review/start(target)`.

## Final Lifecycle-Receipt Exception — Task 4.2 (2026-07-14)

- Task 4.2 is complete under the explicit maintainer-approved tooling-incident exception only. **No lifecycle receipt exists.**
- Lineage `review-cd2084abc4e0fc59`: Gentle AI 2.1.4 froze a base-only PR1 migration as candidate-introduced outside immutable PR2 genesis, then rejected correction outside genesis after entering `correction_required`.
- One time-boxed recovery was attempted and stopped: no legal transition exists from `correction_required`; no new review, hook bypass, commit, push, or PR operation occurred.
- Out-of-genesis migration/role changes were restored from the original target tree. Candidate-scoped validation fixes remain staged only in `validation.py`, `test_router.py`, and `test_use_cases.py` (162 correction lines).
- Preserved green evidence: focused corrected `28 passed`; non-integration API `160 passed`; full API `184 passed`; Docker RLS `24 passed`; full Ruff, portable paths `25 passed`, frozen sync, staged/unstaged diff checks, and Supabase start/reset/cleanup passed.
- Any manual repository exception is maintainer-owned. This record does not waive correctness evidence or authorize hook bypass.
