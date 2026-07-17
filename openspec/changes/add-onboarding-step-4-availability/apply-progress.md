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
