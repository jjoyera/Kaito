# Design: Add Onboarding Step 4 Availability

## 1. Design goals and constraints

This change extends the existing onboarding feature boundary. It does not add a route, persistence model, database object, compatibility layer, or generic form framework.

The design has four authorities:

1. `profile.availability.minutes_by_day` is the only canonical availability answer.
2. `OnboardingWizard` remains the owner of the mounted wizard, accumulated snapshot, navigation, and save lifecycle.
3. FastAPI validation remains the canonical server contract boundary; the existing owner-scoped JSONB repository remains the persistence boundary.
4. Supabase CLI migrations remain the schema and RLS authority, although this change adds no migration.

The following are explicit constraints:

- Base-duration mode, mixed-state indication, and pending exact edits are presentation state only.
- The five removed fields are rejected rather than stripped, translated, migrated, or preserved.
- Existing records containing those fields are outside the supported runtime state and must have been removed before release.
- Back never saves; Continue validates and saves before advancing.
- One coordinated PR must remain at or below 1,500 authored changed lines.

## 2. Architecture overview

```text
Step 4 controls
    │  AvailabilityAction
    ▼
availability-model.ts (pure reducer + hydration + validation)
    │
    ├── AvailabilityInteractionState (wizard-local, never serialized)
    └── minutesByDay projection
             │
             ▼
OnboardingWizard accumulated draft
             │ validate on Continue
             ▼
saveOnboardingStep(state="incomplete")
             │ PUT /runner-profile/onboarding
             ▼
FastAPI parse/validate ── reject noncanonical removed fields
             │
             ▼
SqlAlchemyOnboardingRepository
             │ owner-derived upsert
             ▼
onboarding_snapshots.snapshot JSONB + RLS
             │
             └── GET → server validation → wizard hydration → pure Step 4 hydration
```

The component layer renders state and emits actions. It does not implement mapping, hydration, bulk-edit, or sparse-map rules. The pure model does not perform I/O and does not know about React, HTTP, or JSONB.

## 3. Pure Step 4 interaction model

### 3.1 New domain module

Add `apps/web/features/onboarding/_domain/availability-model.ts` with the following conceptual contracts:

```ts
type AvailabilityPresetMinutes = 45 | 60 | 120;

type AvailabilityBaseMode =
  | { kind: "unset" }
  | { kind: "preset"; minutes: AvailabilityPresetMinutes }
  | { kind: "uniform-custom"; minutes: number }
  | { kind: "mixed" };

type AvailabilityInteractionState = {
  minutesByDay: Partial<Record<WeekDay, number>>;
  pendingDays: readonly WeekDay[];
  baseMode: AvailabilityBaseMode;
};

type AvailabilityAction =
  | { type: "toggle-day"; day: WeekDay }
  | { type: "choose-preset"; minutes: AvailabilityPresetMinutes }
  | { type: "set-exact-minutes"; day: WeekDay; minutes: number | undefined };

type AvailabilityIssue =
  | "exact_value_required"
  | "invalid_day_value"
  | "insufficient_days"
  | "insufficient_weekly_minutes";
```

The module exports constants for weekday order and the approved preset mapping:

- `45 min` → `45`
- `1 h–1 h 30` → `60`
- `2 h+` → `120`

It also exports pure functions equivalent to:

- `hydrateAvailability(minutesByDay)`
- `reduceAvailability(state, action)`
- `validateAvailabilityInteraction(state)`
- `selectedAvailabilityDays(state)`
- `toAvailabilityDraft(state)`

No base-mode or pending-day property is added to `AvailabilityDraft`, the API payload type, or server data.

### 3.2 Hydration rules

`hydrateAvailability` copies the sparse map without rounding, normalization, or mutation and derives presentation state as follows:

| Persisted map | Derived base mode | Mutation during hydration |
| --- | --- | --- |
| Empty | `unset` | None |
| All values `45` | preset `45` | None |
| All values `60` | preset `60` | None |
| All values `120` | preset `120` | None |
| All values equal to another valid exact value, such as `75` | `uniform-custom(75)` | None |
| Two or more different values | `mixed` (`Varía por día`) | None |

Hydration always starts with no pending days. An empty draft intentionally has no invented default duration. A runner may choose a preset before selecting days, or select days first and supply exact values or subsequently apply a preset.

### 3.3 Mutation rules

The reducer applies these deterministic rules:

| Action | Result |
| --- | --- |
| Select a day while a preset is active | Add that key with the preset's exact minutes. |
| Select a day while a valid custom uniform value is active | Add that key with the same exact value. |
| Select a day while mode is `mixed` or `unset` | Add the day to `pendingDays`; do not add a null, zero, or undefined placeholder to `minutesByDay`. |
| Deselect a mapped or pending day | Remove it from both collections. |
| Choose a preset | Assign that exact value to every mapped and pending selected day, clear pending days, and set the chosen preset mode. This is the only bulk rewrite. |
| Edit an existing exact value | Change only that day. |
| Enter an exact value for a pending day | Add only that key and remove it from pending days. |
| Clear an exact input | Remove the key and retain the day as pending so the visible edit is not silently discarded. |

After isolated edits or deselection, the reducer derives the visible mode from the remaining values: a supported uniform value becomes its preset, another valid uniform value becomes `uniform-custom`, and differing values become `mixed`. If all mapped days are removed, an explicitly selected preset or custom uniform mode remains active for the current mounted wizard; otherwise mode becomes `unset`. This local choice survives Back because the wizard owns the interaction state, but it is lost on reload unless exact saved values allow it to be derived again.

Invalid transient number input is retained for correction but is never used as a base for initializing another day and cannot pass validation or reach persistence.

### 3.4 Canonical projection and validation

`toAvailabilityDraft` projects only `minutesByDay`:

```json
{
  "minutes_by_day": {
    "monday": 45,
    "wednesday": 75,
    "saturday": 120
  }
}
```

Pending days and base mode are omitted. Continue is blocked while any pending day lacks an exact value or any mapped value is not an integer in `15..300`.

When exact values are structurally valid, validation independently reports:

- fewer than three selected days;
- a weekly total below 150 minutes.

Therefore, three 45-minute days report only the weekly-total issue with guidance to add another day or increase available time. A valid exact state that fails both thresholds reports both remedies. Threshold messages are not computed while exact values are missing or invalid, because the eventual total is not yet known.

`validateAvailabilityStep` remains the generic draft-level check used by resume/step discovery. It delegates its map rules to the same pure validation logic after hydration, while the wizard uses the richer issue list for Step 4 feedback.

## 4. Component and accessibility design

### 4.1 `AvailabilityStep`

Rewrite `apps/web/features/onboarding/_components/availability-step.tsx` as a presentational component receiving `AvailabilityInteractionState`, current `AvailabilityIssue[]`, and an action callback.

The rendered structure is:

- a weekday `fieldset` with seven native checkbox inputs styled as compact weekday pills;
- a habitual-duration `fieldset` with three native radio inputs for the approved presets;
- a programmatic derived-state description that announces `Varía por día` or the custom uniform value when no preset radio is checked;
- labeled numeric inputs for mapped and pending selected days, enabling exact overrides;
- one validation region containing all current actionable issues.

Native checkbox/radio/input semantics provide keyboard behavior and programmatic state. Visible labels use full weekday names for accessible names while abbreviated visual text may be marked `aria-hidden`. Each fieldset and exact input references the validation region through `aria-describedby`; invalid inputs/groups use `aria-invalid`. The validation region uses `role="alert"` on Continue failures. Existing focus-visible primitives are reused or extended for every control.

The component does not render progress or navigation. It does not own save state and does not serialize data.

### 4.2 Step heading and styling

`apps/web/features/onboarding/_components/onboarding-step-content.tsx` adds the approved Step 4 heading and support copy. `StepNavigator` already renders non-interactive `Paso 4 de 7`, `57%`, and a progressbar, so it remains behaviorally unchanged and receives regression coverage rather than a new navigation mechanism.

`apps/web/app/styles.css` reuses `.onboarding-pill-options`, `.onboarding-choice-pill`, card, error, and focus primitives. Add only availability layout selectors required for weekday sizing, exact-edit rows, and mixed/custom status. Remove the legacy `.onboarding-availability-day` rules and their mobile override when no longer referenced. No parallel design system is introduced.

## 5. Wizard orchestration and data flow

### 5.1 State ownership

`OnboardingWizard` stores a composite local wizard state containing:

- the accumulated `OnboardingSnapshotDraft`;
- the `AvailabilityInteractionState` derived from that draft on blank initialization or GET hydration.

