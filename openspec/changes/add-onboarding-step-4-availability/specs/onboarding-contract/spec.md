# Delta for Onboarding Contract

## ADDED Requirements

### Requirement: Clean-state removal of uncollected answers

The active version 1 contract MUST NOT define, require, accept as canonical answers, or emit `profile.prior_history.training_years`, `profile.prior_history.completed_race_count_range`, `profile.prior_history.practiced_modalities`, `profile.prior_history.practiced_terrain`, or `goal.technicality`. Web and API contract consumers MUST use the reduced contract as a coordinated clean-state replacement. They MUST NOT add a compatibility parser, legacy translator, payload sanitizer, migration, or historical-field preservation behavior for these fields.

The system MAY assume that records containing these fields were deleted before deployment. If that clean-state premise is false, release MUST stop until the contract or operational state is corrected; the application MUST NOT conceal the mismatch with unplanned compatibility behavior.

#### Scenario: Reduced payload completes without removed fields

- GIVEN a payload supplies every applicable retained completion-required answer but omits all five removed fields
- WHEN completion validation runs
- THEN the removed fields produce no requiredness diagnostics
- AND the payload can complete when all retained rules pass.

#### Scenario: Removed fields are not canonical answers

- GIVEN an input includes one or more of the five removed field identifiers
- WHEN the version 1 contract boundary parses or emits onboarding data
- THEN those fields are not accepted or emitted as canonical answers
- AND no translation, sanitization, migration, or preservation branch is invoked.

#### Scenario: Clean-state premise fails before release

- GIVEN persisted records containing removed fields are discovered before deployment
- WHEN release readiness is evaluated
- THEN deployment is blocked pending an explicit correction
- AND compatibility behavior is not silently added under this change.

## MODIFIED Requirements

### Requirement: Canonical field catalog and answer types

The contract MUST use the following stable identifiers, answer types, requiredness, and canonical units. Fields marked **completion-required** are required only when `state` is `completed`; fields marked conditional are required only when their condition is true. All unmarked optional fields MAY be absent.

| Block | Stable field identifier | Answer type / allowed values | Requiredness and canonical unit |
| --- | --- | --- | --- |
| profile | `profile.prior_history.longest_completed_distance_km` | non-negative number | completion-required; kilometres |
| profile | `profile.baseline_4_weeks.sessions` | non-negative integer | completion-required; sessions in preceding 4 calendar weeks |
| profile | `profile.baseline_4_weeks.distance_km` | non-negative number | completion-required; kilometres in preceding 4 calendar weeks |
| profile | `profile.baseline_4_weeks.positive_elevation_m` | non-negative number | completion-required; metres in preceding 4 calendar weeks |
| profile | `profile.baseline_4_weeks.longest_outing_km` | non-negative number | completion-required; kilometres in preceding 4 calendar weeks |
| profile | `profile.baseline_4_weeks.recent_consistency` | enum: `irregular`, `fairly_consistent`, `very_consistent` | completion-required; perceived consistency across the preceding 4 calendar weeks |
| profile | `profile.availability.minutes_by_day` | sparse object; only `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`, and `sunday` keys are allowed; present values are integers 15–300 | completion-required for at least 3 present days and at least 150 total weekly minutes; omitted day means unavailable; null values and unknown keys are invalid |
| profile | `profile.restrictions.has_restrictions` | boolean | completion-required |
| profile | `profile.restrictions.detail` | trimmed string, length 1–500 | conditional-required when `has_restrictions=true`; otherwise absent and cleared |
| goal | `goal.modality` | enum: `trail`, `ultra_trail`, `ocr`, `backyard` | completion-required |
| goal | `goal.target_date` | string `YYYY-MM-DD` | completion-required; local calendar date |
| goal | `goal.target_distance_km` | positive number | conditional-required for `trail`, `ultra_trail`, `ocr`; kilometres |
| goal | `goal.positive_elevation_m` | positive number | conditional-required for `trail`, `ultra_trail`; metres |
| goal | `goal.max_altitude_m` | non-negative integer | optional for `trail`, `ultra_trail`; estimated maximum metres above sea level |
| goal | `goal.obstacle_count` | positive integer, >=1 | conditional-required for `ocr`; obstacles |
| goal | `goal.obstacle_difficulty` | enum `low`, `medium`, `high` | optional for `ocr` |
| goal | `goal.target_loops` | positive integer, >=1 | conditional-required for `backyard`; loops |

This is a coordinated clean-state replacement of the active version 1 contract. API and web MUST be deployed together against a persisted state that contains none of the removed fields. The contract MUST NOT include compatibility shapes or migration behavior for the removed fields.

The contract MUST NOT include `experience_level`, plan approach, Backyard target hours, cycle duration, rest margin, box/transition notes, or a habitual/base availability duration. The fixed Backyard cycle is 60 minutes, so downstream derived target hours equal `target_loops` and are not user inputs. Estimated maximum altitude remains optional to avoid blocking runners who do not know it.

Optional OCR obstacle difficulty MUST describe the predominant obstacle demands:

- `low`: obstacles mainly require basic coordination and ordinary movement skills, with limited strength or technique demands.
- `medium`: obstacles recurrently require moderate grip, carrying, climbing, balance, or specific technique.
- `high`: obstacles predominantly impose high strength, endurance, coordination, or technical demands and may cause substantial delays or failure penalties.

