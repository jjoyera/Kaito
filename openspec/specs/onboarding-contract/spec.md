# Onboarding Contract Specification

## Purpose

Define the provider-agnostic, versioned onboarding contract for an authenticated runner. The contract is independent of UI order and storage, and separates profile context from the current goal.

## Requirements

### Requirement: Versioned profile-and-goal payload

The system MUST define one payload with `contract_version` (string), `state` (enum: `incomplete` or `completed`), `profile`, and `goal` blocks. The initial supported `contract_version` MUST be exactly the string `"1"`. Unknown versions MUST be rejected or handled by an explicit version translator before contract validation. The payload MUST NOT contain owner identity, UI-step concepts, or storage concepts. Ownership MUST come from verified `UserContext.user_id`.

#### Scenario: Payload is presentation-independent

- GIVEN a valid onboarding payload
- WHEN a consumer reads it
- THEN it can identify the version, state, profile, and goal without knowing UI order or tables.

### Requirement: Canonical field catalog and answer types

The contract MUST use the following stable identifiers, answer types, requiredness, and canonical units. Fields marked **completion-required** are required only when `state` is `completed`; fields marked conditional are required only when their condition is true. All unmarked optional fields MAY be absent.

| Block | Stable field identifier | Answer type / allowed values | Requiredness and canonical unit |
| --- | --- | --- | --- |
| profile | `profile.prior_history.training_years` | non-negative number in increments of 0.5 | completion-required; years; accepts zero, whole years, and half-years only |
| profile | `profile.prior_history.completed_race_count_range` | enum: `none`, `one_to_three`, `four_to_ten`, `eleven_to_twenty_five`, `twenty_six_plus` | completion-required; count range maps exactly to 0, 1–3, 4–10, 11–25, 26+ |
| profile | `profile.prior_history.longest_completed_distance_km` | non-negative number | completion-required; kilometres |
| profile | `profile.prior_history.practiced_modalities` | explicitly supplied array of enum values: `trail`, `ultra_trail`, `ocr`, `backyard`; MAY be empty | completion-required; modality identifiers; absence means unanswered |
| profile | `profile.prior_history.practiced_terrain` | explicitly supplied array of enum values: `road`, `trail`, `mountain`, `mixed`; MAY be empty | completion-required; an empty array means no prior terrain experience; absence means unanswered |
| profile | `profile.baseline_4_weeks.sessions` | non-negative integer | completion-required; sessions in preceding 4 calendar weeks |
| profile | `profile.baseline_4_weeks.distance_km` | non-negative number | completion-required; kilometres in preceding 4 calendar weeks |
| profile | `profile.baseline_4_weeks.positive_elevation_m` | non-negative number | completion-required; metres in preceding 4 calendar weeks |
| profile | `profile.baseline_4_weeks.longest_outing_km` | non-negative number | completion-required; kilometres in preceding 4 calendar weeks |
| profile | `profile.baseline_4_weeks.recent_consistency` | enum: `irregular`, `fairly_consistent`, `very_consistent` | completion-required; perceived consistency across the preceding 4 calendar weeks |
| profile | `profile.availability.minutes_by_day` | sparse object; only `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`, and `sunday` keys are allowed; present values are integers 15–300 | completion-required for at least 3 present days; omitted day means unavailable; null values and unknown keys are invalid |
| profile | `profile.restrictions.has_restrictions` | boolean | completion-required |
| profile | `profile.restrictions.detail` | trimmed string, length 1–500 | conditional-required when `has_restrictions=true`; otherwise absent and cleared |
| goal | `goal.modality` | enum: `trail`, `ultra_trail`, `ocr`, `backyard` | completion-required |
| goal | `goal.target_date` | string `YYYY-MM-DD` | completion-required; local calendar date |
| goal | `goal.target_distance_km` | positive number | conditional-required for `trail`, `ultra_trail`, `ocr`; kilometres |
| goal | `goal.positive_elevation_m` | positive number | conditional-required for `trail`, `ultra_trail`; metres |
| goal | `goal.technicality` | enum `low`, `medium`, `high` | conditional-required for `trail`, `ultra_trail` |
| goal | `goal.max_altitude_m` | non-negative integer | optional for `trail`, `ultra_trail`; estimated maximum metres above sea level |
| goal | `goal.obstacle_count` | positive integer, >=1 | conditional-required for `ocr`; obstacles |
| goal | `goal.obstacle_difficulty` | enum `low`, `medium`, `high` | optional for `ocr` |
| goal | `goal.target_loops` | positive integer, >=1 | conditional-required for `backyard`; loops |

