# Training Approach Eligibility Specification

## Purpose

Define the deterministic, auditable boundary that decides which training intensities a runner may select. AI generates a plan only after this policy has produced an eligibility result and safety restrictions.

## Requirements

### Requirement: Stable protected resource contract

The API MUST expose `GET /planning/training-approach-eligibility?assessment_date=YYYY-MM-DD`. It MUST authenticate the caller, derive ownership from verified `UserContext.user_id`, and read that owner's persisted onboarding without updating it. Without a trusted runner timezone, the explicit query date MUST exactly equal the trusted injected UTC current date. Any other date MUST return 422 with `assessment_date_out_of_range`; the trusted UTC date is passed to the deterministic policy.

The successful response MUST contain:

- `recommended_approach`: `kaio_path` or `mode_z`;
- `approaches`: exactly `kaio_path`, `mode_z`, and `kaioken`, in that low-to-high intensity order;
- each approach's `available` boolean and ordered `blocking_reason_codes` array;
- top-level `safety_restriction_codes`.

Codes are stable machine-readable localization keys. Free-generated explanations MUST NOT be the sole contract.

Blocking codes are:

| Code | Failed condition |
| --- | --- |
| `recovering` | Mode Z disallows recovery state |
| `pain_affects_running` | Mode Z disallows pain/limitation affecting running |
| `physical_status_not_feeling_good` | Kaioken requires `feeling_good` |
| `pain_or_limitation_present` | Kaioken requires no pain/limitation |
| `insufficient_weekly_sessions` | Weekly sessions threshold |
| `insufficient_recent_consistency` | Approach consistency threshold |
| `insufficient_volume_ratio` | Kaioken volume ratio threshold |
| `insufficient_experience_ratio` | Approach experience ratio threshold |
| `insufficient_long_run_ratio` | Approach long-run ratio threshold |
| `insufficient_prior_modality_races` | Kaioken prior modality frequency threshold |
| `insufficient_mountain_experience` | Kaioken mountain experience threshold |
| `insufficient_available_days` | Approach available-day threshold |
| `insufficient_available_minutes` | Kaioken available-minute threshold |
| `insufficient_time_to_goal` | Distance-bracket time threshold |

#### Scenario: Kaioken is available but not recommended

- GIVEN all Kaioken requirements pass
- WHEN eligibility is assessed
- THEN all three approaches are available
- AND `recommended_approach=mode_z`.

#### Scenario: Eligibility reads never rewrite onboarding

- GIVEN a valid, incomplete, or legacy completed snapshot that normalizes to incomplete
- WHEN eligibility is requested
- THEN the resource performs zero onboarding upserts
- AND incomplete or legacy data returns the resumable 409 outcome without persisting demotion.

#### Scenario: Resource outcomes are bounded

- GIVEN no onboarding, incomplete onboarding, corrupt stored data, unavailable persistence, or an unsupported stored modality
- WHEN the protected resource is requested
- THEN it returns respectively 404, 409, 500, 503, or 422 with a bounded detail
- AND it exposes neither owner identity nor persistence details.

### Requirement: Supported modalities and validated input

Eligibility MUST support only `trail` and `ultra_trail`. Existing onboarding support for `ocr` and `backyard` remains unchanged but dormant for this capability. An unsupported completed stored modality MUST fail with `unsupported_modality` before completion diagnostics, including when its target date is expired or another answer would otherwise demote it. It MUST NOT silently fall back to Kaio or persist normalization.

Eligibility MUST consume a backend-validated, completed version 1 onboarding. Prior-history enums, physical booleans, numeric values, availability, status, consistency, goal distance, and target date MUST NOT be trusted merely because the web accepted them.

### Requirement: Deterministic derived values

The policy MUST derive:

