# Onboarding UI Specification

## Purpose

Define an accessible, linear onboarding wizard whose fourth step collects exact weekly training availability while offering a convenient habitual-duration control.

## Requirements

### Requirement: Accessible Step 4 presentation

The wizard MUST present availability as Step 4 of the seven-step onboarding journey. It MUST show the progress text `Paso 4 de 7`, the progress value `57%`, the heading `¿Cuándo puedes entrenar?`, and the support copy `Diseñaré el plan alrededor de tu vida, no al revés.` The progress indicator MUST be non-interactive. Weekday selection, habitual-duration selection, exact per-day editing, validation feedback, Back, and Continue MUST have accessible names, visible focus, keyboard operation, and programmatic state. Validation feedback MUST be associated with the affected controls and announced to assistive technology.

#### Scenario: Runner reaches the availability step

- GIVEN the runner advances from Step 3
- WHEN Step 4 is displayed
- THEN the seven-step progress, heading, support copy, weekday controls, habitual-duration control, exact-edit affordances, Back, and Continue are present
- AND the progress indicator does not provide direct step navigation
- AND every interactive control is operable and understandable without a pointer.

### Requirement: Exact sparse availability with UI-only base duration

The UI MUST represent the runner's canonical answer solely as the sparse `profile.availability.minutes_by_day` map. A selected weekday MUST have one exact integer minute value, and an unselected weekday MUST be absent. The habitual/base duration MUST remain presentation state and MUST NOT appear in API payloads, persisted data, or the canonical contract.

The preset choices MUST map to exact planning minutes as follows:

| Base choice | Exact minutes |
| --- | ---: |
| `45 min` | `45` |
| `1 h–1 h 30` | `60` |
| `2 h+` | `120` |

Selecting a preset MUST be an explicit bulk edit that assigns its mapped value to every currently selected weekday. A weekday selected while a preset is active MUST receive that preset's mapped value. Deselecting a weekday MUST remove its key. Reselecting it MUST initialize it from the then-active preset rather than restoring an omitted value. An exact per-day edit MUST change only that weekday. The UI MUST NOT silently rewrite any other exact day value.

When `Varía por día` is displayed, selecting a new weekday MUST require an explicit exact value for that day before Continue can succeed and MUST preserve all existing day values. Choosing a preset from `Varía por día` MUST count as an explicit bulk edit and MUST replace all selected-day values with the preset's mapped value.

#### Scenario: Base choice initializes and updates selected days

- GIVEN Monday and Wednesday are selected with exact values of 45 and 75 minutes
- WHEN the runner explicitly chooses `2 h+`
- THEN Monday and Wednesday each become exactly 120 minutes
- AND the canonical answer contains no base-duration field.

#### Scenario: Exact override is isolated

- GIVEN Monday, Wednesday, and Saturday each have 60 minutes
- WHEN the runner changes Wednesday to 90 minutes
- THEN only Wednesday changes
- AND the sparse map is exactly `monday: 60`, `wednesday: 90`, and `saturday: 60`.

#### Scenario: Weekday deselection remains sparse

- GIVEN Tuesday is selected with an exact duration
- WHEN the runner deselects Tuesday
- THEN `tuesday` is omitted from `minutes_by_day`
- AND no null, zero, or disabled placeholder value is emitted.

### Requirement: Non-destructive availability hydration

Hydration MUST reconstruct weekday selection and exact minute values from the persisted sparse map without normalizing or rounding them. If all selected weekdays have the same exact value, the UI MUST present a uniform base state that retains that exact value; when the value is 45, 60, or 120, the corresponding preset MUST be selected. If selected weekdays have different exact values, the base control MUST display `Varía por día`. `Varía por día` MUST be a derived mixed-state indicator, not a persisted value, and hydration alone MUST NOT mutate the sparse map. A uniform exact value without a matching preset MUST remain visible and editable as an exact uniform value without being coerced to a preset.

#### Scenario: Supported uniform values hydrate to a preset

- GIVEN persisted availability contains Monday, Thursday, and Sunday at exactly 60 minutes each
- WHEN Step 4 hydrates
- THEN those three weekdays are selected
- AND `1 h–1 h 30` is the active base choice
- AND the persisted map is unchanged.

#### Scenario: Mixed values hydrate as varying by day

