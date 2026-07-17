# Apply Progress: Add Onboarding Step 4 Availability

## Work unit

- **Boundary:** Sections 1–2 only: baseline/ledger and pure availability interaction model.
- **Commit target:** `feat(onboarding): add exact availability interaction model`.
- **Commit status:** Not staged or committed, as required.
- **Delivery:** Approved single PR size exception up to 3,000 authored lines; this work unit remains independently reviewable.

## Structured status consumed

- Change: `add-onboarding-step-4-availability`
- Artifact store: `openspec`
- Apply state: `ready`
- Next recommended: `apply`
- Action context: `repo-local`; the workspace and allowed edit root are the repository root.
- Warning: tasks forecast high 400-line risk and recommend chaining; the parent provided an explicit single-PR size exception and this assigned work-unit boundary.

## Baseline and boundary evidence

| Check | Result | Notes |
| --- | --- | --- |
| `pnpm test:web-onboarding` | PASS | 62 tests passed before the work unit. |
| `cd apps/api && uv run pytest tests/runner_profile/test_use_cases.py tests/runner_profile/test_router.py tests/runner_profile/test_repository.py -q` | PASS | 36 tests passed before the work unit. |
| Local Supabase RLS integration | BLOCKED (environment) | Docker CLI exists but the Docker daemon is unavailable; Supabase was not running. The RLS test was not substituted with a mock and remains required for its later persistence slice. |
| Route/migration guard | PASS | No route or `supabase/migrations/` path was introduced. |

No pre-existing failures were found in the executable baseline suites.

## TDD Cycle Evidence

| Phase | Evidence | Result |
| --- | --- | --- |
| RED | Created `availability-model.test.ts` with table-driven hydration and threshold cases plus explicit interaction-model cases; ran `cd apps/web && pnpm exec tsx --test features/onboarding/_domain/availability-model.test.ts` before production code. | FAIL as expected: `Cannot find module './availability-model'`. |
| GREEN | Created `availability-model.ts` with pure hydration, reducer, validation, selected-day, and sparse projection functions. | PASS: 6 model tests passed. |
| TRIANGULATE | Ran `cd apps/web && pnpm exec tsx --test features/onboarding/_domain/availability-model.test.ts features/onboarding/_domain/step-validation.test.ts`. | PASS: 23 tests passed; assertions use exact sparse maps and issue codes. |
| REFACTOR | Kept the model/test tables and shared constants compact without changing behavior. | PASS: final `pnpm test:web-onboarding` passed 68 tests; `git diff --check` passed. |

## Targeted correction: independent coverage gap

Independent verification found missing explicit model coverage. Added the minimum table-driven assertions for:

- mapped-day deselection followed by reselection from an active preset;
- accepted exact boundaries `15` and `300`;
- rejected `301` value; 
- exactly `150` weekly minutes accepted; and
- reducer selection behavior for every preset (`45`, `60`, and `120`).

| Phase | Evidence | Result |
| --- | --- | --- |
| RED / correction discovery | The initial reselect assertion expected a prior `45` preset after an isolated exact edit to `75`; it failed because the model correctly derives `uniform-custom(75)`, as specified. | The assertion was invalid, not a production defect. |
| REFACTOR | Reframed the test to deselect/reselect a mapped day while `45` remains the active preset. No production file changed. | PASS. |
| Focused verification | `cd apps/web && pnpm exec tsx --test features/onboarding/_domain/availability-model.test.ts features/onboarding/_domain/step-validation.test.ts` | PASS: 25 tests. |
| Final test-only correction | Added an intermediate assertion that the deselected sparse map is exactly `{ wednesday: 45 }` before Monday is reselected. Production code remained unchanged. | PASS: 25 tests. |

## Completed implementation tasks

- Section 1 baseline and bounded work-unit ledger (both implementation-owned rows marked `[x]`).
- Section 2 RED, GREEN, TRIANGULATE, and REFACTOR rows (all four implementation-owned rows marked `[x]`).

## Files changed

- `apps/web/features/onboarding/_domain/availability-model.ts` — new pure interaction model.
- `apps/web/features/onboarding/_domain/availability-model.test.ts` — new table-driven model coverage.
- `openspec/changes/add-onboarding-step-4-availability/tasks.md` — completed only Sections 1–2 implementation-owned rows.
- `openspec/changes/add-onboarding-step-4-availability/apply-progress.md` — this cumulative progress record.

## Authored-line ledger

- Baseline: 0 authored lines.
- Pure model source: 207 additions.
- Pure model tests: 224 additions (including targeted correction coverage).
- Application source and tests subtotal: 431 additions / 0 deletions.
- SDD artifacts: 129 additions / 6 deletions (task completion state and this progress record).
- Current work-unit total: 560 additions / 6 deletions = 566 authored changed lines.
- This is below the first 1,000-line checkpoint. No route, migration, generated artifact, dependency, compatibility behavior, or API/storage type was added.

## Deviations

None. The RLS proof is deferred to its assigned persistence/RLS section because the local Docker/Supabase environment is unavailable; this is an environment block, not a passing substitute.

## Remaining tasks and next boundary

The following assigned implementation work remains unchecked; it was intentionally not started:

- [ ] RED: update tests and fixtures in `apps/web/features/onboarding/_domain/{step-validation,steps,wizard-draft,conditional-clearing,diagnostic-mapping}.test.ts` and `apps/web/features/onboarding/_use-cases/{save-onboarding-step,load-onboarding-draft,complete-onboarding}.test.ts` to prove completion without the five removed fields, exact availability delegation, retained conditional clearing, no removed-field emission, and no UI-only availability state in payloads. <!-- sdd-owner: implementation -->
- [ ] GREEN: remove the five identifiers from `apps/web/features/onboarding/_domain/step-validation.ts`, `apps/web/features/onboarding/_domain/steps.ts`, `apps/web/features/onboarding/_domain/wizard-draft.ts`, `apps/web/features/onboarding/_domain/conditional-clearing.ts`, diagnostics fixtures, and the typed snapshot boundary in `apps/web/features/onboarding/_adapters/onboarding-api.ts`; rename the retained obstacle-difficulty enum so it does not preserve the misleading `Technicality` name. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE: run the focused web domain and use-case suites, then verify with targeted searches under `apps/web/features/onboarding/` that the removed identifiers are absent from active canonical types, requiredness, fixtures, diagnostics, and emitted payload construction. <!-- sdd-owner: implementation -->
- [ ] REFACTOR: remove dead reduced-contract constants and defaults while preserving retained fields, server-diagnostic mapping, and exact availability validation; record the authored-line checkpoint. <!-- sdd-owner: implementation -->
- [ ] RED: extend `apps/api/tests/runner_profile/test_use_cases.py`, `apps/api/tests/runner_profile/test_router.py`, and `apps/api/tests/runner_profile/test_repository.py` with reduced completion fixtures, one rejection test for each removed key, rejection-before-repository-access, unchanged prior storage after invalid save, stale stored-shape safe failure, exact save/read hydration, split day/total diagnostics, and bounded sanitized HTTP failures. <!-- sdd-owner: implementation -->
- [ ] GREEN: update `apps/api/app/modules/runner_profile/validation.py` to reject presence of any removed key before transaction access, remove their requiredness/diagnostics/hidden-clearing logic, preserve retained conditional clearing, and distinguish invalid availability, insufficient days, and insufficient weekly total without logging payload or owner data. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE: run `cd apps/api && uv run pytest tests/runner_profile/test_use_cases.py tests/runner_profile/test_router.py tests/runner_profile/test_repository.py -q` and verify exact nested `minutes_by_day` values, atomic invalid writes, clean-state read failure, and empty/safe diagnostic metadata. <!-- sdd-owner: implementation -->
- [ ] REFACTOR: remove dead API constants and helpers made obsolete by the clean-state replacement, run `cd apps/api && uv run ruff check app/modules/runner_profile tests/runner_profile`, and confirm no sanitizer, translator, migration, or compatibility branch was added. <!-- sdd-owner: implementation -->
- [ ] RED: add browser scenarios in `apps/web/e2e/onboarding.spec.ts` for progress/copy, accessible keyboard controls, all preset mappings, exact override isolation, mixed and non-preset hydration, sparse deselection, three-45-minute rejection, too-few-days rejection, and no PUT on invalid Continue. <!-- sdd-owner: implementation -->
- [ ] RED: add browser scenarios in `apps/web/e2e/onboarding.spec.ts` for mounted-state Back preservation without PUT, one PUT before Step 5 after successful Continue, disabled controls and duplicate-request prevention while pending, failed-save retry retention, and reload hydration of only the last successful exact map. <!-- sdd-owner: implementation -->
- [ ] GREEN: rewrite `apps/web/features/onboarding/_components/availability-step.tsx` as a controlled accessible component with native weekday checkboxes, preset radios, exact numeric inputs, mixed/custom status, associated validation, visible focus, and no serialization or navigation ownership. <!-- sdd-owner: implementation -->
- [ ] GREEN: update `apps/web/features/onboarding/_components/onboarding-step-content.tsx`, `apps/web/features/onboarding/_components/onboarding-wizard.tsx`, and `apps/web/app/styles.css` to add the approved Step 4 heading/copy, composite interaction state, rich issue handling, synchronous in-flight protection, save-before-advance ordering, linear Back/Continue behavior, and focused availability layout while retiring unused legacy selectors. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE: run `cd apps/web && pnpm exec playwright test e2e/onboarding.spec.ts`; assert roles, accessible names, exact request bodies, request ordering, sanitized retry behavior, and persisted reload outcomes without relying on CSS selectors or raw sensitive diagnostics. <!-- sdd-owner: implementation -->
- [ ] REFACTOR: deduplicate only onboarding E2E navigation/response helpers and availability rendering details in the touched files; preserve behavior-level assertions and record the 1,000-line or 2,000-line checkpoint as applicable. <!-- sdd-owner: implementation -->
- [ ] RED/characterization: extend `apps/web/features/onboarding/_use-cases/{save-onboarding-step,load-onboarding-draft}.test.ts` and `apps/api/tests/runner_profile/{test_use_cases,test_router,test_repository}.py` to compare exact sparse PUT/GET maps, omit base/mixed/pending/removed fields, preserve the previous snapshot after invalid writes, and prove equivalent retry semantics. <!-- sdd-owner: implementation -->
- [ ] GREEN: make only the minimum adapter/use-case or fixture changes required for the reduced contract; do not modify `apps/api/app/modules/runner_profile/domain.py`, `repository.py`, `schemas.py`, or `supabase/migrations/` unless an approved failing test proves an existing boundary cannot satisfy the specifications. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE: run local Supabase with `npx supabase@2.39.2 start` and `npx supabase@2.39.2 db reset --local`, then run `cd apps/api && uv run pytest tests/integration/test_onboarding_rls.py -q` with two authenticated non-privileged identities; prove own-row nested JSONB insert/select/update/delete and foreign-owner select/insert/update/delete denial or zero affected rows. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE: verify the RLS assertions use no service-role result, compare exact nested values through bounded messages such as `availability round-trip mismatch`, and ensure tests/logging never print snapshots, schedules, SQL parameters, bearer credentials, or owner identifiers. <!-- sdd-owner: implementation -->
- [ ] REFACTOR: retain characterization coverage if the existing JSONB/RLS implementation is already correct, document any Docker/Supabase environment block as failed verification rather than a pass, and confirm no schema, policy, column, index, transformation, Alembic, or migration artifact was introduced. <!-- sdd-owner: implementation -->
- [ ] Run the final focused and repository checks from `openspec/config.yaml` and `design.md`: `pnpm test:web-onboarding`, `pnpm lint:web`, `pnpm build:web`, `pnpm test:web-e2e`, `cd apps/api && uv run ruff check .`, non-integration pytest, and the local Supabase RLS suite; separate environment failures from code failures. <!-- sdd-owner: implementation -->
- [ ] Verify the clean-state replacement under `apps/web/`, `apps/api/`, `openspec/specs/onboarding-contract/spec.md`, and active fixtures/tests: all five removed identifiers are absent from canonical acceptance/emission/requiredness, stale stored shapes fail safely, and no compatibility behavior was added. <!-- sdd-owner: implementation -->
- [ ] Reconcile the authored-line ledger at 2,700 lines, complete only the remaining approved scope under the 3,000-line cap, and stop for parent decision if the remaining work forecasts a breach. <!-- sdd-owner: implementation -->
- [ ] Update only directly affected claims in `docs/00-product-vision.md`, `docs/02-user-journeys.md`, `docs/04-functional-requirements.md`, `docs/05-data-model.md`, `docs/08-architecture.md`, `README.md`, and `apps/web/README.md`; preserve Spanish in Spanish documents and describe implemented Step 4 behavior only after its tests pass. <!-- sdd-owner: implementation -->
- [ ] Reconcile `openspec/specs/onboarding-contract/spec.md` and the active onboarding UI/persistence OpenSpec material under `openspec/changes/implement-onboarding-ui/` and related active capability paths so exact sparse persistence, linear save-on-Continue navigation, accessibility, RLS authority, clean-state removal, and no-migration behavior match executable evidence; do not rewrite historical archives. <!-- sdd-owner: implementation -->
- [ ] Validate documentation with targeted searches for clickable progress, autosave, persisted duration categories, obsolete verification counts, Alembic onboarding-schema claims, and all five removed identifiers, then manually compare each affected statement with the delivered UI/API/RLS evidence. <!-- sdd-owner: implementation -->
- [ ] Run the documentation checks supported by the repository and review changed Markdown for headings, progressive disclosure, concise tables/checklists, stable links, and no runtime-status claim unsupported by the final verification report. <!-- sdd-owner: implementation -->

Deferred lifecycle actions (parent-owned; unchanged):

- [ ] Perform the pre-release aggregate-only operational check for removed fields without selecting owner identifiers or snapshot bodies; treat any nonzero result as a release blocker requiring explicit correction rather than adding runtime compatibility code. <!-- sdd-owner: parent -->
- [ ] Review the complete documentation-only planning unit at `openspec/changes/add-onboarding-step-4-availability/{exploration.md,proposal.md,design.md,tasks.md}` plus `openspec/changes/add-onboarding-step-4-availability/specs/`, confirming that scope, strict-TDD order, persistence proof, RLS proof, clean-state removal, accessibility/E2E coverage, and the 3,000-line checkpoints are internally consistent. <!-- sdd-owner: parent -->
- [ ] Confirm before the planning commit that `README.md`, `apps/web/README.md`, and product-status documentation do not claim Step 4 runtime implementation; keep those files unchanged in the documentation-only planning unit. <!-- sdd-owner: parent -->
- [ ] Start or reuse the bounded review for the planning artifact unit, classify any finding against the frozen planning scope, and resolve review blockers before apply; do not launch implementation or runtime review from this planning phase. <!-- sdd-owner: parent -->
- [ ] Stage every reviewed planning path without content or mode changes and run `gentle-ai review validate --gate pre-commit --cwd .` from the repository root for the same content-bound receipt before committing. <!-- sdd-owner: parent -->
- [ ] Commit the planning artifact unit with a conventional English commit message containing only exploration, proposal, all change specs, design, and tasks; do not include implementation, runtime documentation, generated files, or migration changes. <!-- sdd-owner: parent -->
- [ ] Before each later work unit, choose or confirm the pending chain strategy and PR boundary; after apply, run the required bounded review and lifecycle validation before commit, push, PR, or release, reusing the content-bound receipt rather than opening a new review budget. <!-- sdd-owner: parent -->

