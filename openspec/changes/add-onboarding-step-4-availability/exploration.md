# Exploration: Add Onboarding Step 4 Availability

## Goal and visual reference

`.context/onboarding_5.png` defines the fourth screen in the seven-step visual journey:

- progress: `Paso 4 de 7` and `57%`;
- heading: `¿Cuándo puedes entrenar?`;
- support copy: `Diseñaré el plan alrededor de tu vida, no al revés.`;
- multi-select weekday pills: `L, M, X, J, V, S, D`;
- one single-select approximate daily-duration option: `45 min`, `1 h–1 h 30`, or `2 h+`;
- `Atrás` and `Continuar` navigation.

The screenshot demonstrates four selected days and one selected duration, but it does not define the canonical numeric mapping, minimum valid combination, disabled state, or error copy.

## Current implementation

### Wizard and Steps 1–3

The protected route already composes the onboarding feature. `apps/web/features/onboarding/_components/onboarding-wizard.tsx` owns the accumulated draft, current internal step index, load/save state, Back/Continue actions, and save-on-advance behavior. `OnboardingStepContent` delegates to per-step components. Steps 1–3 already use the new visual treatment and shared heading/card/action layout; Step 4 is the existing `availability` internal step but still uses the legacy form.

Relevant symbols and files:

- `apps/web/features/onboarding/_components/onboarding-wizard.tsx`
  - `OnboardingWizard`, `updateAvailability`, `handleBack`, and `handleNext`.
  - Back mutates only local navigation state and does not save.
  - Continue validates, then `saveOnboardingStep` persists the full accumulated `incomplete` snapshot before moving forward.
  - Initial load calls `loadOnboardingDraft`, normalizes the stored snapshot, and selects `firstIncompleteStepIndex`.
- `apps/web/features/onboarding/_components/onboarding-step-content.tsx`
  - Steps 1–3 supply visual intro headings; `availability` currently has no intro heading.
- `apps/web/features/onboarding/_components/availability-step.tsx`
  - Current legacy UI uses seven full weekday checkbox labels and a separate numeric minutes input for every enabled day.
  - Selecting a day defaults it to 60 minutes.
- `apps/web/features/onboarding/_components/step-navigator.tsx`
  - `DISPLAYED_STEP_COUNT = 7`; internal index 3 already renders Step 4 and `Math.round(4 / 7 * 100) = 57`.
- `apps/web/features/onboarding/_domain/steps.ts`
  - `availability` is the fourth internal step and owns `profile.availability.minutes_by_day`.
- `apps/web/features/onboarding/_domain/step-validation.ts`
  - `AvailabilityDraft`, `WeekDay`, and `validateAvailabilityStep` already use the canonical sparse weekday map.
  - Local completion requires at least 3 present days, at least 150 total minutes, and each value to be an integer from 15 through 300.
- `apps/web/app/styles.css`
  - Existing visual primitives include `.onboarding-step-intro`, `.onboarding-wizard-card`, `.onboarding-pill-options`, `.onboarding-choice-pill`, and action styles.
  - `.onboarding-availability-day` is legacy-specific and should be replaced or retired rather than creating a second styling system.

No new route, feature folder, wizard state owner, or generic shared abstraction is justified. The change belongs within the existing onboarding feature boundary.

### Persistence, API, and database

The canonical persisted field already exists and the visual change does not inherently require a schema migration:

```json
{
  "profile": {
    "availability": {
      "minutes_by_day": {
        "monday": 60,
        "wednesday": 60,
        "saturday": 60
      }
    }
  }
}
```

- `openspec/specs/onboarding-contract/spec.md` defines a sparse `minutes_by_day` object, allowed English weekday keys, integer values `15..300`, omitted unavailable days, at least 3 days, and at least 150 weekly minutes.
- `apps/api/app/modules/runner_profile/domain.py::WeeklyAvailability` enforces allowed keys and `15..300`; `meets_completion_threshold` enforces 3 days and 150 total minutes.
- `apps/api/app/modules/runner_profile/validation.py::_validate_availability` rejects malformed shapes; `_add_availability_diagnostics` reports missing or insufficient availability.
- `apps/web/features/onboarding/_use-cases/save-onboarding-step.ts::saveOnboardingStep` sends the full accumulated snapshot with `state: "incomplete"` to `PUT /runner-profile/onboarding`.
- `apps/web/features/onboarding/_use-cases/load-onboarding-draft.ts::loadOnboardingDraft` reads it through `GET /runner-profile/onboarding`.
- `apps/api/app/modules/runner_profile/use_cases.py::{save_onboarding,read_onboarding}` validate and transact the snapshot.
- `apps/api/app/modules/runner_profile/repository.py::SqlAlchemyOnboardingRepository` writes and reads the whole JSONB snapshot, owner-scoped.
- `supabase/migrations/20260713110000_onboarding_snapshots.sql` stores one JSONB snapshot per `owner_id` and applies owner-only SELECT/INSERT/UPDATE/DELETE RLS policies.

