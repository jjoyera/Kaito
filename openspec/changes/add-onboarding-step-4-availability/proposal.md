## Why

Kaito's fourth onboarding screen still uses a legacy per-day form and does not match the approved seven-step experience. The current UI makes a valid weekly schedule cumbersome to enter, does not communicate the 3-day/150-minute completion rule clearly, and lacks focused proof that exact per-day availability survives UI, API, JSONB, and RLS boundaries.

The active canonical contract also requires prior-history and goal fields that the approved product journey will not collect. Leaving those fields completion-required would make the redesigned onboarding impossible to complete and would preserve a misleading product contract. This change therefore coordinates the Step 4 experience with a clean-state contract reduction while retaining exact availability as the canonical planning input.

## Intent

Deliver Step 4 as an accessible availability workflow in which a runner selects weekdays, applies a habitual base duration, and may refine any selected day to an exact minute value. Preserve the exact sparse `profile.availability.minutes_by_day` map throughout persistence and hydration, enforce the existing availability threshold before saving, and remove uncollected fields from the canonical onboarding contract and all directly dependent validation and documentation.

## What Changes

- Replace the legacy Step 4 availability form with the approved seven-step visual treatment and copy, including non-interactive `Paso 4 de 7` / `57%` progress, weekday selection, a habitual/base duration control, optional exact per-day adjustments, and linear Back/Continue actions.
- Keep the base duration as UI-only state. It initializes or intentionally updates selected-day minute values but MUST NOT become an API field, database column, or canonical contract property.
- Continue persisting availability only as the sparse exact `profile.availability.minutes_by_day` object. Selected weekdays have integer minute values; unselected weekdays are omitted.
- Preserve mixed persisted durations non-destructively. Hydration presents the base state as `Varía por día` and retains every exact value until the runner explicitly changes the relevant base or day value.
- Keep the current completion threshold: at least 3 selected days and at least 150 total weekly minutes. Three 45-minute days remain invalid, and the UI explains that the runner must add another day or increase available time.
- Validate and save only when Continue is pressed. A successful save occurs before Step 5 is shown. Back changes only local navigation and preserves mounted wizard state; reloading before Continue may discard unsaved Step 4 edits.
- Retain linear Back/Continue navigation and a non-interactive progress indicator. This change does not restore clickable direct-step navigation from older active artifacts.
- Remove the following fields from the canonical onboarding contract and directly dependent web/API domain validation, diagnostics, fixtures, and documentation because the product will not collect them:
  - `profile.prior_history.training_years`
  - `profile.prior_history.completed_race_count_range`
  - `profile.prior_history.practiced_modalities`
  - `profile.prior_history.practiced_terrain`
  - `goal.technicality`
- Treat those removals as a coordinated clean-state replacement of the active contract. Records containing the removed fields have already been deleted operationally. No migration, payload sanitizer, legacy translator, compatibility branch, or historical-field preservation is included.
- Update directly affected product, functional-requirement, data-model, architecture, root README, web README, canonical OpenSpec contract, and onboarding UI change documentation so they describe the implemented product rather than stale navigation, field, persistence, or verification claims.
- Implement under strict TDD, with failing tests preceding production changes and focused verification across UI behavior, validation, API save/read hydration, nested JSONB round trips, and owner-isolated RLS behavior.

## Scope

### In scope

- Step 4 presentation, accessible controls, local interaction state, exact per-day editing, validation feedback, Back/Continue behavior, and hydration.
- Existing onboarding wizard/domain/use-case seams needed to support the new Step 4 behavior without introducing a new route or feature boundary.
- Canonical availability contract preservation and removal of the five approved uncollected fields.
- Direct web and API validation/diagnostic updates required by the contract reduction.
- Focused unit, integration, browser, database, and RLS regression coverage.
- Directly affected Spanish product/architecture documentation and English technical/OpenSpec documentation.

### Out of scope

- A persisted habitual/base duration, approximate range, or new availability schema.
- Database migrations or compatibility handling for the removed contract fields.
- Autosave, save-on-Back, or recovery of edits lost by reloading before Continue.
- Clickable progress or direct navigation between onboarding steps.
- Reworking unrelated onboarding screens, plan generation, availability feasibility recommendations, or downstream scheduling algorithms.
- Broad documentation cleanup unrelated to Step 4, the removed fields, or the persistence authority used by this capability.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `onboarding-ui`: Replace Step 4 with the base-duration-plus-exact-adjustments interaction; define non-destructive mixed-duration hydration, threshold feedback, linear navigation, and save-on-Continue behavior.
- `onboarding-contract`: Preserve exact sparse per-day availability and its existing thresholds while removing the approved prior-history fields and conditional goal technicality from the active canonical payload.
- `onboarding-persistence`: Confirm that save/read and owner-scoped JSONB persistence round-trip the revised contract and nested exact availability without adding schema or migration behavior.

## Affected Areas

- `apps/web/features/onboarding/`: Step 4 component, wizard integration, pure availability rules, validation, load/save use cases, and focused tests.
- `apps/web/app/styles.css`: reuse and extend existing onboarding visual primitives; retire legacy Step 4-specific styling where no longer used.
- `apps/web/e2e/onboarding.spec.ts`: Step 4 interaction, validation, local Back behavior, save ordering, revisit, and reload hydration.
- `apps/api/app/modules/runner_profile/` and its tests: remove canonical handling of the five deleted fields and verify revised contract save/read behavior.
- `apps/api/tests/integration/test_onboarding_rls.py`: nested availability JSONB owner round trip and foreign-owner isolation.
- `openspec/specs/onboarding-contract/spec.md`: canonical field catalog, validation, examples, and scope statements.
- The onboarding UI and persistence OpenSpec capability artifacts directly affected by the revised behavior.
- `docs/00-product-vision.md`, `docs/02-user-journeys.md`, `docs/04-functional-requirements.md`, `docs/05-data-model.md`, `docs/08-architecture.md`, `README.md`, and `apps/web/README.md`, updating only directly affected claims and retaining Spanish where the existing document is Spanish.
- No SQL migration or database schema change is expected.