Next boundary: Section 3 reduced web contract only. Do not begin API, UI/wizard, persistence/RLS expansion, final regression, or documentation reconciliation without a new assigned batch.

## Work unit 2: reduced web contract

- **Boundary:** Section 3 only; no API, Step 4 component/wizard/style, E2E, RLS, migration, or runtime-documentation files changed.
- **Commit target:** `refactor(onboarding): remove deprecated profile fields`.
- **Commit status:** Not staged or committed, as required.
- **Delivery:** Assigned chained work-unit slice; the high-workload delivery decision is resolved by this explicit boundary.

### Structured status consumed

- Change: `add-onboarding-step-4-availability`
- Artifact store: `both` (OpenSpec files are authoritative for this batch)
- Apply state: `ready`; next recommended: `apply`
- Action context: `repo-local`; repository root is the allowed edit root.
- Warning: the task forecast is high risk, but the parent assigned this bounded section-3 work unit and target commit.

### TDD Cycle Evidence

| Phase | Evidence | Result |
| --- | --- | --- |
| RED | Updated reduced-contract catalog, normalization, diagnostic, conditional-clearing, completion, save, and load fixtures; ran the focused domain/use-case command before production edits. | Expected FAIL: 5 failures. Legacy step ownership still emitted all five fields, legacy diagnostics mapped a removed field, and normalization created removed array defaults. |
| GREEN | Removed the five properties from canonical web types, ownership, normalization, clearing, fixtures, and API payload typing; renamed `Technicality` to `ObstacleDifficulty`; delegated draft availability validation to the pure model. | PASS: 59 focused tests. |
| TRIANGULATE | Ran all focused onboarding domain, use-case, and adapter tests; searched onboarding canonical paths for removed fields and payload paths for `baseMode`/`pendingDays`. | PASS: 72 tests; both searches returned no matches. |
| REFACTOR | Removed obsolete type/default/catalog/clearing entries. The focused build first exposed an existing pure-model type-guard defect; added the minimum `typeof` narrowing and replaced lint-warning destructuring without changing behavior. | PASS: focused tests, lint, and production build. |

### Completed implementation tasks

- Section 3 RED, GREEN, TRIANGULATE, and REFACTOR implementation-owned rows are visibly marked `[x]` in `tasks.md`.

### Files changed

- `apps/web/features/onboarding/_adapters/onboarding-api.ts`
- `apps/web/features/onboarding/_domain/{availability-model,conditional-clearing,step-validation,steps,wizard-draft}.ts`
- Corresponding focused domain and use-case tests under `apps/web/features/onboarding/`.
- `openspec/changes/add-onboarding-step-4-availability/{tasks,apply-progress}.md`

### Verification

- Focused RED command — expected 5 failures.
- `cd apps/web && pnpm exec tsx --test "features/onboarding/_domain/*.test.ts" "features/onboarding/_use-cases/*.test.ts" "features/onboarding/_adapters/onboarding-api.test.ts"` — PASS: 72 tests.
- `pnpm lint:web` — PASS.
- `pnpm build:web` — PASS.
- `pnpm test:portable-paths` — PASS: 25 tests.
- `git diff --check` — PASS.

### Authored-line ledger

- Section 3 application source/tests: 79 additions / 111 deletions = 190 authored lines before SDD progress updates.
- Cumulative application work through Sections 1–3: 510 additions / 111 deletions = 621 authored lines before current SDD metadata updates.
- This remains below the first 1,000-line checkpoint. No API Python, component/wizard/style, E2E, RLS, migration, dependency, compatibility behavior, or runtime documentation changed.

### Deviations

- No design deviation. The strict build exposed a pre-existing TypeScript narrowing issue in the Section-2 availability model; the minimal type guard correction and lint-safe deletion refactor are included with the model tests.

### Remaining tasks and next boundary

The old remaining-task list above is historical. Section 3 is complete. The next assigned implementation boundary is Section 4 only. Exact unchecked implementation rows:

- [ ] RED: extend `apps/api/tests/runner_profile/test_use_cases.py`, `apps/api/tests/runner_profile/test_router.py`, and `apps/api/tests/runner_profile/test_repository.py` with reduced completion fixtures, one rejection test for each removed key, rejection-before-repository-access, unchanged prior storage after invalid save, stale stored-shape safe failure, exact save/read hydration, split day/total diagnostics, and bounded sanitized HTTP failures. <!-- sdd-owner: implementation -->
- [ ] GREEN: update `apps/api/app/modules/runner_profile/validation.py` to reject presence of any removed key before transaction access, remove their requiredness/diagnostics/hidden-clearing logic, preserve retained conditional clearing, and distinguish invalid availability, insufficient days, and insufficient weekly total without logging payload or owner data. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE: run `cd apps/api && uv run pytest tests/runner_profile/test_use_cases.py tests/runner_profile/test_router.py tests/runner_profile/test_repository.py -q` and verify exact nested `minutes_by_day` values, atomic invalid writes, clean-state read failure, and empty/safe diagnostic metadata. <!-- sdd-owner: implementation -->
- [ ] REFACTOR: remove dead API constants and helpers made obsolete by the clean-state replacement, run `cd apps/api && uv run ruff check app/modules/runner_profile tests/runner_profile`, and confirm no sanitizer, translator, migration, or compatibility branch was added. <!-- sdd-owner: implementation -->

Deferred lifecycle actions (parent-owned; unchanged): the existing parent-owned rows in `tasks.md` remain deferred.

## Work unit 3: API clean-state contract and diagnostics

- **Boundary:** Section 4 only; no web frontend source/tests, Step 4 UI/wizard/styles, E2E, RLS integration, migrations, database schema, or runtime documentation changed.
- **Commit target:** `refactor(api): remove deprecated onboarding fields`.
- **Commit status:** Not staged or committed, as required.
- **Delivery / PR boundary:** Assigned chained API slice. The high-workload delivery decision is resolved by the explicit work-unit boundary.

### Structured status consumed

- Change: `add-onboarding-step-4-availability`
- Artifact store: `openspec` (authoritative)
- Apply state: `ready`; next recommended: `apply`
- Action context: `repo-local`; the repository root is the allowed edit root.
- Warning: the workload forecast remains high, but this batch is restricted to Section 4.

### TDD Cycle Evidence

| Task | Test files | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Section 4 | `apps/api/tests/runner_profile/{test_use_cases,test_router,test_repository}.py` | API/use-case and repository | PASS: 36 focused tests | FAIL: 19 assertions showed removed fields accepted, stale shapes readable, legacy technicality required, and unsplit availability diagnostics | PASS: 47 focused tests after minimal validator change | PASS: 49 focused tests with invalid null/unknown weekday HTTP cases, exact JSONB parameters, atomic invalid writes, stale-read failure, and empty metadata assertions | PASS: focused Ruff and tests after removing legacy validation, diagnostic, hidden-clearing, and constants |

