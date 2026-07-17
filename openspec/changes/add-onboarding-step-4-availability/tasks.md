# Tasks: Add Onboarding Step 4 Availability

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 2,400–3,000 authored lines across implementation, tests, persistence proof, and final documentation reconciliation |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Planning docs commit → pure model/contract slice → API contract slice → Step 4 UI/E2E slice → persistence/RLS proof and documentation reconciliation |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

## Delivery Constraints and Checkpoints

- The planning commit is documentation-only: `openspec/changes/add-onboarding-step-4-availability/{exploration.md,proposal.md,design.md,tasks.md}` plus every file under `openspec/changes/add-onboarding-step-4-availability/specs/`. It MUST NOT update `README.md`, `apps/web/README.md`, or product-status claims as if runtime behavior already exists.
- Implementation is strict TDD. Each production change follows RED → GREEN → TRIANGULATE → REFACTOR, except database/RLS characterization coverage may be GREEN on first execution and must be recorded as such rather than manufacturing a migration or defect.
- The 3,000-line authored budget includes code, tests, OpenSpec changes, and directly affected documentation. Track additions plus deletions at the end of every work unit.
- Checkpoints are mandatory at 1,000, 2,000, and 2,700 authored lines. At 2,700, forecast all remaining required work; stop before editing if the remaining scope would exceed 3,000 and request explicit re-scope or a delivery exception.
- No migration, new route, compatibility parser, legacy translator, payload sanitizer, generated artifact, dependency, or unrelated documentation cleanup is in scope.

## Ordered Implementation Work Units

### 1. Baseline and bounded work-unit ledger

- [x] Record the baseline results and pre-existing failures for `pnpm test:web-onboarding`, the focused API pytest files, and `apps/api/tests/integration/test_onboarding_rls.py`; establish the initial authored-line ledger without changing production files. <!-- sdd-owner: implementation -->
- [x] Confirm the implementation boundary against `apps/web/features/onboarding/`, `apps/api/app/modules/runner_profile/`, `apps/api/tests/integration/test_onboarding_rls.py`, `supabase/migrations/`, and the directly affected documentation paths; verify that no route or migration task is being introduced. <!-- sdd-owner: implementation -->

### 2. RED → GREEN → TRIANGULATE → REFACTOR: pure availability model

- [x] RED: add table-driven cases in `apps/web/features/onboarding/_domain/availability-model.test.ts` for weekday order, preset mappings `45/60/120`, empty/preset/custom/mixed hydration, non-destructive exact-value retention, selection and deselection, pending days, isolated overrides, explicit bulk replacement, invalid transient values, sparse projection, and independent day/weekly thresholds. <!-- sdd-owner: implementation -->
- [x] GREEN: create `apps/web/features/onboarding/_domain/availability-model.ts` with pure hydration, reducer, validation, selected-day, and canonical projection functions; keep `baseMode` and `pendingDays` outside `AvailabilityDraft` and all API/storage types. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE: run `cd apps/web && pnpm exec tsx --test "features/onboarding/_domain/availability-model.test.ts"` and `apps/web/features/onboarding/_domain/step-validation.test.ts`, asserting exact sparse maps and issue codes rather than labels or implementation details. <!-- sdd-owner: implementation -->
- [x] REFACTOR: consolidate constants and table fixtures in `apps/web/features/onboarding/_domain/availability-model.ts` and its test without changing mixed hydration, pending-day, or threshold behavior; update the work-unit line ledger. <!-- sdd-owner: implementation -->

### 3. RED → GREEN → TRIANGULATE → REFACTOR: reduced web contract

- [x] RED: update tests and fixtures in `apps/web/features/onboarding/_domain/{step-validation,steps,wizard-draft,conditional-clearing,diagnostic-mapping}.test.ts` and `apps/web/features/onboarding/_use-cases/{save-onboarding-step,load-onboarding-draft,complete-onboarding}.test.ts` to prove completion without the five removed fields, exact availability delegation, retained conditional clearing, no removed-field emission, and no UI-only availability state in payloads. <!-- sdd-owner: implementation -->
- [x] GREEN: remove the five identifiers from `apps/web/features/onboarding/_domain/step-validation.ts`, `apps/web/features/onboarding/_domain/steps.ts`, `apps/web/features/onboarding/_domain/wizard-draft.ts`, `apps/web/features/onboarding/_domain/conditional-clearing.ts`, diagnostics fixtures, and the typed snapshot boundary in `apps/web/features/onboarding/_adapters/onboarding-api.ts`; rename the retained obstacle-difficulty enum so it does not preserve the misleading `Technicality` name. <!-- sdd-owner: implementation -->
- [x] TRIANGULATE: run the focused web domain and use-case suites, then verify with targeted searches under `apps/web/features/onboarding/` that the removed identifiers are absent from active canonical types, requiredness, fixtures, diagnostics, and emitted payload construction. <!-- sdd-owner: implementation -->
- [x] REFACTOR: remove dead reduced-contract constants and defaults while preserving retained fields, server-diagnostic mapping, and exact availability validation; record the authored-line checkpoint. <!-- sdd-owner: implementation -->