## Operational Premise

Database records containing the removed fields were deleted before this change. Implementation and verification may therefore assume a clean persisted state and coordinated web/API deployment. This premise is operational evidence, not behavior implemented by the application. If that premise becomes false before release, this proposal is no longer safe to apply as written and must be revised before deployment.

## Risks and Mitigations

- **Accidental loss of exact mixed schedules:** deriving one shared duration during hydration could overwrite valid canonical data. Mitigation: hydrate mixed values as `Varía por día`, retain the full map, and mutate values only after explicit runner action.
- **Base-duration ambiguity:** a convenience control could be mistaken for canonical data or silently overwrite custom days. Mitigation: specify its exact edit semantics in the capability spec, keep it outside payload types, and test transitions from uniform and mixed states.
- **Confusing threshold failure:** three selected 45-minute days meet the day count but not the weekly total. Mitigation: show actionable copy that names both remedies and prove that invalid attempts neither save nor advance.
- **Contract/runtime drift:** removing fields only from documentation would leave completion blocked or payloads inconsistent. Mitigation: update canonical spec, web/API validation, diagnostics, fixtures, and completion tests as one coordinated change.
- **Clean-state premise violation:** stale records could fail strict parsing after field removal. Mitigation: confirm the deletion premise before release; do not conceal a failed premise with unplanned compatibility code.
- **Persistence confidence gap:** mocked browser tests cannot prove nested JSONB or RLS behavior. Mitigation: add focused API hydration and local Supabase integration evidence for exact nested values and owner isolation.
- **Active OpenSpec drift:** older onboarding UI artifacts describe clickable navigation and outdated verification counts. Mitigation: modify the capability explicitly and reconcile affected stale claims before archive rather than treating them as current acceptance evidence.
- **Sensitive schedule exposure:** availability is personal routine data. Mitigation: keep errors and test diagnostics sanitized and avoid logging snapshots, raw owner identity, or payload contents.
- **Review size pressure:** coordinated UI, contract, tests, and documentation may approach the approved budget. Mitigation: track authored lines by workstream and stop for explicit scope review before exceeding 1,500 lines.

## Rollback

- Revert the coordinated web, API, contract, test, and documentation change together; do not roll back only one contract consumer.
- No database rollback or data transformation is required because this change adds no migration and relies on an already-clean database state.
- If the new Step 4 must be disabled before release, restore the previous UI and matching contract/runtime validators from the same known-good revision. Do not reintroduce removed fields into only one layer.
- Exact `minutes_by_day` snapshots created by this change remain valid under the pre-change availability shape, so availability data itself does not require conversion.

## Success Criteria

- Step 4 displays the approved heading, support copy, weekday controls, base-duration interaction, optional exact per-day adjustments, `Paso 4 de 7` / `57%` non-interactive progress, and linear Back/Continue actions.
- The only persisted availability representation is the exact sparse `profile.availability.minutes_by_day` map; no base/range field appears in web payload types, API DTOs, or storage.
- Uniform persisted values hydrate to the corresponding base state, while mixed exact values hydrate as `Varía por día` without changing any day.
- Fewer than 3 days or fewer than 150 weekly minutes blocks Continue without saving; three 45-minute days produce actionable resolution copy.
- Back preserves current mounted local answers, Continue persists before advancing, failed saves retain editable answers, and reload restores only the last successfully persisted state.
- The five approved fields are absent from the canonical contract and no longer required, accepted as canonical answers, or emitted by directly dependent web/API behavior.
- Focused automated evidence proves exact UI edits, validation, PUT payload persistence, GET hydration, nested JSONB round trip, and RLS owner isolation under strict TDD.
- Directly affected product, functional, data-model, architecture, README, and OpenSpec documentation agrees with the delivered behavior and clean-state premise.
- The implementation remains within 1,500 authored changed lines unless a new explicit exception is approved.

## Proposal Question Round

The proposal-shaping round is considered resolved by the authoritative product decisions supplied for this phase. Those decisions settle the business rules, persistence model, mixed-state behavior, save timing, contract removals, clean-state premise, navigation, documentation impact, and verification boundary. No additional product assumption is introduced here. The next phase should make the base-control edit semantics and accessible interaction scenarios fully normative without changing these decisions.

## Delivery Forecast

Estimated authored change: **1,000–1,450 lines**, including implementation, strict-TDD tests, OpenSpec deltas, and directly affected documentation.

- Web UI/domain/styles and focused tests: approximately 420–650 lines.
- API/contract cleanup and tests: approximately 180–300 lines.
- E2E, API hydration, nested JSONB, and RLS proof: approximately 180–280 lines.
- OpenSpec and directly affected documentation: approximately 220–320 lines.

**1,500-line budget risk: Medium-High.** The upper estimate leaves little contingency, so tasks must track authored lines and avoid unrelated cleanup.

**One PR is coherent: Yes.** The UI payload semantics, canonical field removal, validators, persistence evidence, and documentation form one coordinated contract change. Splitting them would create intermediate revisions where the product UI and completion contract disagree. A single PR is recommended within the approved 1,500-line budget; exceeding that cap requires explicit re-scoping or a reviewed delivery exception rather than silently splitting incompatible states.