### Completed implementation tasks

- Section 4 RED, GREEN, TRIANGULATE, and REFACTOR implementation-owned rows are visibly marked `[x]` in `tasks.md`.

### Files changed

- `apps/api/app/modules/runner_profile/validation.py` — rejects removed keys before structural normalization; removes legacy requiredness, diagnostics, hidden clearing, and constants; emits separate bounded insufficient-days and insufficient-total diagnostics.
- `apps/api/tests/runner_profile/test_use_cases.py` — reduced fixtures and clean-state, atomicity, stale-read, exact-map, and metadata coverage.
- `apps/api/tests/runner_profile/test_router.py` — reduced HTTP fixtures plus sanitized removed-key and invalid-availability 422 coverage.
- `apps/api/tests/runner_profile/test_repository.py` — exact nested availability JSONB bind assertion.
- `openspec/changes/add-onboarding-step-4-availability/tasks.md` — completed only Section 4 implementation-owned rows.
- `openspec/changes/add-onboarding-step-4-availability/apply-progress.md` — cumulative progress updated.

### Commands and results

- Safety net: `cd apps/api && uv run pytest tests/runner_profile/test_use_cases.py tests/runner_profile/test_router.py tests/runner_profile/test_repository.py -q` — PASS: 36 tests.
- RED: same focused command — expected FAIL: 19 failures before production edits.
- GREEN: same focused command — PASS: 47 tests.
- TRIANGULATE: same focused command — PASS: 49 tests.
- REFACTOR: `cd apps/api && uv run ruff check app/modules/runner_profile tests/runner_profile` — PASS.
- `pnpm test:portable-paths` — PASS: 25 tests.
- `git diff --check` — PASS.

### Authored-line ledger

- Section 4 API source/tests: 175 additions / 154 deletions = 329 authored lines before SDD artifact updates.
- Cumulative application work through Sections 1–4: 685 additions / 265 deletions = 950 authored lines before current SDD artifact updates.
- The section-4 source/test slice remains below the 1,000-line checkpoint; no compatibility parser, sanitizer, translator, migration, schema change, dependency, or API repository/domain/router production change was added.

### Deviations and safeguards

- No design deviation. The existing repository, domain, router, and JSONB storage path already satisfied the reduced clean-state contract; only validator and focused test changes were required.
- Removed-key rejection uses a bounded `malformed_snapshot` input classification before the transaction factory is entered. HTTP responses remain `Invalid onboarding snapshot`; diagnostic metadata is `{}` and contains no days, totals, snapshots, owners, credentials, or storage details.
- Stored stale shapes fail through the existing sanitized corrupt-data path and are not rewritten.
- Documentation path check passed through `pnpm test:portable-paths`; this tracked artifact uses repository-relative paths only.

### Remaining tasks and next boundary

Section 4 is complete. The next implementation-owned work is Section 5; it is intentionally deferred. Exact next unchecked line:

- [ ] RED: add browser scenarios in `apps/web/e2e/onboarding.spec.ts` for progress/copy, accessible keyboard controls, all preset mappings, exact override isolation, mixed and non-preset hydration, sparse deselection, three-45-minute rejection, too-few-days rejection, and no PUT on invalid Continue. <!-- sdd-owner: implementation -->

Deferred lifecycle actions: all parent-owned task rows remain unchanged.

## Work unit 3 targeted correction: API save/read and validation coverage

- **Boundary:** Section 4 correction only; test-only API-local coverage. No production, frontend, UI, E2E, RLS, migration, schema, or runtime-documentation file changed.
- **Reason:** Independent verification found that the prior tests did not use one stateful save→read lifecycle, and requested additional invalid-value and retained modality-clearing coverage.
- **Commit status:** Not staged or committed.

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED / characterization | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Stateful exact availability round trip | `apps/api/tests/runner_profile/test_use_cases.py` | use-case | PASS: 49 focused tests | Added a direct same-owner save→read test with one stateful repository; existing production behavior passed on first execution. | PASS: 55 focused tests | Exact `45/75/120` map is asserted after both save and read with one persisted snapshot and one read. | PASS: test-only stateful fixture is minimal. |
| Invalid availability values | `apps/api/tests/runner_profile/test_use_cases.py` | use-case | PASS: 49 focused tests | Added cases for `14`, `301`, boolean, and non-integer values; existing production behavior passed on first execution. | PASS: 55 focused tests | Each case asserts bounded `malformed_snapshot`, no transaction access, no upsert, and unchanged prior storage. | PASS: table-driven cases avoid duplicate setup. |
| Retained modality clearing | `apps/api/tests/runner_profile/test_use_cases.py` | use-case | PASS: 49 focused tests | Added trail-goal coverage with OCR/Backyard-only fields; existing production behavior passed on first execution. | PASS: 55 focused tests | Asserts the retained trail fields remain while `obstacle_count`, `obstacle_difficulty`, and `target_loops` are cleared. | PASS: no production change required. |

No production defect was discovered; all correction scenarios were already satisfied by the Section 4 validator and use cases. This correction is characterization coverage, so no production edit followed the test additions.

### Correction verification

- `cd apps/api && uv run pytest tests/runner_profile/test_use_cases.py tests/runner_profile/test_router.py tests/runner_profile/test_repository.py -q` — PASS: 55 tests.
- `cd apps/api && uv run ruff check app/modules/runner_profile tests/runner_profile` — PASS.
- `pnpm test:portable-paths` — PASS: 25 tests.
- `git diff --check` — PASS.

### Authored-line ledger correction

- Section 4 API source/tests after correction: 264 additions / 154 deletions = 418 authored lines before SDD artifact updates.
- Cumulative application work through Sections 1–4 after correction: 774 additions / 265 deletions = 1,039 authored lines before current SDD artifact updates.
- The 1,000-line checkpoint is now recorded. No delivery exception, scope broadening, production compatibility behavior, or migration was introduced.

### Task state

Section 4 remains complete; its four implementation-owned checkboxes remain visibly `[x]` in `tasks.md`. The correction did not create a new task row or alter parent-owned rows.



## Work unit 4: main accessible Step 4 UI

- **Boundary:** Main Step 4 presentation, wizard integration, focused styles, and browser coverage only. Persistence-hardening scenarios are explicitly deferred to `fix(onboarding): harden step 4 persistence`.
- **Commit target:** `feat(onboarding): redesign availability step`.
- **Commit status:** Not staged or committed, as required.
- **Delivery / PR boundary:** Assigned chained UI/E2E slice; the high-workload delivery decision is resolved by the explicit work-unit boundary.

### Structured status consumed

- Change: `add-onboarding-step-4-availability`
- Artifact store: `openspec` (authoritative); OpenSpec planning artifacts were read before implementation.
- Apply state: `ready`; next recommended: `apply`.
- Action context: `repo-local`; all changed paths are within the repository-root allowed edit root.
- Warning: the forecast is high risk and recommends chained delivery. This batch is the assigned UI slice; no Section 6 persistence/RLS, final regression, or documentation work was started.

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Main accessible Step 4 UI | `apps/web/e2e/onboarding.spec.ts` | Playwright E2E | PASS: existing 4 onboarding browser scenarios | Added Step 4 scenarios first; focused browser command failed as expected because the approved heading and controls did not exist (3 new scenarios failed). | Replaced the legacy day form, added heading/copy, composite wizard interaction state, sparse projection, validation feedback, and focused styling. PASS: 7 browser scenarios. | Added mixed and uniform-custom hydration plus successful sparse-map save coverage. PASS: 8 browser scenarios; domain/use-case suite (72 tests), lint, and production build also pass. | Reused focused E2E start/hydration helpers and removed unused legacy availability selectors; behavior assertions remained role/name/value based. PASS: focused browser suite after refactor. |

