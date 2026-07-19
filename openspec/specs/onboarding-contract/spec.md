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
| profile | `profile.prior_history.longest_completed_distance_km` | non-negative number | completion-required; kilometres |
| profile | `profile.prior_history.habitual_terrain` | enum: `mountain`, `trail`, `road`, `mixed` | completion-required; personalization context only |
| profile | `profile.prior_history.mountain_experience` | enum: `low`, `medium`, `high` | completion-required |
| profile | `profile.prior_history.prior_modality_race_frequency` | enum: `never`, `once`, `multiple` | completion-required |
| profile | `profile.baseline_4_weeks.sessions` | non-negative integer | completion-required; sessions in preceding 4 calendar weeks |
| profile | `profile.baseline_4_weeks.distance_km` | non-negative number | completion-required; kilometres in preceding 4 calendar weeks |
| profile | `profile.baseline_4_weeks.positive_elevation_m` | non-negative number | completion-required; metres in preceding 4 calendar weeks |
| profile | `profile.baseline_4_weeks.longest_outing_km` | non-negative number | completion-required; kilometres in preceding 4 calendar weeks |
| profile | `profile.baseline_4_weeks.total_running_minutes` | non-negative integer | completion-required; total running minutes in preceding 4 calendar weeks |
| profile | `profile.baseline_4_weeks.longest_outing_duration_minutes` | non-negative integer | completion-required; duration of the longest outing in preceding 4 calendar weeks |
| profile | `profile.baseline_4_weeks.longest_outing_positive_elevation_m` | non-negative integer | completion-required; positive elevation of the longest outing in preceding 4 calendar weeks |
| profile | `profile.baseline_4_weeks.recent_consistency` | enum: `irregular`, `fairly_consistent`, `very_consistent` | completion-required; perceived consistency across the preceding 4 calendar weeks |
| profile | `profile.availability.minutes_by_day` | sparse object; only `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`, and `sunday` keys are allowed; present values are integers 15–300 | completion-required for at least 3 present days and 150 total weekly minutes; omitted day means unavailable; null values and unknown keys are invalid |
| profile | `profile.training_preferences.mountain_trail_access` | enum: `easy_access`, `weekends_only`, `very_limited` | completion-required |
| profile | `profile.training_preferences.gym_access` | enum: `yes`, `home_only` | completion-required |
| profile | `profile.training_preferences.planning_preference` | enum: `fixed_routine`, `flexible_weekly` | completion-required |
| profile | `profile.physical_status.status` | enum: `feeling_good`, `carrying_fatigue`, `recovering` | completion-required |
| profile | `profile.physical_status.has_pain_or_limitation` | boolean | completion-required |
| profile | `profile.physical_status.pain_or_limitation_affects_running` | boolean | conditional-required when `has_pain_or_limitation=true` |
| profile | `profile.physical_status.pain_or_limitation_detail` | string, maximum 500 characters after trimming surrounding whitespace | optional descriptive text when `has_pain_or_limitation=true`; blank values are omitted and internal whitespace/newlines are preserved |
| goal | `goal.modality` | enum: `trail`, `ultra_trail`, `ocr`, `backyard` | completion-required |
| goal | `goal.target_date` | string `YYYY-MM-DD` | completion-required; local calendar date |
| goal | `goal.target_distance_km` | positive number | conditional-required for `trail`, `ultra_trail`, `ocr`; kilometres |
| goal | `goal.positive_elevation_m` | positive number | conditional-required for `trail`, `ultra_trail`; metres |
| goal | `goal.max_altitude_m` | non-negative integer | optional for `trail`, `ultra_trail`; estimated maximum metres above sea level |
| goal | `goal.obstacle_count` | positive integer, >=1 | conditional-required for `ocr`; obstacles |
| goal | `goal.obstacle_difficulty` | enum `low`, `medium`, `high` | optional for `ocr` |
| goal | `goal.target_loops` | positive integer, >=1 | conditional-required for `backyard`; loops |

The active version 1 contract is a coordinated clean-state replacement: it MUST NOT define, require, accept as canonical answers, emit, translate, sanitize, migrate, or preserve `profile.prior_history.training_years`, `profile.prior_history.completed_race_count_range`, `profile.prior_history.practiced_modalities`, `profile.prior_history.practiced_terrain`, or `goal.technicality`. API and web MUST deploy together against a state without those keys; a stale stored shape fails safely rather than being rewritten. Because Kaito is pre-launch and has no production users, this clean-state update requires no production data migration or compatibility/version translator.

The contract MUST NOT include `experience_level`, plan approach, Backyard target hours, cycle duration, rest margin, box/transition notes, or a habitual/base availability duration. The fixed Backyard cycle is 60 minutes, so downstream derived target hours equal `target_loops` and are not user inputs. Estimated maximum altitude remains optional to avoid blocking runners who do not know it.

Optional OCR obstacle difficulty MUST describe the predominant obstacle demands:

- `low`: obstacles mainly require basic coordination and ordinary movement skills, with limited strength or technique demands.
- `medium`: obstacles recurrently require moderate grip, carrying, climbing, balance, or specific technique.
- `high`: obstacles predominantly impose high strength, endurance, coordination, or technical demands and may cause substantial delays or failure penalties.

The value describes the target event's obstacles rather than the runner's perceived ability.

#### Scenario: Removed fields are rejected as noncanonical

- GIVEN a payload includes any removed field
- WHEN the API validates or reads the snapshot
- THEN it rejects the noncanonical shape without a compatibility branch
- AND a prior valid snapshot is not rewritten.

#### Scenario: Baseline requires running-time and longest-outing load