Availability actions atomically update the interaction state and its `minutes_by_day` projection in the accumulated draft. Keeping the two values inside one parent state transition avoids React state skew. Step 4 issues are maintained separately from generic field errors so multiple availability remedies can be shown without changing every existing component's single-field error contract.

On successful GET:

1. API validates and returns the clean canonical snapshot.
2. `normalizeWizardDraft` handles only retained draft structure; it no longer creates removed practiced-array defaults.
3. `hydrateAvailability` derives the Step 4 interaction state from exact persisted values.
4. `firstIncompleteStepIndex` uses canonical draft validation and server diagnostics as today.

### 5.2 Back and Continue

Back performs only local navigation, clears displayed validation/save errors, and leaves the composite wizard state mounted. Returning to Step 4 therefore restores mapped values, pending exact edits, and the active base mode. It does not call PUT.

Continue follows this ordering:

1. Ignore the event if a save is already in flight. Use a synchronous in-flight ref in addition to the disabled button so two events cannot begin two requests before React renders the disabled state.
2. For Step 4, run `validateAvailabilityInteraction`; for other steps, run existing step validation.
3. If invalid, set associated issues and remain on Step 4 without calling the save use case.
4. Project the validated sparse map into the accumulated snapshot and apply retained conditional clearing.
5. Call `saveOnboardingStep` with the full accumulated snapshot and `state: "incomplete"`.
6. Keep Step 4 visible and disable both navigation controls while the promise is pending.
7. Advance to Step 5 only after a successful response.

If PUT fails, release the in-flight guard, retain the complete composite state, show the existing bounded retry message, and permit another Continue. No response body, backend exception, payload, owner, schedule, or storage detail is displayed. Reload after failure returns the last server snapshot; reload after success hydrates the saved exact map. There is no autosave, save-on-Back, or direct progress navigation.

## 6. Clean-state contract reduction

### 6.1 Web boundary

Remove these properties from web domain types, step field catalogs, normalization, conditional clearing, diagnostics fixtures, completion fixtures, and tests:

- `profile.prior_history.training_years`
- `profile.prior_history.completed_race_count_range`
- `profile.prior_history.practiced_modalities`
- `profile.prior_history.practiced_terrain`
- `goal.technicality`

Rename the enum type used by retained `goal.obstacle_difficulty` so it does not retain a misleading `Technicality` domain name. Type the onboarding API snapshot profile and goal from the reduced draft contract rather than allowing removed properties through an application-authored payload type. Presentation-only availability types stay in `availability-model.ts` and are not part of that API type.

Do not add a web sanitizer. A stale stored shape cannot reach the web because server read validation fails safely. The clean-state operational premise is what permits direct type removal.

### 6.2 API boundary

Update `apps/api/app/modules/runner_profile/validation.py` with an explicit noncanonical-field rejection executed before any hidden-field clearing or normalization. Presence of any of the five keys rejects a save before a transaction opens and makes a stored snapshot corrupt on read. The rejection checks key presence regardless of value and never mutates, strips, or translates input.

Remove the five fields from:

- structural number, array, and string checks;
- completion-required lists;
- prior-history range diagnostics;
- modality-conditional goal requiredness;
- hidden-field clearing sets;
- constants used only by those fields.

Retained conditional clearing continues for retained fields such as restriction detail and modality-specific goal properties. It is not compatibility handling for the removed fields.

Availability diagnostics become bounded and distinguishable:

- `availability_insufficient_days`
- `availability_insufficient_total`
- a stable invalid-availability 422 classification for structurally invalid weekday keys/values

Diagnostic metadata remains empty and must not contain selected days, counts, totals, owner data, or payload fragments. Removed fields produce no completion diagnostics because they are not canonical answers; their presence is a rejected shape.

`domain.py`, `repository.py`, `schemas.py`, and the SQL migration are expected to require no production change: they intentionally store the validated mapping as one JSONB snapshot and already derive owner identity from `UserContext`. Their focused tests are updated only where fixtures currently contain removed fields.

## 7. Persistence, JSONB, RLS, and diagnostics verification

Verification is triangulated at separate boundaries:

1. **Web use-case boundary:** assert the PUT snapshot contains exact sparse values and no base, mixed, pending, or removed field.
2. **FastAPI/use-case boundary:** save a reduced snapshot, read it for the same verified owner, and compare the exact nested availability map. Assert removed-field saves are rejected before repository access, invalid writes do not replace an existing snapshot, and stale stored shapes return the existing sanitized corrupt-data response without rewrite.
3. **Repository/JSONB boundary:** retain one owner row and verify exact nested keys and integers survive JSONB write/read and equivalent retry semantics.
4. **Local Supabase RLS boundary:** use two authenticated non-privileged identities. Prove own-row insert/select/update/delete with nested availability and cross-owner select/insert/update/delete denial or zero affected rows. No service-role result counts as RLS proof.

New assertion helpers compare exact values but raise bounded messages such as `availability round-trip mismatch`; they do not interpolate snapshots, exact schedules, or owner identifiers. Synthetic identity fixture representations stay redacted. Application and test logging must never print request bodies or SQL parameters. HTTP failures remain bounded (`Invalid onboarding snapshot`, `Stored onboarding snapshot is invalid`, or `Service unavailable`) and no new logging is needed.

No migration, column, index, policy, JSONB transformation, Alembic artifact, or history table is added.

## 8. File change plan

### Web production

| File | Change |
| --- | --- |
| `apps/web/features/onboarding/_domain/availability-model.ts` | New pure hydration/reducer/validation/projection model. |
| `apps/web/features/onboarding/_domain/step-validation.ts` | Remove five fields/types, rename obstacle difficulty type, delegate canonical availability checks. |
| `apps/web/features/onboarding/_domain/steps.ts` | Remove deleted identifiers from step ownership. |
| `apps/web/features/onboarding/_domain/wizard-draft.ts` | Remove practiced-array normalization and preserve only retained structure. |
| `apps/web/features/onboarding/_domain/conditional-clearing.ts` | Remove `goal.technicality` from the type and clearing tables. |
| `apps/web/features/onboarding/_components/availability-step.tsx` | Replace legacy form with accessible controlled Step 4 presentation. |
| `apps/web/features/onboarding/_components/onboarding-step-content.tsx` | Add approved heading/copy and pass interaction state/issues/actions. |
| `apps/web/features/onboarding/_components/onboarding-wizard.tsx` | Own composite availability state, rich validation, in-flight guard, and save ordering. |
| `apps/web/features/onboarding/_adapters/onboarding-api.ts` | Use the reduced typed snapshot contract; keep UI-only state out. |
| `apps/web/app/styles.css` | Add focused availability layout and remove obsolete legacy rules. |

### Web tests

| File | Boundary |
| --- | --- |
| `apps/web/features/onboarding/_domain/availability-model.test.ts` | New table-driven pure model tests. |
| `apps/web/features/onboarding/_domain/step-validation.test.ts` | Exact threshold and reduced type/validation behavior. |
| `apps/web/features/onboarding/_domain/{steps,wizard-draft,conditional-clearing,diagnostic-mapping}.test.ts` | Remove stale field expectations and prove retained behavior. |
| `apps/web/features/onboarding/_use-cases/{save-onboarding-step,load-onboarding-draft,complete-onboarding}.test.ts` | Exact payload/GET hydration and reduced fixtures. |
| `apps/web/e2e/onboarding.spec.ts` | Step 4 accessibility, mutation, validation, navigation, save, retry, and reload scenarios. |

### API production and tests

| File | Change |
| --- | --- |
| `apps/api/app/modules/runner_profile/validation.py` | Reject removed keys, remove their validation/diagnostics, split availability classifications. |
| `apps/api/tests/runner_profile/test_use_cases.py` | Reduced fixtures; atomic rejection, stale read, diagnostics, exact save/read. |
| `apps/api/tests/runner_profile/test_router.py` | Reduced HTTP fixture, bounded 422/500, exact response hydration. |
| `apps/api/tests/runner_profile/test_repository.py` | Replace removed-field fixture while retaining JSON serialization proof. |
| `apps/api/tests/integration/test_onboarding_rls.py` | Add nested exact availability to own-row JSONB and cross-owner CRUD proof. |

No production change is planned for API repository/domain/router composition or Supabase migrations unless a failing approved test proves an existing boundary cannot satisfy the specification. Such a discovery requires design review before broadening scope.

## 9. Strict TDD sequence and exact test boundaries

Strict TDD is active. Every production behavior change follows RED → GREEN → REFACTOR, with the failing assertion and focused command recorded before implementation.

### Cycle 0: Baseline

Run and record:

```sh
pnpm test:web-onboarding
cd apps/api && uv run pytest tests/runner_profile/test_use_cases.py tests/runner_profile/test_router.py tests/runner_profile/test_repository.py -q
```

Existing failures must be separated from change-induced RED evidence before editing production code.

### Cycle 1: Pure availability and reduced web contract

**RED:** Add table-driven tests for all three mappings; unset/preset/mixed/custom hydration; non-destructive mixed hydration; selection in each mode; pending exact values; sparse deselection/reselection; isolated overrides; explicit bulk preset replacement; invalid exact values; independent day/weekly thresholds; and UI-only-state omission. Update reduced web type/catalog/fixture tests first.

Focused command:

```sh
cd apps/web && pnpm exec tsx --test "features/onboarding/_domain/*.test.ts"
```

**GREEN:** Add the pure model and minimum reduced web type/catalog changes. **REFACTOR:** consolidate tables/constants without weakening exact-map assertions.

### Cycle 2: API clean-state and diagnostics

**RED:** Update reduced fixtures and add tests proving successful completion without removed fields, rejection of each removed key before transaction access, unchanged prior storage after an invalid save, stale stored-shape safe failure, split day/total diagnostics, exact save/read hydration, and sanitized HTTP classifications.

Focused command:

```sh
cd apps/api && uv run pytest tests/runner_profile/test_use_cases.py tests/runner_profile/test_router.py tests/runner_profile/test_repository.py -q
```

**GREEN:** Make the minimum `validation.py` changes. **REFACTOR:** remove constants/functions made dead by the contract reduction and run Ruff on the touched module/tests.

### Cycle 3: Step 4 component and wizard lifecycle

**RED:** Add focused Playwright scenarios before component/wizard production edits:

1. approved progress/copy and keyboard-operable weekday/radio/exact controls;
2. preset mapping, exact override, sparse deselection, mixed-state preservation, and non-preset uniform hydration;
3. three 45-minute days and too-few-days attempts remain on Step 4 and make no PUT;
4. Back preserves mounted pending/exact/base state and makes no PUT;
5. Continue issues one PUT, remains on Step 4 while pending, and shows Step 5 only after success;
6. failed save retains edits and a retry succeeds without duplicate requests;
7. reload restores the last successful exact map and never a later unsaved edit.

Focused command:

```sh
cd apps/web && pnpm exec playwright test e2e/onboarding.spec.ts
```

**GREEN:** Rewrite the component, wire composite wizard state, add the heading, and adjust styles. **REFACTOR:** remove legacy selectors and deduplicate E2E navigation/response helpers while preserving behavior-level assertions.

### Cycle 4: Existing JSONB/RLS behavior characterization

The database shape and policies already exist, so a nested JSONB/RLS test may be GREEN on first execution. Do not fabricate a production defect or migration to force RED. Record this as characterization/approval coverage, then strengthen only the test fixture and sanitized assertions.

Required local proof:

```sh
npx supabase@2.39.2 start
npx supabase@2.39.2 db reset --local
cd apps/api && uv run pytest tests/integration/test_onboarding_rls.py -q
```

A Docker/Supabase environment failure is a blocked verification result, not a pass and not justification for mock-only substitution.

### Final regression boundary

```sh
pnpm test:web-onboarding
pnpm lint:web
pnpm build:web
pnpm test:web-e2e
cd apps/api && uv run ruff check .
cd apps/api && uv run pytest tests/ --ignore=tests/integration -q
cd apps/api && uv run pytest tests/integration/test_onboarding_rls.py -q
```

Tests must assert outcomes, request ordering, exact sparse values, and accessible roles/names. They must not assert implementation-only CSS selectors, tautologies, type existence alone, or raw sensitive diagnostics.

## 10. Documentation reconciliation

Update only directly affected statements, preserving Spanish in existing Spanish documents and English in OpenSpec technical artifacts:

| Document | Reconciliation |
| --- | --- |
| `docs/00-product-vision.md` | State exact life-constrained availability without introducing duration categories as stored data. |
| `docs/02-user-journeys.md` | Advance implemented visual status through Step 4; describe linear Back/Continue and save-on-Continue. |
| `docs/04-functional-requirements.md` | Define preset mappings, exact overrides, 3-day/150-minute rules, reduced fields, and retry behavior. |
| `docs/05-data-model.md` | Replace vague weekly availability wording with the exact sparse JSONB path; state no base field/migration. |
| `docs/08-architecture.md` | Identify protected API + owner JSONB + Supabase migrations/RLS as authority; remove directly affected Alembic claim and update Step 4 status. |
| `README.md` | Update implemented onboarding capability and verification summary without duplicating detailed specs. |
| `apps/web/README.md` | Describe Steps 1–4, exact Step 4 behavior, and current focused commands. |
| `openspec/specs/onboarding-contract/spec.md` | Reconcile the canonical field catalog, availability diagnostics, clean-state premise, and no compatibility behavior. |
| Active onboarding UI/persistence OpenSpec material | Reconcile stale clickable-navigation, persistence, and verification-count claims through the normal OpenSpec sync/archive path; do not edit unrelated historical archives. |

Documentation verification combines targeted searches for removed runtime identifiers with manual comparison against the delivered UI/API behavior. Historical archived artifacts are not rewritten.

## 11. Delivery, review workload, and rollout

### 11.1 Single-PR boundary

One PR is required because the reduced payload, web emitter, API accept/reject rules, completion diagnostics, persistence evidence, and documentation are one contract revision. Splitting web and API would create an intermediate unsupported contract. Commits may be organized by TDD cycle, but the review and release unit remains one PR.

### 11.2 Authored-line controls

Count authored additions plus deletions for all implementation, tests, documentation, and OpenSpec files in the PR. Use `git diff --numstat` after every cycle and maintain this working allocation:

| Workstream | Soft ceiling |
| --- | ---: |
| Web model/component/wizard/styles | 330 |
| Web unit/use-case/E2E tests | 390 |
| API validation and focused tests | 300 |
| JSONB/RLS verification | 120 |
| Documentation and canonical OpenSpec reconciliation | 260 |
| Contingency | 100 |
| **Hard cap** | **1,500** |

Controls:

- prefer table-driven test cases and existing fixtures/helpers;
- add one pure availability module, not a new generic form framework;
- reuse existing CSS and API/repository boundaries;
- make paragraph-level documentation edits only;
- add no dependency or generated lockfile change;
- review the ledger at 750, 1,100, and 1,350 lines;
- at 1,350 lines, forecast all remaining required work; if completion can exceed 1,500, stop before editing and request explicit re-scope or exception;
- never omit API/RLS/security evidence merely to fit the cap.

Given the expected size and persistence/data-contract risk, post-apply review is expected to be high tier. Start native bounded review once for the immutable post-apply target, use the facade-selected lenses, correct only within its budget, and reuse the resulting content-bound receipt for later lifecycle gates.

### 11.3 Release precondition and rollout

Before release, verify the clean-state premise with an aggregate-only operational check that counts snapshots containing any removed key. The check must not select owner IDs or snapshot bodies. A nonzero count blocks deployment and requires revising the change or cleaning operational state outside this application change; it does not trigger a compatibility parser.

Deploy web and API as one coordinated release against that confirmed clean state. No migration step runs. After deployment, verify one authenticated reduced save/read and the normal sanitized health/telemetry signals without logging payloads.

Rollback reverts the web, API, tests, and contract/documentation revision together. Existing exact `minutes_by_day` snapshots remain valid and need no transformation. Do not restore removed fields in only one layer.

## 12. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Mixed exact values are silently overwritten | Hydration is pure and non-mutating; only explicit preset choice performs a bulk edit. |
| Pending mixed-day selection leaks null/undefined | Pending days live outside the canonical map and projection; Continue blocks until exact. |
| Duplicate Continue creates concurrent saves | Disabled controls plus a synchronous in-flight guard. |
| Web/API contract drift during field removal | One reduced typed web payload, explicit API rejection, shared fixtures, one PR, coordinated deployment. |
| Clean-state premise is false | Aggregate pre-release gate blocks deployment; no runtime sanitizer or translator. |
| Mock tests overstate persistence confidence | Separate HTTP, repository/JSONB, and real local-Supabase two-owner RLS evidence. |
| Diagnostics disclose schedules or owners | Stable codes, empty metadata, redacted assertion helpers, no payload/SQL logging. |
| Scope expands beyond the 1,500-line cap | Workstream ceilings, three checkpoints, table-driven tests, and mandatory stop before cap breach. |
| Existing OpenSpec/documentation drift creates false evidence | Reconcile only active/directly affected claims and leave historical archives immutable. |