```text
weekly_sessions = baseline_4_weeks.sessions / 4
weekly_distance = baseline_4_weeks.distance_km / 4
weekly_elevation = baseline_4_weeks.positive_elevation_m / 4
volume_ratio = weekly_distance / goal.target_distance_km
long_run_ratio = baseline_4_weeks.longest_outing_km / goal.target_distance_km
experience_ratio = prior_history.longest_completed_distance_km / goal.target_distance_km
available_days = count(availability.minutes_by_day keys)
available_minutes = sum(availability.minutes_by_day values)
days_to_goal = goal.target_date - assessment_date
```

Date comparison MUST use whole local calendar days. Habitual terrain and elevation remain personalization inputs and MUST NOT change eligibility until explicit thresholds exist.

### Requirement: Continuous distance-to-time table

Trail and Ultra Trail MUST use the same continuous table. Decimal distances MUST fall into the bracket defined by the mathematical boundary, without integer rounding.

| Target distance | Mode Z minimum | Kaioken minimum |
| --- | ---: | ---: |
| `<=15 km` | 4 weeks | 6 weeks |
| `>15 and <=30 km` | 6 weeks | 8 weeks |
| `>30 and <=50 km` | 8 weeks | 10 weeks |
| `>50 and <=80 km` | 10 weeks | 12 weeks |
| `>80 km` | 12 weeks | 16 weeks |

An approach passes its time requirement when `days_to_goal >= minimum_weeks * 7` exactly.

### Requirement: Kaio Path availability and recommendation

`kaio_path` MUST always be available for a valid completed supported onboarding and MUST have no blocking reasons. Recovery and pain constrain later plan generation rather than blocking Kaio. The recommendation MUST be `mode_z` when Mode Z is available and `kaio_path` otherwise. Kaioken MUST never be the default recommendation.

### Requirement: Mode Z eligibility

Mode Z MUST be available only when all conditions pass:

- status is not `recovering`;
- pain or a limitation does not affect running;
- weekly sessions >= 3;
- consistency is `fairly_consistent` or `very_consistent`;
- experience ratio >= 0.75;
- long-run ratio >= 0.25;
- available days >= 3;
- whole days to goal meet the Mode Z minimum.

Every failed condition MUST contribute its stable reason code; simultaneous failures MUST not be collapsed.

### Requirement: Kaioken eligibility

Kaioken MUST be available only when all conditions pass:

- status is `feeling_good`;
- no pain or limitation is present;
- weekly sessions >= 3;
- consistency is `very_consistent`;
- volume ratio >= 0.60;
- experience ratio >= 1.00;
- long-run ratio >= 0.35;
- prior modality race frequency is `multiple`;
- mountain experience is `medium` or `high`;
- available days >= 4;
- available minutes >= 300;
- whole days to goal meet the Kaioken minimum.

Exact threshold values MUST pass; any just-below value MUST fail with the corresponding stable reason code.

### Requirement: Safety precedence and restrictions

Safety rules MUST be evaluated independently of ordinary threshold failures:

| State | Eligibility effect | Safety restriction codes |
| --- | --- | --- |
| `recovering` | only Kaio | `no_load_increase`, `no_demanding_sessions`, `favor_recovery_rest_or_gentle_activity` |
| pain/limitation affects running | only Kaio | `no_compensation`, `no_load_increase`, `no_demanding_sessions` |
| pain/limitation does not affect running | Kaioken blocked; Mode Z evaluated normally | `no_compensation`, `no_load_increase` |
| `carrying_fatigue` without pain | Kaioken blocked; Mode Z evaluated normally | `no_weekly_load_increase`, `reduce_demanding_session_intensity_or_duration` |
| `feeling_good` without pain | normal evaluation | none |

Recovery takes precedence over pain when choosing the returned restriction set. The same inputs and assessment date MUST always produce the same ordered result.

### Requirement: Architectural ownership

One pure domain policy in the backend planning capability MUST own all eligibility rules and derived thresholds. The FastAPI endpoint and use case may authenticate, load, orchestrate, map errors, and serialize only. The web, repository, endpoint, and AI prompt MUST NOT duplicate or override eligibility rules.