### 4. RED → GREEN → TRIANGULATE → REFACTOR: API clean-state contract and diagnostics

- [ ] RED: extend `apps/api/tests/runner_profile/test_use_cases.py`, `apps/api/tests/runner_profile/test_router.py`, and `apps/api/tests/runner_profile/test_repository.py` with reduced completion fixtures, one rejection test for each removed key, rejection-before-repository-access, unchanged prior storage after invalid save, stale stored-shape safe failure, exact save/read hydration, split day/total diagnostics, and bounded sanitized HTTP failures. <!-- sdd-owner: implementation -->
- [ ] GREEN: update `apps/api/app/modules/runner_profile/validation.py` to reject presence of any removed key before transaction access, remove their requiredness/diagnostics/hidden-clearing logic, preserve retained conditional clearing, and distinguish invalid availability, insufficient days, and insufficient weekly total without logging payload or owner data. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE: run `cd apps/api && uv run pytest tests/runner_profile/test_use_cases.py tests/runner_profile/test_router.py tests/runner_profile/test_repository.py -q` and verify exact nested `minutes_by_day` values, atomic invalid writes, clean-state read failure, and empty/safe diagnostic metadata. <!-- sdd-owner: implementation -->
- [ ] REFACTOR: remove dead API constants and helpers made obsolete by the clean-state replacement, run `cd apps/api && uv run ruff check app/modules/runner_profile tests/runner_profile`, and confirm no sanitizer, translator, migration, or compatibility branch was added. <!-- sdd-owner: implementation -->

### 5. RED → GREEN → TRIANGULATE → REFACTOR: Step 4 presentation and wizard lifecycle

- [ ] RED: add browser scenarios in `apps/web/e2e/onboarding.spec.ts` for progress/copy, accessible keyboard controls, all preset mappings, exact override isolation, mixed and non-preset hydration, sparse deselection, three-45-minute rejection, too-few-days rejection, and no PUT on invalid Continue. <!-- sdd-owner: implementation -->
- [ ] RED: add browser scenarios in `apps/web/e2e/onboarding.spec.ts` for mounted-state Back preservation without PUT, one PUT before Step 5 after successful Continue, disabled controls and duplicate-request prevention while pending, failed-save retry retention, and reload hydration of only the last successful exact map. <!-- sdd-owner: implementation -->
- [ ] GREEN: rewrite `apps/web/features/onboarding/_components/availability-step.tsx` as a controlled accessible component with native weekday checkboxes, preset radios, exact numeric inputs, mixed/custom status, associated validation, visible focus, and no serialization or navigation ownership. <!-- sdd-owner: implementation -->
- [ ] GREEN: update `apps/web/features/onboarding/_components/onboarding-step-content.tsx`, `apps/web/features/onboarding/_components/onboarding-wizard.tsx`, and `apps/web/app/styles.css` to add the approved Step 4 heading/copy, composite interaction state, rich issue handling, synchronous in-flight protection, save-before-advance ordering, linear Back/Continue behavior, and focused availability layout while retiring unused legacy selectors. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE: run `cd apps/web && pnpm exec playwright test e2e/onboarding.spec.ts`; assert roles, accessible names, exact request bodies, request ordering, sanitized retry behavior, and persisted reload outcomes without relying on CSS selectors or raw sensitive diagnostics. <!-- sdd-owner: implementation -->
- [ ] REFACTOR: deduplicate only onboarding E2E navigation/response helpers and availability rendering details in the touched files; preserve behavior-level assertions and record the 1,000-line or 2,000-line checkpoint as applicable. <!-- sdd-owner: implementation -->

### 6. Exact API, JSONB, and RLS persistence proof

- [ ] RED/characterization: extend `apps/web/features/onboarding/_use-cases/{save-onboarding-step,load-onboarding-draft}.test.ts` and `apps/api/tests/runner_profile/{test_use_cases,test_router,test_repository}.py` to compare exact sparse PUT/GET maps, omit base/mixed/pending/removed fields, preserve the previous snapshot after invalid writes, and prove equivalent retry semantics. <!-- sdd-owner: implementation -->
- [ ] GREEN: make only the minimum adapter/use-case or fixture changes required for the reduced contract; do not modify `apps/api/app/modules/runner_profile/domain.py`, `repository.py`, `schemas.py`, or `supabase/migrations/` unless an approved failing test proves an existing boundary cannot satisfy the specifications. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE: run local Supabase with `npx supabase@2.39.2 start` and `npx supabase@2.39.2 db reset --local`, then run `cd apps/api && uv run pytest tests/integration/test_onboarding_rls.py -q` with two authenticated non-privileged identities; prove own-row nested JSONB insert/select/update/delete and foreign-owner select/insert/update/delete denial or zero affected rows. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE: verify the RLS assertions use no service-role result, compare exact nested values through bounded messages such as `availability round-trip mismatch`, and ensure tests/logging never print snapshots, schedules, SQL parameters, bearer credentials, or owner identifiers. <!-- sdd-owner: implementation -->
- [ ] REFACTOR: retain characterization coverage if the existing JSONB/RLS implementation is already correct, document any Docker/Supabase environment block as failed verification rather than a pass, and confirm no schema, policy, column, index, transformation, Alembic, or migration artifact was introduced. <!-- sdd-owner: implementation -->