### Completed implementation tasks

- Section 5 main browser RED row is visibly marked `[x]` in `tasks.md`.
- Section 5 accessible component GREEN row is visibly marked `[x]` in `tasks.md`.
- Section 5 main wizard/copy/style GREEN row is visibly marked `[x]` in `tasks.md`.
- Section 5 main TRIANGULATE and REFACTOR rows are visibly marked `[x]` in `tasks.md`.
- Persistence-hardening rows remain visibly unchecked and are not represented as complete.

### Files changed

- `apps/web/e2e/onboarding.spec.ts` — added focused browser scenarios for copy/progress, keyboard-operable native controls, all presets, isolated overrides, mixed/custom hydration, sparse save projection, and invalid no-PUT paths.
- `apps/web/features/onboarding/_components/availability-step.tsx` — controlled accessible Step 4 controls and associated validation feedback.
- `apps/web/features/onboarding/_components/onboarding-step-content.tsx` — approved Spanish Step 4 heading and support copy.
- `apps/web/features/onboarding/_components/onboarding-wizard.tsx` — wizard-local `AvailabilityInteractionState`, exact draft projection, rich Step 4 validation, save-before-advance, and in-flight guard.
- `apps/web/app/styles.css` — focused availability layout/focus styling and removal of obsolete legacy availability selectors.
- `openspec/changes/add-onboarding-step-4-availability/tasks.md` — only implementation-owned Section 5 rows updated/split to distinguish this completed UI slice from deferred persistence hardening.
- `openspec/changes/add-onboarding-step-4-availability/apply-progress.md` — this cumulative record.

### Commands and results

- RED: `cd apps/web && pnpm exec playwright test e2e/onboarding.spec.ts` — expected FAIL: 3 new Step 4 scenarios could not find `¿Cuándo puedes entrenar?` before production edits; pre-existing 4 scenarios passed.
- GREEN / focused E2E: `cd apps/web && pnpm exec playwright test e2e/onboarding.spec.ts` — PASS: 7 tests.
- TRIANGULATE / focused E2E: `cd apps/web && pnpm exec playwright test e2e/onboarding.spec.ts` — PASS: 8 tests.
- `pnpm test:web-onboarding` — PASS: 72 tests.
- `pnpm lint:web` — PASS.
- `pnpm build:web` — PASS.
- `pnpm test:portable-paths` — PASS: 25 tests.
- `git diff --check` — PASS.

### Authored-line ledger

- Work unit 4 application/test delta before SDD artifact updates: 452 additions / 109 deletions = 561 authored lines.
- Cumulative application/test work through Sections 1–5 main UI: 1,226 additions / 374 deletions = 1,600 authored lines before current SDD artifact updates.
- The 1,000-line checkpoint is recorded. This slice did not modify API Python, RLS integration, Supabase migrations/schema, dependencies/lockfiles, or runtime documentation.

### Deviations and safeguards

- No design deviation. The existing pure interaction model supplied preset, mixed/custom, pending, validation, and sparse-projection rules; the wizard owns only UI-local interaction state and persists its exact `minutes_by_day` projection.
- `baseMode` and `pendingDays` are not in adapter payload types. The focused success assertion verifies a sparse exact map after deselection.
- The in-flight ref and disabled controls keep the current save flow safe. Exhaustive duplicate-request, failed-save retry-retention, Back/save-pending, and reload-last-successful E2E hardening is intentionally deferred.
- Engram briefly failed during initial discovery, then recovered. The significant implementation discovery was saved to Engram for project `kaito`; authoritative OpenSpec artifacts were also updated successfully.
- Documentation-path verification passed. This appended tracked artifact uses repository-relative paths only.

### Remaining tasks and next boundary

Deferred in Section 5, with exact persisted unchecked rows:

- [ ] RED: add browser scenarios in `apps/web/e2e/onboarding.spec.ts` for mounted-state Back preservation without PUT, one PUT before Step 5 after successful Continue, disabled controls and duplicate-request prevention while pending, failed-save retry retention, and reload hydration of only the last successful exact map. <!-- sdd-owner: implementation -->
- [ ] GREEN (deferred persistence hardening): extend Step 4 save lifecycle coverage for duplicate requests while pending, failed-save retry retention, and reload of only the last successful exact map. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE (deferred persistence hardening): assert request ordering, sanitized retry behavior, and persisted reload outcomes. <!-- sdd-owner: implementation -->

All Section 6 persistence/RLS, Section 7 final regression, and Section 8 documentation rows remain unchecked. Parent-owned lifecycle rows remain byte-for-byte unchanged.

**Next boundary:** `fix(onboarding): harden step 4 persistence` — only the deferred save lifecycle/retry/reload persistence scenarios and their focused hardening. Do not start RLS/schema/API/documentation work from that boundary without a new assigned slice.

## Work unit 4 targeted correction: compact weekday pills and keyboard evidence

- **Boundary:** Main Step 4 visual/accessibility correction only. No API, persistence-hardening, RLS, migration, dependency, or runtime-documentation work was changed.
- **Commit status:** Not staged or committed.

### TDD Cycle Evidence

| Task | Test file | Layer | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- |
| Compact pills and keyboard-native controls | `apps/web/e2e/onboarding.spec.ts` | Playwright E2E | Added compact-initial, full-accessible-name, checkbox focus/Space, radio ArrowRight, and number-input keyboard assertions first. FAIL as expected: rendered labels were full weekday names rather than `L, M, X, J, V, S, D`. | Added compact visual initials with full Spanish `aria-label` names on native checkboxes and narrowed the pill layout. PASS: 8 scenarios. | Extended the existing successful sparse-save scenario with an exact Saturday override; its captured PUT map is exactly Monday 60, Saturday 90, Sunday 60. PASS: 8 scenarios, web onboarding suite, lint, and build. | Kept the existing native checkbox/radio/input controls and focused selector scope; no abstraction or behavior change. PASS after focused rerun. |

### Correction verification

- `cd apps/web && pnpm exec playwright test e2e/onboarding.spec.ts` — PASS: 8 tests.
- `pnpm test:web-onboarding` — PASS: 72 tests.
- `pnpm lint:web` — PASS.
- `pnpm build:web` — PASS.
- `pnpm test:portable-paths` — PASS: 25 tests.
- `git diff --check` — PASS.

### Correction files changed

- `apps/web/features/onboarding/_components/availability-step.tsx` — compact visible weekday initials while preserving full Spanish checkbox names.
- `apps/web/app/styles.css` — compact weekday-pill sizing.
- `apps/web/e2e/onboarding.spec.ts` — focused native keyboard and exact-override PUT assertions.
- `openspec/changes/add-onboarding-step-4-availability/apply-progress.md` — this merged correction evidence.

### Deferred risks

The existing persistence-hardening rows remain unchecked: mounted Back preservation, pending duplicate-request behavior, failed-save retry retention, and reload of the last successful exact map. No parent-owned rows changed.