- GIVEN persisted availability contains Monday at 45, Wednesday at 75, and Saturday at 120 minutes
- WHEN Step 4 hydrates
- THEN those weekdays and exact values are retained
- AND the base control displays `Varía por día`
- AND no value changes until the runner explicitly edits a day or chooses a preset.

#### Scenario: Non-preset uniform value remains exact

- GIVEN persisted availability contains three selected days at exactly 75 minutes each
- WHEN Step 4 hydrates
- THEN the UI presents a uniform 75-minute state
- AND it does not coerce the days to 45, 60, or 120 minutes.

### Requirement: Actionable availability validation

Continue MUST validate the exact sparse map and MUST remain on Step 4 without saving when any selected value is not an integer from 15 through 300, fewer than 3 weekdays are selected, or the weekly total is below 150 minutes. Validation feedback MUST identify the unmet rule and provide an actionable remedy. When both the day count and weekly total fail, both remedies MUST be communicated. In particular, three 45-minute days MUST be rejected with guidance to add another day or increase available time.

#### Scenario: Three short days do not meet the threshold

- GIVEN exactly three weekdays are selected at 45 minutes each
- WHEN the runner presses Continue
- THEN the UI reports that the 150-minute weekly minimum is not met
- AND it tells the runner to add another day or increase available time
- AND no save request occurs
- AND Step 4 remains displayed with the entered values intact.

#### Scenario: Too few days do not advance

- GIVEN two weekdays total at least 150 minutes
- WHEN the runner presses Continue
- THEN the UI reports that at least 3 days are required
- AND no save request occurs
- AND Step 4 remains displayed.

### Requirement: Save-on-Continue and linear local navigation

Back and Continue MUST be the only Step 4 navigation actions. Back MUST move to Step 3 without saving and MUST preserve Step 4 edits in the mounted wizard state so returning locally restores them. Reload before a successful Continue MAY discard unsaved Step 4 edits. Continue MUST validate first and, when valid, persist the full accumulated onboarding snapshot with `state: "incomplete"` before Step 5 is shown. The UI MUST prevent duplicate Continue requests while saving.

If saving fails, Step 4 MUST remain displayed, all editable answers MUST remain intact, and the runner MUST be able to retry. The failure message MUST be actionable and sanitized: it MUST NOT expose raw payloads, backend details, storage details, or owner identity. Reload after a successful save MUST hydrate the last successfully persisted availability rather than later unsaved edits.

#### Scenario: Back preserves unsaved availability locally

- GIVEN the runner has edited Step 4 without pressing Continue
- WHEN the runner presses Back and then returns to Step 4 in the same mounted wizard
- THEN the edits are restored from local wizard state
- AND no save request was made by Back.

#### Scenario: Successful Continue saves before advancing

- GIVEN Step 4 contains at least 3 days and at least 150 exact weekly minutes
- WHEN the runner presses Continue
- THEN one save request containing the exact sparse map completes successfully before Step 5 is displayed
- AND no base-duration field is included.

#### Scenario: Failed save preserves editable state

- GIVEN Step 4 is valid
- WHEN the Continue save fails
- THEN Step 4 remains displayed with every selected day and exact value intact
- AND the runner sees a sanitized retryable error
- AND Step 5 is not displayed.

### Requirement: Step 4 behavior verification

Automated verification MUST cover preset mappings, weekday toggling, exact overrides, uniform and mixed hydration, non-preset exact hydration, threshold failures, accessibility semantics, local Back preservation, save ordering, failed-save retention, persisted reload hydration, and omission of the UI-only base duration. Verification MUST include browser-level behavior and focused domain or component checks.

#### Scenario: Step 4 verification suite runs

- GIVEN the onboarding UI verification environment
- WHEN the focused automated suite runs
- THEN every required mapping, edit, hydration, validation, accessibility, navigation, save, failure, and reload behavior is exercised
- AND assertions compare exact sparse minute values rather than approximate labels alone.

### Requirement: UI documentation consistency

Directly affected product journey, functional requirements, architecture, root README, web README, and active OpenSpec documentation MUST describe Step 4 as a seven-step, linear, save-on-Continue workflow with exact sparse availability and a UI-only base convenience. They MUST NOT claim clickable progress, autosave, persisted duration categories, or obsolete Step 4 verification results.

#### Scenario: Step 4 documentation is reviewed

- GIVEN the delivered Step 4 behavior
- WHEN directly affected documentation is compared with the UI and its automated evidence
- THEN navigation, copy, persistence timing, exact-value semantics, and verification claims agree with the delivered capability.