### 7. Final regression and clean-state implementation verification

- [ ] Run the final focused and repository checks from `openspec/config.yaml` and `design.md`: `pnpm test:web-onboarding`, `pnpm lint:web`, `pnpm build:web`, `pnpm test:web-e2e`, `cd apps/api && uv run ruff check .`, non-integration pytest, and the local Supabase RLS suite; separate environment failures from code failures. <!-- sdd-owner: implementation -->
- [ ] Verify the clean-state replacement under `apps/web/`, `apps/api/`, `openspec/specs/onboarding-contract/spec.md`, and active fixtures/tests: all five removed identifiers are absent from canonical acceptance/emission/requiredness, stale stored shapes fail safely, and no compatibility behavior was added. <!-- sdd-owner: implementation -->
- [ ] Perform the pre-release aggregate-only operational check for removed fields without selecting owner identifiers or snapshot bodies; treat any nonzero result as a release blocker requiring explicit correction rather than adding runtime compatibility code. <!-- sdd-owner: parent -->
- [ ] Reconcile the authored-line ledger at 2,700 lines, complete only the remaining approved scope under the 3,000-line cap, and stop for parent decision if the remaining work forecasts a breach. <!-- sdd-owner: implementation -->

### 8. Final documentation reconciliation after verified behavior

- [ ] Update only directly affected claims in `docs/00-product-vision.md`, `docs/02-user-journeys.md`, `docs/04-functional-requirements.md`, `docs/05-data-model.md`, `docs/08-architecture.md`, `README.md`, and `apps/web/README.md`; preserve Spanish in Spanish documents and describe implemented Step 4 behavior only after its tests pass. <!-- sdd-owner: implementation -->
- [ ] Reconcile `openspec/specs/onboarding-contract/spec.md` and the active onboarding UI/persistence OpenSpec material under `openspec/changes/implement-onboarding-ui/` and related active capability paths so exact sparse persistence, linear save-on-Continue navigation, accessibility, RLS authority, clean-state removal, and no-migration behavior match executable evidence; do not rewrite historical archives. <!-- sdd-owner: implementation -->
- [ ] Validate documentation with targeted searches for clickable progress, autosave, persisted duration categories, obsolete verification counts, Alembic onboarding-schema claims, and all five removed identifiers, then manually compare each affected statement with the delivered UI/API/RLS evidence. <!-- sdd-owner: implementation -->
- [ ] Run the documentation checks supported by the repository and review changed Markdown for headings, progressive disclosure, concise tables/checklists, stable links, and no runtime-status claim unsupported by the final verification report. <!-- sdd-owner: implementation -->

## Parent-Owned Planning and Lifecycle Gates

- [ ] Review the complete documentation-only planning unit at `openspec/changes/add-onboarding-step-4-availability/{exploration.md,proposal.md,design.md,tasks.md}` plus `openspec/changes/add-onboarding-step-4-availability/specs/`, confirming that scope, strict-TDD order, persistence proof, RLS proof, clean-state removal, accessibility/E2E coverage, and the 3,000-line checkpoints are internally consistent. <!-- sdd-owner: parent -->
- [ ] Confirm before the planning commit that `README.md`, `apps/web/README.md`, and product-status documentation do not claim Step 4 runtime implementation; keep those files unchanged in the documentation-only planning unit. <!-- sdd-owner: parent -->
- [ ] Start or reuse the bounded review for the planning artifact unit, classify any finding against the frozen planning scope, and resolve review blockers before apply; do not launch implementation or runtime review from this planning phase. <!-- sdd-owner: parent -->
- [ ] Stage every reviewed planning path without content or mode changes and run `gentle-ai review validate --gate pre-commit --cwd .` from the repository root for the same content-bound receipt before committing. <!-- sdd-owner: parent -->
- [ ] Commit the planning artifact unit with a conventional English commit message containing only exploration, proposal, all change specs, design, and tasks; do not include implementation, runtime documentation, generated files, or migration changes. <!-- sdd-owner: parent -->
- [ ] Before each later work unit, choose or confirm the pending chain strategy and PR boundary; after apply, run the required bounded review and lifecycle validation before commit, push, PR, or release, reusing the content-bound receipt rather than opening a new review budget. <!-- sdd-owner: parent -->