## Work unit 5: Step 4 persistence hardening

- **Boundary:** Deferred Section 5 browser persistence-hardening rows only: mounted Back preservation, pending save ordering and duplicate prevention, failed-save retry retention, exact successful payload omission, and reload-last-successful hydration.
- **Commit target:** `fix(onboarding): harden step 4 persistence`.
- **Commit status:** Not staged or committed, as required.
- **Delivery / PR boundary:** Assigned chained persistence-hardening slice. The high-workload delivery decision is resolved by this explicit bounded work unit.

### Structured status consumed

- Change: `add-onboarding-step-4-availability`.
- Artifact store: `openspec` (authoritative); proposal, all three change specs, design, tasks, existing cumulative progress, and `openspec/config.yaml` were read before edits.
- Apply state: `ready`; next recommended: `apply`.
- Action context: `repo-local`; all edited paths are within the authoritative repository edit root.
- Warning: the task forecast is high risk and recommends chaining. This batch is limited to the parent-assigned deferred Section 5 persistence hardening; Section 6 RLS, Section 7 final regression, and Section 8 documentation remain deferred.

### TDD Cycle Evidence

| Phase | Evidence | Result |
| --- | --- | --- |
| RED | Added browser scenarios before production edits for mounted Back with mixed/pending state and no Back PUT; pending one-PUT/save-before-Step-5 behavior with duplicate event dispatch; sanitized failed save with retained values and one retry; and reload of the last successful exact map after a later unsaved edit. | Initial focused run: 10 passed, 2 failed. The failures were test-harness assumptions, not production behavior: an ambiguous generic alert locator and reload landing on the normal onboarding introduction. |
| GREEN | Corrected the two browser assertions to target the bounded save message and re-enter onboarding after reload. The existing wizard's synchronous in-flight ref, disabled controls, local composite state, save-before-advance order, and sanitized error path satisfied every behavior scenario; no production code change was needed. | PASS: 12 focused browser tests. |
| TRIANGULATE | Re-ran focused browser coverage, the web onboarding domain/use-case suite, lint, production build, portable-path verification, and whitespace validation. Successful PUT coverage compares the exact sparse map and proves `baseMode` and `pendingDays` are omitted. | PASS: 12 browser tests; 72 web onboarding tests; lint, build, portable paths (25 tests), and `git diff --check`. |
| REFACTOR | Reused existing onboarding navigation and API-route helpers; retained only focused scenario-local route control. No generic framework, production refactor, or unrelated UI change was introduced. | PASS: focused browser rerun remains green. |

### Completed implementation tasks

The following implementation-owned Section 5 rows are visibly marked `[x]` in `tasks.md` immediately after proof:

- RED: browser scenarios for mounted Back/no PUT, one PUT before Step 5, pending duplicate prevention, failed-save retention/retry, and reload of the last successful exact map.
- GREEN (deferred persistence hardening): save lifecycle coverage for duplicate requests, failed-save retry retention, and last-successful reload.
- TRIANGULATE (deferred persistence hardening): request ordering, sanitized retry behavior, and persisted reload outcomes.

### Files changed

- `apps/web/e2e/onboarding.spec.ts` — focused browser scenarios for all assigned persistence-hardening behavior, including exact successful payload shape and UI-only-state omission.
- `openspec/changes/add-onboarding-step-4-availability/tasks.md` — marked only the three proven, implementation-owned deferred Section 5 rows complete.
- `openspec/changes/add-onboarding-step-4-availability/apply-progress.md` — cumulative evidence merged here.

No API Python, RLS integration, Supabase migration/schema, dependency, lockfile, production UI, or runtime documentation file changed. `apps/web/next-env.d.ts` remained unchanged after dev/build commands, so no generated-file restoration was necessary.

### Commands and results

- RED: `cd apps/web && pnpm exec playwright test e2e/onboarding.spec.ts` — 10 passed, 2 failed as described in the TDD evidence; no production edit followed those harness corrections.
- GREEN / TRIANGULATE: `cd apps/web && pnpm exec playwright test e2e/onboarding.spec.ts` — PASS: 12 tests.
- `pnpm test:web-onboarding` — PASS: 72 tests.
- `pnpm lint:web` — PASS.
- `pnpm build:web` — PASS.
- `pnpm test:portable-paths` — PASS: 25 tests.
- `git diff --check` — PASS.

### Authored-line ledger

- Work unit 5 E2E coverage: 160 additions / 0 deletions = 160 authored lines.
- Task checkbox state: 3 additions / 3 deletions = 6 authored lines before this progress update.
- Cumulative application/test work through Section 5 hardening: 1,386 additions / 374 deletions = 1,760 authored lines before current SDD artifact updates.
- This remains below the 2,000-line checkpoint. No scope exception, compatibility behavior, migration, or generated artifact was introduced.

### Deviations and safeguards

- No design deviation. Existing production behavior already met the newly added lifecycle scenarios, so strict TDD yielded characterization/coverage GREEN without a production edit.
- Successful PUT assertions require exactly `profile.availability.minutes_by_day` with `monday`, `wednesday`, and `saturday` values of `60`; `baseMode`, `pendingDays`, categories, and ranges are absent from the tested availability representation.
- Save failure assertions expose only the bounded Spanish retry message and confirm that a simulated raw backend body is not visible.
- Reload coverage saves `60/75/60`, makes an unsaved local `90` edit, reloads, then confirms hydration returns `60/75/60` rather than the unsaved value.
- Documentation-path verification passed; this update uses repository-relative paths only.

### Remaining tasks and next boundary

Exact unchecked implementation-owned rows remain:

- [ ] RED/characterization: extend `apps/web/features/onboarding/_use-cases/{save-onboarding-step,load-onboarding-draft}.test.ts` and `apps/api/tests/runner_profile/{test_use_cases,test_router,test_repository}.py` to compare exact sparse PUT/GET maps, omit base/mixed/pending/removed fields, preserve the previous snapshot after invalid writes, and prove equivalent retry semantics. <!-- sdd-owner: implementation -->
- [ ] GREEN: make only the minimum adapter/use-case or fixture changes required for the reduced contract; do not modify `apps/api/app/modules/runner_profile/domain.py`, `repository.py`, `schemas.py`, or `supabase/migrations/` unless an approved failing test proves an existing boundary cannot satisfy the specifications. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE: run local Supabase with `npx supabase@2.39.2 start` and `npx supabase@2.39.2 db reset --local`, then run `cd apps/api && uv run pytest tests/integration/test_onboarding_rls.py -q` with two authenticated non-privileged identities; prove own-row nested JSONB insert/select/update/delete and foreign-owner select/insert/update/delete denial or zero affected rows. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE: verify the RLS assertions use no service-role result, compare exact nested values through bounded messages such as `availability round-trip mismatch`, and ensure tests/logging never print snapshots, schedules, SQL parameters, bearer credentials, or owner identifiers. <!-- sdd-owner: implementation -->
- [ ] REFACTOR: retain characterization coverage if the existing JSONB/RLS implementation is already correct, document any Docker/Supabase environment block as failed verification rather than a pass, and confirm no schema, policy, column, index, transformation, Alembic, or migration artifact was introduced. <!-- sdd-owner: implementation -->
- [ ] Run the final focused and repository checks from `openspec/config.yaml` and `design.md`: `pnpm test:web-onboarding`, `pnpm lint:web`, `pnpm build:web`, `pnpm test:web-e2e`, `cd apps/api && uv run ruff check .`, non-integration pytest, and the local Supabase RLS suite; separate environment failures from code failures. <!-- sdd-owner: implementation -->
- [ ] Verify the clean-state replacement under `apps/web/`, `apps/api/`, `openspec/specs/onboarding-contract/spec.md`, and active fixtures/tests: all five removed identifiers are absent from canonical acceptance/emission/requiredness, stale stored shapes fail safely, and no compatibility behavior was added. <!-- sdd-owner: implementation -->
- [ ] Reconcile the authored-line ledger at 2,700 lines, complete only the remaining approved scope under the 3,000-line cap, and stop for parent decision if the remaining work forecasts a breach. <!-- sdd-owner: implementation -->
- [ ] Update only directly affected claims in `docs/00-product-vision.md`, `docs/02-user-journeys.md`, `docs/04-functional-requirements.md`, `docs/05-data-model.md`, `docs/08-architecture.md`, `README.md`, and `apps/web/README.md`; preserve Spanish in Spanish documents and describe implemented Step 4 behavior only after its tests pass. <!-- sdd-owner: implementation -->
- [ ] Reconcile `openspec/specs/onboarding-contract/spec.md` and the active onboarding UI/persistence OpenSpec material under `openspec/changes/implement-onboarding-ui/` and related active capability paths so exact sparse persistence, linear save-on-Continue navigation, accessibility, RLS authority, clean-state removal, and no-migration behavior match executable evidence; do not rewrite historical archives. <!-- sdd-owner: implementation -->
- [ ] Validate documentation with targeted searches for clickable progress, autosave, persisted duration categories, obsolete verification counts, Alembic onboarding-schema claims, and all five removed identifiers, then manually compare each affected statement with the delivered UI/API/RLS evidence. <!-- sdd-owner: implementation -->
- [ ] Run the documentation checks supported by the repository and review changed Markdown for headings, progressive disclosure, concise tables/checklists, stable links, and no runtime-status claim unsupported by the final verification report. <!-- sdd-owner: implementation -->

Parent-owned lifecycle actions remain unchanged. **Next boundary:** Section 6 exact API/JSONB/RLS persistence proof only; parent lifecycle review is required after implementation completion, not from this apply batch.

## Work unit 5 targeted correction: Saturday Back/return preservation

- **Boundary:** Test-only strengthening of the existing Section 5 mounted Back/return browser scenario.
- **Structured status:** authoritative OpenSpec status was `applyState: ready`, `nextRecommended: apply`; action context was `repo-local` with the repository edit root allowed. The assigned persistence-hardening work unit remains the only scope.

### TDD Cycle Evidence

| Phase | Evidence | Result |
| --- | --- | --- |
| RED / characterization | Added assertions after the Step 3 return that `Sábado` remains selected and its exact minute input remains `60`, alongside the existing Monday, Wednesday, pending Sunday, mixed-mode, and no-Back-PUT checks. | Existing production behavior satisfied the new assertion; no production change was warranted. |
| GREEN | No production edit; retained the focused browser assertion only. | PASS: 12 focused Playwright tests. |
| TRIANGULATE | Ran the focused onboarding Playwright suite and portable-path checks. | PASS: 12 Playwright tests and 25 portable-path tests. |
| REFACTOR | No refactor was needed for this two-assertion test-only correction. | Scope remains limited to E2E evidence and cumulative progress. |

### Correction evidence

- `apps/web/e2e/onboarding.spec.ts` now proves Saturday remains checked and restores the exact value `60` after local Back and return to Step 4.
- `pnpm test:portable-paths` passed; this tracked progress update uses repository-relative paths only.
- The Playwright dev server changed generated `apps/web/next-env.d.ts` to its development route reference. That command side effect was restored to its pre-batch content before completion; it is not a remaining change.
- Task checkboxes remain honest and unchanged because the already-completed deferred Section 5 rows need no new task state.
- Nothing was staged or committed.

## Work unit 6: exact API, JSONB, and RLS persistence proof

- **Boundary:** Section 6 only; focused web/API contract characterization and local-Supabase RLS fixture proof.
- **Commit target:** `test(onboarding): verify availability persistence and rls`.
- **Commit status:** Nothing staged or committed.
- **Delivery / PR boundary:** Assigned persistence-proof slice under the approved delivery path. The remaining RLS proof is blocked by the local Docker daemon.

### Structured status consumed

- Change: `add-onboarding-step-4-availability`; authoritative OpenSpec `applyState: ready`, `nextRecommended: apply`.
- Action context: `repo-local`; every modified path is under the repository-root allowed edit root.
- Strict TDD / characterization mode is active. The task forecast remains high risk, but the parent assigned this bounded Section 6 slice.

### TDD Cycle Evidence

| Task | Test files | Layer | Safety net | RED / characterization | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Exact web/API persistence boundary | `apps/web/features/onboarding/_use-cases/{save-onboarding-step,load-onboarding-draft}.test.ts`, `apps/api/tests/runner_profile/{test_use_cases,test_router,test_repository}.py` | Unit/API | PASS: 7 web and 55 API tests | Added exact sparse PUT/GET, omitted UI/removed-field, retry, and JSONB-shape assertions first. Existing behavior was GREEN on first run. | No production change; only test fixtures/assertions were required. | PASS: 7 web and 58 API tests. Invalid-write atomicity remains covered by the existing focused API cases. | Bounded `availability round-trip mismatch` failures avoid snapshot interpolation. |
| Local Supabase nested JSONB/RLS | `apps/api/tests/integration/test_onboarding_rls.py` | Local Supabase integration | Ruff PASS | Added two-identity exact nested-map fixture coverage for own CRUD and foreign select/insert/update/delete isolation; no service-role result is RLS evidence. | Not reached: local Supabase could not start because Docker daemon access failed. | BLOCKED: reset and integration suite could not execute. | Deferred; no production/schema/policy change is permitted or made. |

### Completed implementation tasks

- The Section 6 RED/characterization and minimum GREEN fixture rows are visibly `[x]` in `tasks.md`.
- The three Section 6 RLS TRIANGULATE/REFACTOR rows remain `[ ]`; local-Supabase proof is not claimed.

### Files changed

- `apps/web/features/onboarding/_use-cases/{save-onboarding-step,load-onboarding-draft}.test.ts`
- `apps/api/tests/runner_profile/{test_use_cases,test_router,test_repository}.py`
- `apps/api/tests/integration/test_onboarding_rls.py`
- `openspec/changes/add-onboarding-step-4-availability/{tasks,apply-progress}.md`

No API production module, migration, schema, policy, column, index, JSONB transformation, Alembic artifact, dependency, lockfile, Step 4 UI/wizard/style, E2E, or runtime documentation file changed.

### Verification evidence

- `cd apps/web && pnpm exec tsx --test features/onboarding/_use-cases/save-onboarding-step.test.ts features/onboarding/_use-cases/load-onboarding-draft.test.ts` — PASS: 7 tests.
- `cd apps/api && uv run pytest tests/runner_profile/test_use_cases.py tests/runner_profile/test_router.py tests/runner_profile/test_repository.py -q` — PASS: 58 tests.
- `cd apps/api && uv run ruff check tests/integration/test_onboarding_rls.py tests/runner_profile/test_use_cases.py tests/runner_profile/test_router.py tests/runner_profile/test_repository.py` — PASS.
- `npx supabase@2.39.2 start` then `npx supabase@2.39.2 db reset --local`, followed by `cd apps/api && uv run pytest tests/integration/test_onboarding_rls.py -q` — BLOCKED: Docker daemon unavailable; integration run reported 4 unit-only passes and 20 setup errors. This is environment evidence, not an RLS pass.
- `pnpm test:portable-paths` — PASS: 25 tests (baseline; re-run required before completion).

