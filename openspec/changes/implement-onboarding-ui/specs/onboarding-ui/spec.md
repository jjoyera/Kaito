## ADDED Requirements

### Requirement: Protected step-by-step onboarding wizard

The system SHALL present a multi-step wizard at the protected onboarding
route for the authenticated runner, covering, in a fixed order: goal
(modality and its conditional fields), prior history, 4-week baseline,
weekly availability, and restrictions. Plan-approach selection, eligibility,
plan generation, dashboard, and training-log content MUST NOT appear in this
wizard.

#### Scenario: Authenticated runner opens onboarding for the first time

- **GIVEN** an authenticated runner with no stored onboarding snapshot
- **WHEN** the runner opens the onboarding route
- **THEN** the wizard SHALL start at the first step with every field blank
- **AND** it SHALL NOT display plan-approach selection or eligibility content

### Requirement: Resume from an existing stored draft

On entry, the wizard SHALL read the runner's existing snapshot and hydrate
every step's fields from it before the runner can interact with the form. An
absent snapshot SHALL start the wizard blank rather than showing an error.

#### Scenario: Runner returns to an incomplete draft

- **GIVEN** a runner has a stored `incomplete` snapshot with some steps
  already answered
- **WHEN** the runner opens the onboarding route
- **THEN** every previously answered field SHALL be pre-filled from the
  stored snapshot
- **AND** the runner SHALL be able to continue from an unanswered step

#### Scenario: Runner has no stored snapshot yet

- **GIVEN** a runner has never saved onboarding data
- **WHEN** the runner opens the onboarding route
- **THEN** the wizard SHALL start at the first step with no error state

### Requirement: Save progress on step advance

Advancing from one step to the next SHALL persist the full accumulated
snapshot (all answers gathered so far across every step) with
`state: "incomplete"`, because the underlying API replaces the single
per-owner snapshot rather than patching individual fields. The system MUST
NOT save on every keystroke. Only the final step MAY submit
`state: "completed"`.

#### Scenario: Runner advances through steps

- **GIVEN** a runner has filled the current step's fields
- **WHEN** the runner advances to the next step
- **THEN** the system SHALL persist the accumulated snapshot with
  `state: "incomplete"` before showing the next step

#### Scenario: A save fails and answers are preserved

- **GIVEN** a runner advances to the next step
- **WHEN** the save request fails for any reason (network, validation, or
  persistence-unavailable)
- **THEN** the runner's entered answers SHALL remain in the form
- **AND** the runner SHALL be able to retry without re-entering data

### Requirement: Each step enforces its own completion before advancing

Each step SHALL validate its answers against the onboarding contract's
canonical types, ranges, and conditional field rules, AND SHALL require
every completion-required field belonging to that step to be present and
valid, before the runner can advance to the next step. A structurally
invalid answer or an empty completion-required field on the current step
MUST block advancing past it.

#### Scenario: Structurally invalid answer blocks advance

- **GIVEN** a runner enters a negative value for a field that must be
  non-negative
- **WHEN** the runner attempts to advance to the next step
- **THEN** the wizard SHALL show a field-level validation error
- **AND** it SHALL NOT advance or save the invalid value

#### Scenario: Empty required field on the current step blocks advance

- **GIVEN** a runner leaves a completion-required field on the current step
  empty
- **WHEN** the runner attempts to advance to the next step
- **THEN** the wizard SHALL show a field-level required error
- **AND** it SHALL NOT advance to the next step

### Requirement: Linear navigation preserves local answers

The progress indicator SHALL be non-interactive. Back and Continue are the
only navigation actions. Back SHALL preserve mounted local answers without a
save; Continue SHALL validate and persist before advancing. A failed save
keeps answers available for retry.

#### Scenario: Runner returns locally to Step 4

- **GIVEN** a runner edits availability without saving
- **WHEN** the runner uses Back and then returns with Continue
- **THEN** the mounted wizard restores the local values
- **AND** Back made no persistence request