This change is a coordinated clean-state replacement of the active version 1 contract, with no backward-compatibility promise for the removed `training_hours` field. Existing test JSONB will be discarded manually before deployment; this contract does not claim or verify that operational deletion. API and web MUST be deployed together against the clean state.

The contract MUST NOT include `experience_level`, plan approach, Backyard target hours, cycle duration, rest margin, or box/transition notes. The fixed Backyard cycle is 60 minutes, so downstream derived target hours equal `target_loops` and are not user inputs. Trail and ultra-trail completion requires a technicality answer, while estimated maximum altitude remains optional to avoid blocking runners who do not know it.

Trail and ultra-trail technicality values MUST use observable route characteristics:

- `low`: predominantly stable, runnable surfaces with few obstacles and no sustained need for precise foot placement.
- `medium`: recurring uneven terrain, rocks, roots, loose surfaces, or steep sections that require active foot placement and may occasionally interrupt running.
- `high`: sustained technical terrain with frequent obstacles, unstable or very steep surfaces, scrambling, or exposed sections that materially constrain running.

The value describes the target route rather than the runner's perceived skill.

Optional OCR obstacle difficulty MUST describe the predominant obstacle demands:

- `low`: obstacles mainly require basic coordination and ordinary movement skills, with limited strength or technique demands.
- `medium`: obstacles recurrently require moderate grip, carrying, climbing, balance, or specific technique.
- `high`: obstacles predominantly impose high strength, endurance, coordination, or technical demands and may cause substantial delays or failure penalties.

The value describes the target event's obstacles rather than the runner's perceived ability.

#### Scenario: Race-count ranges are stable

- GIVEN a runner with 0, 2, 7, 20, or 30 completed races
- WHEN prior history is validated
- THEN the accepted values are respectively `none`, `one_to_three`, `four_to_ten`, `eleven_to_twenty_five`, and `twenty_six_plus`.

#### Scenario: New runner can explicitly report no practiced modalities

- GIVEN a new runner submits `completed_race_count_range=none`, `longest_completed_distance_km=0`, and `practiced_modalities=[]`
- WHEN prior history is validated
- THEN the values are accepted, the empty array means the runner has no prior experience in the supported modalities, and an absent `practiced_modalities` field remains unanswered.

#### Scenario: Training history uses whole and half-years

- GIVEN a runner submits `training_years=0`, `training_years=1`, or `training_years=1.5`
- WHEN prior history is validated
- THEN the value is accepted, while values that are negative or not divisible by 0.5 are rejected.

#### Scenario: Baseline requires recent consistency rather than training hours

- GIVEN a runner supplies the four baseline numeric answers for the preceding four calendar weeks and `recent_consistency=fairly_consistent`
- WHEN the previous-four-week baseline is validated
- THEN completion succeeds without `training_hours`, while an absent or noncanonical `recent_consistency` blocks completion.

#### Scenario: Removed training hours do not satisfy completion

- GIVEN a payload has the four retained baseline metrics and a stray `training_hours` key but omits `recent_consistency`
- WHEN the baseline is validated
- THEN completion remains blocked because `recent_consistency` is required and no legacy compatibility shape is recognized.

#### Scenario: No practiced terrain uses an empty array

- GIVEN a runner has no prior terrain experience
- WHEN prior history is supplied
- THEN `practiced_terrain=[]` is accepted, no `none` enum value is used, and an absent `practiced_terrain` field remains unanswered.

#### Scenario: Trail technicality is route-based

- GIVEN two runners with different experience levels select the same target route
- WHEN they describe its technicality
- THEN they use the same observable route criteria rather than rating their personal ability.

#### Scenario: OCR obstacle difficulty is event-based

- GIVEN two runners with different abilities select the same OCR event
- WHEN optional obstacle difficulty is supplied
- THEN they use the predominant event demands rather than rating their personal ability.

#### Scenario: Backyard inputs are limited

- GIVEN a Backyard goal
- WHEN it is validated
- THEN only `target_date` and positive `target_loops` are accepted as user goal inputs, and `target_loops=0` is rejected.

### Requirement: Resumable lifecycle and authoritative completion

The system MUST accept an `incomplete` draft with absent completion-required fields and preserve its supplied answers across sessions. Supplied draft answers MUST remain structurally parseable and use the canonical answer types, but they MAY temporarily fail completion constraints such as requiredness, range, conditional, or date rules. Draft validation MAY return diagnostics without rejecting preservation of those typed answers. `completed` MUST require every applicable completion-required field to pass validation. Any edit to completed data MUST trigger full revalidation. If revalidation fails, the state MUST transition automatically to `incomplete`, the typed answers MUST remain available for correction, and consumers MUST NOT treat the onboarding as completion-valid.