- GIVEN a runner supplies all seven baseline numeric answers for the preceding four calendar weeks and `recent_consistency=fairly_consistent`
- WHEN the previous-four-week baseline is validated
- THEN completion requires `total_running_minutes`, `longest_outing_duration_minutes`, and `longest_outing_positive_elevation_m` in addition to sessions, distance, total positive elevation, and longest-outing distance.

#### Scenario: New baseline fields use strict non-negative integers

- GIVEN any of `total_running_minutes`, `longest_outing_duration_minutes`, or `longest_outing_positive_elevation_m` is negative, fractional, boolean, or otherwise not an integer
- WHEN the baseline is validated
- THEN completion is blocked with a stable field diagnostic.

#### Scenario: Longest outing cannot exceed four-week totals

- GIVEN `longest_outing_duration_minutes` exceeds `total_running_minutes` or `longest_outing_positive_elevation_m` exceeds `positive_elevation_m`
- WHEN the baseline is validated
- THEN completion is blocked on the inconsistent longest-outing field.

#### Scenario: Removed generic training hours do not satisfy completion

- GIVEN a payload has the retained baseline metrics and a stray `training_hours` key but omits `total_running_minutes`
- WHEN the baseline is validated
- THEN completion remains blocked because the canonical running-minute field is required and no legacy compatibility shape is recognized.

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

Requiredness and visibility MUST be deterministic from typed answers. When a controlling answer hides a field, the hidden answer MUST be cleared, including modality-specific fields when modality changes.

### Requirement: Objective history and separate four-week baseline

Prior history MUST remain observable and separate from the previous four calendar weeks' baseline. Neither set may select or imply a plan approach.

#### Scenario: History and baseline remain separate

- GIVEN valid history and baseline values
- WHEN the payload is consumed
- THEN each is independently addressable and no approach is selected by the contract.

#### Scenario: Backend validates prior-history enums

- GIVEN a completed payload with a missing, wrongly typed, or unrecognized `habitual_terrain`, `mountain_experience`, or `prior_modality_race_frequency`
- WHEN the backend validates the snapshot
- THEN malformed types are rejected and missing or unrecognized enum values prevent completion with stable field diagnostics
- AND browser validation alone is never trusted.

### Requirement: Availability threshold

`profile.availability.minutes_by_day` MUST be a sparse object whose only allowed keys are `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`, and `sunday`. A present key means that day is available and its value MUST be an integer from 15 through 300 inclusive. An unavailable day MUST be omitted. Null values and unknown keys are invalid. Completion MUST require at least 3 present available days and at least 150 total minutes per week.

#### Scenario: Availability is insufficient

- GIVEN fewer than 3 present days, fewer than 150 total minutes, a null day value, or an unknown day key
- WHEN completion is requested
- THEN a blocking validation error is returned.

### Requirement: Training preferences are explicit required choices

The contract MUST require mountain/trail access, gym access, and planning preference under `profile.training_preferences`. Each value MUST use its documented enum and MUST NOT be defaulted when absent.

#### Scenario: A training preference is missing

- GIVEN a snapshot without one of the three training preference choices
- WHEN completion is requested
- THEN the snapshot remains incomplete with a required diagnostic for that field.

#### Scenario: A training preference is outside its enum

- GIVEN a training preference value outside its documented enum
- WHEN completion is requested
- THEN the snapshot remains incomplete with an out-of-range diagnostic for that field.

### Requirement: Physical status is explicit and safely normalized

The contract MUST require `profile.physical_status.status` and the boolean `profile.physical_status.has_pain_or_limitation`. When pain or a limitation is present, `profile.physical_status.pain_or_limitation_affects_running` MUST also be present. `profile.physical_status.pain_or_limitation_detail` remains optional descriptive text, MUST be trimmed only at its surrounding boundary, MUST preserve internal whitespace and newlines, and MUST be omitted when blank. Its normalized value MUST NOT exceed 500 characters. When `has_pain_or_limitation=false`, both impact and detail MUST be cleared deterministically. Legacy `profile.restrictions` MUST continue to be removed rather than translated or reused.

#### Scenario: Absence of pain clears dependent answers

- GIVEN `has_pain_or_limitation=false` with stale impact or detail answers
- WHEN the snapshot is normalized
- THEN impact and detail are omitted deterministically.

#### Scenario: Pain impact is completion-required conditionally

- GIVEN `has_pain_or_limitation=true` without `pain_or_limitation_affects_running`
- WHEN completion is requested
- THEN completion is blocked with a stable diagnostic for the impact field.

#### Scenario: Optional physical detail is normalized

- GIVEN a valid physical status and a detail with surrounding whitespace and internal newlines
- WHEN the snapshot is saved
- THEN surrounding whitespace is removed, internal whitespace and newlines are preserved, and the normalized detail round-trips unchanged.

#### Scenario: Blank physical detail is omitted

- GIVEN a valid physical status with no meaningful detail
- WHEN the snapshot is saved
- THEN completion remains valid and `pain_or_limitation_detail` is omitted.

### Requirement: Dates, modality goals, and outcomes

Target dates MUST be local date-only `YYYY-MM-DD` values. Validation MUST receive an explicit runner-facing local validation date and compare `goal.target_date` with that date as date-only values; it MUST NOT derive today from the server timezone. A target date equal to or before the supplied validation date is a blocking error, while every later date is contract-valid. Trail/ultra-trail require positive distance and elevation; OCR requires positive distance and obstacle count while obstacle difficulty remains optional; Backyard requires positive loops. Blocking errors MUST be separate from non-blocking planning warnings and keyed by stable identifiers.

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