The value describes the target event's obstacles rather than the runner's perceived ability.

(Previously: The catalog completion-required four additional prior-history answers and required `goal.technicality` for trail and ultra-trail goals.)

#### Scenario: Baseline requires recent consistency rather than training hours

- GIVEN a runner supplies the four baseline numeric answers for the preceding four calendar weeks and `recent_consistency=fairly_consistent`
- WHEN the previous-four-week baseline is validated
- THEN completion succeeds without `training_hours`, while an absent or noncanonical `recent_consistency` blocks completion.

#### Scenario: Removed training hours do not satisfy completion

- GIVEN a payload has the four retained baseline metrics and a stray `training_hours` key but omits `recent_consistency`
- WHEN the baseline is validated
- THEN completion remains blocked because `recent_consistency` is required and no legacy compatibility shape is recognized.

#### Scenario: Exact availability has no base field

- GIVEN a runner is available Monday for 45 minutes, Wednesday for 75 minutes, and Saturday for 120 minutes
- WHEN the canonical answer is represented
- THEN `profile.availability.minutes_by_day` contains exactly those weekday keys and integer values
- AND no habitual duration, category, range, or `Varía por día` value appears in the payload.

#### Scenario: OCR obstacle difficulty is event-based

- GIVEN two runners with different abilities select the same OCR event
- WHEN optional obstacle difficulty is supplied
- THEN they use the predominant event demands rather than rating their personal ability.

#### Scenario: Backyard inputs are limited

- GIVEN a Backyard goal
- WHEN it is validated
- THEN only `target_date` and positive `target_loops` are accepted as user goal inputs, and `target_loops=0` is rejected.

### Requirement: Availability threshold

`profile.availability.minutes_by_day` MUST be a sparse object whose only allowed keys are `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`, and `sunday`. A present key means that day is available and its exact value MUST be an integer from 15 through 300 inclusive. An unavailable day MUST be omitted. Null values, unknown keys, approximate categories, ranges, and UI-only base-duration values are invalid canonical answers. Completion MUST require at least 3 present available days and at least 150 total minutes per week. Validation diagnostics MUST distinguish an insufficient day count, an insufficient weekly total, and invalid day values so clients can present actionable correction guidance.

(Previously: Availability used the same sparse weekday map and thresholds but did not explicitly exclude UI convenience values or require distinguishable actionable diagnostics.)

#### Scenario: Availability is insufficient

- GIVEN fewer than 3 present days, fewer than 150 total minutes, a null day value, or an unknown day key
- WHEN completion is requested
- THEN a blocking validation error identifies each failed availability rule.

#### Scenario: Three 45-minute days fail the weekly minimum

- GIVEN exactly three present weekdays each contain 45 minutes
- WHEN completion is requested
- THEN the day-count rule passes
- AND a blocking weekly-total diagnostic reports that 135 minutes is below 150.

#### Scenario: Exact mixed availability is valid

- GIVEN Monday contains 45, Wednesday contains 75, and Saturday contains 120 minutes
- WHEN completion is requested
- THEN the exact mixed values satisfy the availability rule
- AND no normalization to a common duration occurs.

### Requirement: Dates, modality goals, and outcomes

Target dates MUST be local date-only `YYYY-MM-DD` values. Validation MUST receive an explicit runner-facing local validation date and compare `goal.target_date` with that date as date-only values; it MUST NOT derive today from the server timezone. A target date equal to or before the supplied validation date is a blocking error, while every later date is contract-valid. Trail and ultra-trail goals require positive distance and positive elevation; OCR requires positive distance and obstacle count while obstacle difficulty remains optional; Backyard requires positive loops. Blocking errors MUST be separate from non-blocking planning warnings and keyed by stable identifiers.

(Previously: Trail and ultra-trail goals additionally required `goal.technicality`.)

#### Scenario: Date and modality validation is testable

- GIVEN runner-facing local validation date `2026-07-13`, one OCR goal with `target_date=2026-07-13`, and another with `target_date=2026-07-14` but missing obstacle count
- WHEN completion is requested with that explicit validation date
- THEN the equal date produces a blocking `goal.target_date` error, the later date does not produce a date error regardless of server timezone, its missing count produces a blocking `goal.obstacle_count` error, and a near-date warning, if any, does not block completion.

#### Scenario: Trail goal completes without technicality

- GIVEN a trail or ultra-trail goal has a future target date, positive distance, positive elevation, and every other retained completion-required answer
- WHEN completion is requested without `goal.technicality`
- THEN technicality produces no diagnostic
- AND the goal passes when all retained rules pass.

### Requirement: Contract documentation and verification consistency

Directly affected product, functional-requirement, data-model, architecture, README, OpenSpec, validator, diagnostic, fixture, and automated-test artifacts MUST describe and exercise the reduced field catalog and exact sparse availability contract. They MUST NOT claim that removed fields remain required or canonical, that a UI base duration is persisted, or that compatibility and migration behavior exists for the clean-state replacement.

#### Scenario: Contract artifacts are reconciled

- GIVEN the reduced contract is ready for delivery
- WHEN directly dependent documentation, validation, diagnostics, fixtures, and tests are reviewed
- THEN all five removed fields are absent from active canonical behavior
- AND exact sparse availability and the clean-state premise are represented consistently.