Persistence semantics today are therefore:

1. Selecting values and navigating Back keeps them in React state, so returning to Step 4 in the same mounted wizard preserves them.
2. Reloading before Continue loses unsaved Step 4 edits by design; the UI contract says not to save every keystroke.
3. Continue validates and persists the full sparse weekday map before showing Step 5.
4. A later reload hydrates the persisted map and should reconstruct both selected days and the common duration choice.

The last point is only deterministic if every selected day has the same persisted duration. Existing or externally supplied snapshots may contain different per-day values, and the new single-duration UI needs an explicit hydration policy for that valid canonical shape.

### Existing verification and gaps

Existing coverage provides useful foundations but does not prove the proposed screen:

- `apps/web/features/onboarding/_domain/step-validation.test.ts` covers the 3-day/150-minute threshold and per-day bounds.
- `apps/web/features/onboarding/_use-cases/{load-onboarding-draft,save-onboarding-step}.test.ts` covers generic hydration and full-snapshot PUT behavior, but their fixtures do not assert availability round-trip semantics.
- `apps/web/e2e/onboarding.spec.ts` currently has four Step 1–3 browser tests only. It does not render, validate, persist, revisit, or reload Step 4.
- `apps/api/tests/runner_profile/test_domain.py`, `test_use_cases.py`, and `test_router.py` include canonical availability examples and validation, but do not isolate the three visual duration mappings.
- `apps/api/tests/integration/test_onboarding_rls.py` proves two-user row isolation and raw JSONB CRUD, but its stored test snapshot contains only version/state. It does not explicitly prove nested availability survives a database round trip.

A suitable strict-TDD proof should start with failing tests for a pure availability selection/mapping rule, then component behavior through Playwright, and finally focused persistence evidence. At minimum:

- unit: weekday toggle behavior, single duration selection, sparse-map generation, all three duration mappings, deselection, hydration, mixed-duration hydration policy, and threshold errors;
- integration/contract: full snapshot PUT contains only selected weekday keys with the mapped integer; GET hydration reconstructs the same UI state;
- E2E: Step 3 → Step 4 progress/copy/control semantics, required/insufficient combinations remain on Step 4 without saving, Back preserves local answers, Continue saves before Step 5, and reload resumes persisted availability;
- database/RLS: focused nested availability JSONB round trip for the owner while foreign access remains denied, unless maintainers explicitly accept existing generic JSONB/RLS proof as sufficient.

## Contract mismatch that must be resolved

The visual provides duration categories, but the active contract stores an exact integer for each selected day. The safest no-migration mapping is to treat each category as a conservative lower-bound planning value and apply it to every selected day:

| UI option | Proposed canonical value |
|---|---:|
| `45 min` | `45` |
| `1 h–1 h 30` | `60` |
| `2 h+` | `120` |

This preserves the current provider-independent contract, avoids overstating availability, and keeps downstream planning conservative. Using 75 minutes for the middle option would be a midpoint but could overbook a runner who meant 60; storing a category/range would require a contract, API validation, documentation, and potentially downstream-consumer change.

A consequence of the existing completion threshold is that exactly three selected days at 45 minutes totals 135 and MUST be rejected. Four 45-minute days, three 60-minute days, or any higher valid combination passes. The screenshot's four selected days is consistent with this rule, but the product decision and error copy are not explicit.

## Active OpenSpec dependency and drift

`openspec/changes/implement-onboarding-ui/` remains an active, completed-task change and is the direct capability dependency. Its spec correctly establishes fixed ordering, resume, save-on-advance, validation, and verification requirements. However, its recorded artifacts no longer fully describe the checked implementation:

- tasks claim a clickable persistent step navigator and seven onboarding E2E tests;
- the current `StepNavigator` is progress-only and the current E2E file contains four tests;
- tasks describe five internal steps, while the newer screen redesign presents a seven-step visual journey incrementally.

The new proposal must explicitly modify the active `onboarding-ui` capability for the Step 4 presentation and must not repeat stale claims. Before archive, maintainers should reconcile whether `implement-onboarding-ui` is the baseline to extend, should be archived/synced first, or is intentionally still active while incremental screen changes land.

There is also a broader pre-existing completion gap: current redesigned Steps 1–3 do not collect every field still marked completion-required by the backend contract (for example `training_years`, race-count/practiced arrays, and Trail/Ultra `technicality`). Step 4 can be fully functional for validation/save/resume in isolation, but the entire onboarding cannot currently prove successful final completion without resolving or deliberately scoping around those missing fields.

## Documentation impact

The implementation phase must validate and, where noted, update documentation together with behavior:

- `docs/00-product-vision.md`: already aligns with availability-driven planning; no change is required unless product semantics change.
- `docs/02-user-journeys.md`: update current implementation status to Steps 1–4 and describe the new availability interaction; keep broader OCR/Backyard caveats separate.
- `docs/04-functional-requirements.md` (`RF-05`, `RF-06`): specify selectable weekdays, one approximate duration category, canonical mapping, minimum valid combination, and persistence/resume behavior.
- `docs/05-data-model.md`: replace vague `weeklyAvailability` wording with the actual JSONB `profile.availability.minutes_by_day` sparse map and canonical units; clarify that Step 4 requires no SQL migration.
- `docs/08-architecture.md`: update current frontend status from Steps 1–3 to Steps 1–4 and state that Step 4 reuses the existing JSONB snapshot/API boundary. This document also still names Alembic despite Supabase CLI being the implemented migration authority; the directly relevant persistence section should be reconciled rather than repeating the obsolete authority.
- `README.md`: update project status, onboarding capabilities, and verification summary if coverage counts change.
- `apps/web/README.md`: it currently says only Steps 1–2 use the new design and is already stale relative to Step 3; update it to accurately describe Steps 1–4.
- `openspec/specs/onboarding-contract/spec.md`: no change is needed if categories map to existing exact minutes as proposed. A category/range payload instead would require a contract modification and substantially broaden this change.
- `openspec/changes/implement-onboarding-ui/specs/onboarding-ui/spec.md`: the new change should add a MODIFIED requirement for Step 4 visual/interaction/persistence behavior rather than editing the old change directly.

## Recommended implementation shape

1. Preserve `profile.availability.minutes_by_day` and the existing API/database schema.
2. Add a pure domain mapping between one UI duration option and canonical minutes; apply that value to every selected weekday.
3. Rewrite `AvailabilityStep` as accessible pressed/checkbox weekday controls plus a single radio group for duration, using the existing onboarding pill primitives and Step 1–3 layout.
4. Add the Step 4 heading/support copy in `OnboardingStepContent`; retain wizard-owned Back/Continue behavior.
5. Ensure hydration is deterministic and validation errors are announced and associated with the relevant groups.
6. Follow strict RED-GREEN-REFACTOR using focused unit tests before production logic, then Playwright behavior, then full web/API/RLS safety nets.
7. Update affected product, functional, data-model, architecture, root, and web documentation as part of the same delivered capability.

## Acceptance questions for proposal

1. Are the conservative canonical mappings `45`, `60`, and `120` minutes approved, or is the contract expected to store categories/ranges instead?
2. Should three days plus `45 min` be blocked under the existing 150-minute weekly minimum (recommended), with copy explaining that one more day or a longer duration is required?
3. When hydrating a valid existing snapshot whose selected days have different minute values, should Step 4 preserve it as a legacy/custom state until the user chooses a common duration, choose the minimum value conservatively, or reject it for correction?
4. Is persistence expected only on Continue, matching the active onboarding spec, so reload before Continue may discard unsaved Step 4 edits?
5. Does “fully functional” mean Step 4 save/resume is independently complete, or must this change also repair the pre-existing Steps 1–3/backend completion mismatch so the entire onboarding can finish?
6. Must the new work restore the active spec's clickable direct step navigation, or should the current linear Back/Continue navigation be treated as the approved newer behavior?

## Delivery forecast

Estimated authored change: **450–700 lines** including strict-TDD tests and required documentation.

- production UI/domain/styles: approximately 170–260 lines changed;
- unit/integration/E2E proof: approximately 180–280 lines;
- documentation/OpenSpec follow-through: approximately 100–160 lines.

**400-line budget risk: High.**

**Chained PRs recommended: Yes**, unless a maintainer grants a size exception or narrows documentation/persistence proof. A coherent split is:

1. domain mapping, validation/hydration rules, focused tests, and contract/documentation decisions;
2. Step 4 component/styles, wizard integration, Playwright behavior, nested persistence/RLS proof, and status documentation.

The second slice depends on the first. If OpenSpec artifacts count against the same 400-line budget, the split is effectively mandatory.

## Risks

- Ambiguous duration categories can silently overstate or understate training availability if mapping is not an explicit product decision.
- Three 45-minute days conflict with the existing 150-minute completion threshold; hiding that rule would create a confusing backend diagnostic or save loop.
- A global duration UI is less expressive than the canonical per-day model; mixed-duration stored drafts need a non-destructive hydration policy.
- The active `implement-onboarding-ui` artifacts have drifted from current code and test counts, creating false acceptance evidence if reused uncritically.
- Step 4 can pass while full onboarding completion remains impossible because of pre-existing missing completion-required fields in earlier redesigned steps.
- Mocked browser tests alone do not prove database persistence; backend/API/RLS evidence must be deliberately triangulated.
- Availability is personal schedule data. Tests, errors, and telemetry must not log snapshots, owner identity, or raw payload content.
- Broad documentation repair could exceed Step 4 scope; update directly relevant facts and record unrelated historical inconsistencies separately.

## Ready for proposal

Ready after the product owner answers the duration mapping, threshold, mixed-duration hydration, persistence timing, full-completion scope, and navigation questions. The preferred architecture is a frontend-only presentation/domain change over the existing canonical minutes map, with no database migration and with focused persistence/RLS regression evidence.