#### Scenario: Incomplete draft is resumed

- GIVEN an incomplete payload missing completion-required fields
- WHEN it is resumed later
- THEN it remains valid as incomplete with supplied answers intact.

#### Scenario: Typed but completion-invalid draft answer is preserved

- GIVEN an incomplete draft contains a correctly typed answer that fails a completion range or date rule
- WHEN the draft is preserved
- THEN the answer remains available for later correction, validation returns a diagnostic, and the draft cannot be treated as completed.

#### Scenario: Structurally invalid draft answer is rejected

- GIVEN an incomplete draft contains an answer that cannot be parsed as its canonical type
- WHEN the draft boundary validates it
- THEN that malformed answer is rejected rather than preserved as canonical onboarding data.

#### Scenario: Completed data is edited

- GIVEN a completed payload
- WHEN an applicable required field becomes absent or invalid
- THEN validation fails, state transitions automatically to `incomplete`, supplied typed answers remain available for correction, and consumers cannot treat the onboarding as completed.

### Requirement: Deterministic conditional clearing

Requiredness and visibility MUST be deterministic from typed answers. When a controlling answer hides a field, the hidden answer MUST be cleared, including restriction detail when restrictions become false and modality-specific fields when modality changes.

#### Scenario: Restriction detail is cleared

- GIVEN `has_restrictions=true` and a detail
- WHEN it changes to false
- THEN `detail` is absent and no longer retained.

### Requirement: Objective history and separate four-week baseline

Prior history MUST remain observable and separate from the previous four calendar weeks' baseline. Neither set may select or imply a plan approach.

#### Scenario: History and baseline remain separate

- GIVEN valid history and baseline values
- WHEN the payload is consumed
- THEN each is independently addressable and no approach is selected by the contract.

### Requirement: Availability threshold

`profile.availability.minutes_by_day` MUST be a sparse object whose only allowed keys are `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`, and `sunday`. A present key means that day is available and its value MUST be an integer from 15 through 300 inclusive. An unavailable day MUST be omitted. Null values and unknown keys are invalid. Completion MUST require at least 3 present available days and at least 150 total minutes per week.

#### Scenario: Availability is insufficient

- GIVEN fewer than 3 present days, fewer than 150 total minutes, a null day value, or an unknown day key
- WHEN completion is requested
- THEN a blocking validation error is returned.

### Requirement: Restrictions are bounded self-reported context

The contract MUST validate only boolean presence, conditional detail presence, trimmed length 1–500, and clearing. It MUST NOT semantically detect or reject diagnostic or medical wording. Consumers and product copy MUST treat detail as self-reported practical training context, not diagnosis or treatment. Pain, active injury, or medical-risk text MUST trigger a safety notice, if applicable, rather than making otherwise valid text invalid.

#### Scenario: Restriction text is not semantically rejected

- GIVEN `has_restrictions=true` and trimmed detail of 1–500 characters, including medical-risk wording
- WHEN the contract is validated
- THEN it passes text validation; any safety notice is separate and non-blocking to text acceptance.

### Requirement: Dates, modality goals, and outcomes

Target dates MUST be local date-only `YYYY-MM-DD` values. Validation MUST receive an explicit runner-facing local validation date and compare `goal.target_date` with that date as date-only values; it MUST NOT derive today from the server timezone. A target date equal to or before the supplied validation date is a blocking error, while every later date is contract-valid. Trail/ultra-trail require positive distance, positive elevation, and technicality; OCR requires positive distance and obstacle count while obstacle difficulty remains optional; Backyard requires positive loops. Blocking errors MUST be separate from non-blocking planning warnings and keyed by stable identifiers.

#### Scenario: Date and modality validation is testable

- GIVEN runner-facing local validation date `2026-07-13`, one OCR goal with `target_date=2026-07-13`, and another with `target_date=2026-07-14` but missing obstacle count
- WHEN completion is requested with that explicit validation date
- THEN the equal date produces a blocking `goal.target_date` error, the later date does not produce a date error regardless of server timezone, its missing count produces a blocking `goal.obstacle_count` error, and a near-date warning, if any, does not block completion.

### Requirement: Scope exclusions

The contract MUST NOT define persistence, migrations, database schema, UI sequencing, endpoints, plan generation, eligibility, or approach selection. Downstream planning owns feasibility warnings and Backyard rest-margin strategy.

#### Scenario: Planning receives contract data

- GIVEN a validated payload
- WHEN planning consumes it
- THEN planning evaluates feasibility, approach eligibility, and rest strategy rather than onboarding validation.