### Requirement: Completion triggers full validation and demotion handling

The final step SHALL offer a completion action that submits
`state: "completed"`. If the backend returns diagnostics because a required
field is missing or invalid, the wizard MUST present the affected validation
without treating onboarding as complete until a subsequent completion attempt
succeeds.

#### Scenario: Completion succeeds

- **GIVEN** every completion-required field is valid
- **WHEN** the runner submits the final step
- **THEN** the system SHALL persist `state: "completed"`
- **AND** the wizard SHALL show a completion confirmation

#### Scenario: Completion is rejected and demoted

- **GIVEN** an answer that was valid when entered becomes invalid by the
  time the runner submits the final step (for example, a target date that
  is no longer in the future after a long resume gap)
- **WHEN** the backend returns diagnostics and a demoted `incomplete` state
- **THEN** the wizard SHALL retain the diagnostic without treating onboarding as complete
- **AND** it SHALL NOT show a completion confirmation

### Requirement: Deterministic conditional fields mirror the contract

Modality-specific goal fields and restriction detail visibility SHALL follow
the same deterministic rules as the onboarding contract: changing
`goal.modality` MUST show only the fields applicable to the new modality and
clear values for fields that no longer apply, and setting
`profile.restrictions.has_restrictions` to false MUST clear and hide the
restriction detail field.

#### Scenario: Changing modality clears hidden goal fields

- **GIVEN** a runner has entered OCR-specific fields
- **WHEN** the runner changes the goal modality to Backyard
- **THEN** the OCR-specific fields SHALL be hidden
- **AND** their previously entered values SHALL be cleared from the
  accumulated snapshot

#### Scenario: Disabling restrictions clears the detail field

- **GIVEN** a runner has `has_restrictions=true` with a detail entered
- **WHEN** the runner sets `has_restrictions` to false
- **THEN** the detail field SHALL be hidden
- **AND** its value SHALL be cleared from the accumulated snapshot

### Requirement: Sanitized loading, save, and error states

The wizard SHALL present a loading state while reading the initial snapshot,
a saving state while persisting a step, and a sanitized error state when the
backend reports a persistence-unavailable, corrupt-data, or unexpected
failure. Error states MUST NOT expose raw backend error details, owner
identity, or storage internals.

#### Scenario: Backend persistence is unavailable

- **GIVEN** the runner advances to the next step
- **WHEN** the save request fails with a persistence-unavailable response
- **THEN** the wizard SHALL show a generic, sanitized unavailability message
- **AND** it SHALL NOT display raw error payloads or backend details

### Requirement: Kaito-aligned visual treatment

The onboarding wizard SHALL use Kaito's documented brand palette and tone: warm
sand or off-white surfaces, forest-green primary actions, restrained
orange/golden accents, and calm, encouraging step-by-step copy. It MUST avoid
generic blue SaaS styling, medical styling, and aggressive gym branding.

#### Scenario: Brand review of the onboarding wizard

- **GIVEN** the onboarding wizard is reviewed against Kaito's brand palette
- **WHEN** the screens are evaluated for tone and readability
- **THEN** they SHALL feel like a calm digital mountain coach guiding the
  runner step by step

### Requirement: Onboarding UI verification coverage

The change SHALL include automated verification for resume-from-draft
hydration, save-on-advance persistence, per-step completion enforcement,
linear Back/Continue behavior, conditional field clearing, completion success,
and completion demotion with diagnostics.

#### Scenario: Onboarding UI tests exercise the wizard

- **GIVEN** the onboarding UI verification suite runs in the web validation
  environment
- **WHEN** mocked or controlled API responses are exercised
- **THEN** the suite SHALL prove resume hydration, save-on-advance behavior,
  linear navigation without data loss, per-step completion
  enforcement, conditional clearing, and both completion outcomes