### Safeguards and deviations

- Characterization was GREEN on first execution for web/API boundaries; no production defect was invented and no production edit followed.
- RLS helpers compare exact nested availability using the bounded message `availability round-trip mismatch`; assertions and logging do not emit snapshots, schedules, SQL parameters, bearer credentials, or owner identifiers. Service-role access remains setup/cleanup only and supplies no RLS result count.
- `apps/web/next-env.d.ts` is clean. Changed tracked documentation uses repository-relative paths; no machine-specific path was added.
- **Deviation / blocker:** Docker is unavailable, so the required authenticated non-privileged two-owner local-Supabase proof remains unverified. Do not treat this work unit as ready to commit.

### Authored-line ledger

- Work unit 6 focused tests and RLS fixture: 246 additions / 29 deletions = 275 authored lines before SDD artifact updates.
- Task checkbox update: 2 additions / 2 deletions = 4 authored lines before this progress update.
- Cumulative application/test work through this partial Section 6 slice: 1,632 additions / 403 deletions = 2,035 authored lines before current SDD artifact updates.
- No schema/migration or production-code lines were authored.

### Remaining tasks and next boundary

- [ ] TRIANGULATE: run local Supabase with `npx supabase@2.39.2 start` and `npx supabase@2.39.2 db reset --local`, then run `cd apps/api && uv run pytest tests/integration/test_onboarding_rls.py -q` with two authenticated non-privileged identities; prove own-row nested JSONB insert/select/update/delete and foreign-owner select/insert/update/delete denial or zero affected rows. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE: verify the RLS assertions use no service-role result, compare exact nested values through bounded messages such as `availability round-trip mismatch`, and ensure tests/logging never print snapshots, schedules, SQL parameters, bearer credentials, or owner identifiers. <!-- sdd-owner: implementation -->
- [ ] REFACTOR: retain characterization coverage if the existing JSONB/RLS implementation is already correct, document any Docker/Supabase environment block as failed verification rather than a pass, and confirm no schema, policy, column, index, transformation, Alembic, or migration artifact was introduced. <!-- sdd-owner: implementation -->

**Next boundary:** restore Docker/Supabase, run the exact local reset and RLS command successfully, then re-read `tasks.md` before marking the remaining Section 6 rows. Parent lifecycle/review remains deferred.

### Work unit 6 RLS resumption

- **Status:** Complete for the assigned Section 6 scope. Docker availability was confirmed before execution.
- **TDD characterization:** The existing persistence/RLS boundary was GREEN after the focused fixture coverage; no production defect, schema change, policy change, or migration was invented. A final test-fixture refactor replaced an identity-bearing assertion with the bounded `authenticated identity context mismatch` message, then the local suite was rerun successfully.
- **Local proof:** `npx supabase@2.39.2 start`, `npx supabase@2.39.2 db reset --local`, and `cd apps/api && uv run pytest tests/integration/test_onboarding_rls.py -q` completed successfully: 24 passed. The fixture creates two authenticated non-privileged identities and proves own-row insert/select/update/delete with nested JSONB availability, exact owner-only round trips, equivalent retry behavior, and foreign-owner select/insert/update/delete denial or zero affected rows.
- **RLS evidence boundary:** Service-role access is used only to create and remove test identities; no service-role result count is used as RLS evidence. Exact nested-value comparison failures are bounded as `availability round-trip mismatch`. Test logging and assertion messages do not interpolate snapshots, schedules, credentials, owner identifiers, or SQL parameters.
- **Focused quality checks:** focused Ruff, portable-path checks (25 tests), whitespace validation, generated-file guard, repository-relative documentation-path scan, and protected production/schema path guard all passed.
- **Task state:** all five Section 6 implementation-owned rows are visibly `[x]` in `tasks.md`.
- **No scope expansion:** no API production file, migration, schema, policy, column, index, JSONB transformation, Alembic artifact, dependency, lockfile, Step 4 UI/wizard/style, E2E, or runtime documentation file changed. Nothing was staged or committed.

### Updated authored-line ledger

- Work unit 6 test and fixture changes: 248 additions / 30 deletions = 278 authored lines before this resumption record.
- Section 6 task state: 5 additions / 5 deletions = 10 authored lines before this resumption record.
- Cumulative application/test work through Section 6: 1,634 additions / 404 deletions = 2,038 authored lines before current SDD artifact updates.

### Remaining tasks and next boundary

Section 6 is complete. Exact unchecked implementation-owned work now begins with Section 7 final regression; all parent-owned lifecycle rows remain deferred and unchanged. The next recommended action is parent lifecycle/review, not a commit from this apply executor.

### Work unit 6 targeted privacy correction

- **Reason:** Independent verification found four full-object/full-payload equality assertions that could disclose onboarding snapshots or exact schedules through failure diffs.
- **Correction:** Replaced those comparisons in the focused save/load web tests and router tests with fixed-message boolean/conditional assertions. Exact canonical equality is preserved; failures now use only `onboarding payload mismatch`, `onboarding response mismatch`, or `availability round-trip mismatch`. The API conditional failure uses `pytest.fail(..., pytrace=False)`.
- **Scope:** Test-only. No production, schema, migration, policy, dependency, lockfile, UI, E2E, or runtime-documentation change. Section 6 task checkboxes remain `[x]` because this corrects evidence privacy, not the proven behavior.
- **Verification:** focused web save/load tests passed (7); focused router tests passed (18); focused Ruff and portable-path checks passed (25); `git diff --check` passed. The RLS fixture was unchanged by this correction, so the previously passing local-Supabase RLS evidence remains applicable and was not rerun.
- **Guards:** no generated `apps/web/next-env.d.ts` change, no staged paths, no protected production/schema path change, and no machine-specific path in this tracked artifact. Nothing was committed.

### Privacy-correction ledger

- Correction delta before this progress update: 23 additions / 14 deletions across focused tests.
- Cumulative Section 6 application/test delta before this progress update: 2,075 authored lines. The correction remains within the approved work-unit boundary.

### Work unit 6 second targeted privacy correction

- **Reason:** Independent verification found remaining pytest assertion-rewriting paths in changed router, use-case, and repository tests that could disclose owner identifiers, SQL parameter maps, exact schedules, or snapshots on failure.
- **Correction:** Added bounded test-local equality/absence helpers that use explicit conditions and `pytest.fail(..., pytrace=False)`. Converted every sensitive comparison in the changed Section 6 Python test hunks to fixed-message proof. Exact owner binding, exact nested availability, response equality, retry behavior, and repository read behavior remain asserted without rendering compared values.
- **Audit:** Reviewed all changed Section 6 Python test hunks for owner, parameter, snapshot, and schedule comparisons. Bounded failures are limited to fixed messages; no sensitive value is interpolated. The RLS fixture was unchanged, so its prior local-Supabase 24-pass evidence remains applicable.
- **Verification:** focused API tests passed (58); focused web save/load tests passed (7); focused Ruff and portable-path checks passed (25); `git diff --check` passed. Generated-file, staging, protected production/schema, and repository-relative documentation-path guards passed.
- **Task state:** Section 6 remains complete; no checkbox changed for this evidence-only correction. Nothing was staged or committed.
