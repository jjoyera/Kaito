# Generated Training Block Policy

## Purpose

Define deterministic sports guardrails for a provider-generated one-to-four-week training block. This policy validates only structured generated fields and trusted backend context. It does not call a provider, persist a plan, interpret prose, or make a medical diagnosis.

## Requirements

### Block-wide intensity distribution

The policy SHALL aggregate only `intensity_segments` from run sessions across the complete generated block. It SHALL use exact integer-ratio arithmetic and enforce:

- low intensity is at least 75% of all structured run intensity minutes;
- high intensity is at most 10%;
- threshold plus high intensity is at most 25%.

The policy SHALL NOT require threshold or high intensity, and an all-low block SHALL be valid. It SHALL NOT enforce an exact weekly 80/20 distribution.

### Strength frequency and duration

For each build, loading, or peak week, the policy SHALL require exactly one strength session lasting at least 20 minutes. Recovery and taper weeks MAY contain zero or one strength session. The restrictions `no_demanding_sessions` and `favor_recovery_rest_or_gentle_activity` SHALL remove the minimum while retaining the maximum of one.

Every strength session shorter than 20 minutes SHALL produce a duration violation. Such a session SHALL NOT satisfy a required weekly minimum, so a required week SHALL also produce the corresponding frequency violation. Daily availability remains the contextual validator's authority and SHALL NOT be duplicated or weakened by this policy.

### Demanding sessions

A session is demanding when any structured condition is true:

- it contains high-intensity minutes;
- it contains threshold minutes and is a key session;
- `target_rpe_max` is at least 8;
- it is a key session and `target_rpe_max` is at least 7.

The policy SHALL NOT inspect session type, intensity description, purpose, instructions, or other prose when making this classification.

Demanding sessions SHALL be forbidden in recovery weeks, when readiness is `not_feasible`, or when `no_demanding_sessions` is present. When `reduce_demanding_session_intensity_or_duration` is present, the policy SHALL reject any high intensity, any key session, or `target_rpe_max >= 8`; a non-key threshold session with `target_rpe_max <= 7` remains permitted. Across all taper weeks in the generated block, at most one demanding session is permitted.

### Elevation declaration

Every policy result SHALL contain the canonical elevation metadata value `outside_mvp_safety_guarantees`, including blocks with zero planned elevation. This policy SHALL define no elevation budget, make no within-safe-budget claim, and SHALL NOT reject structurally valid positive elevation merely because it is positive. Strict non-negative structural validation remains in the generated contract.

### Fail-closed policy context

The pure policy SHALL prove that policy-context week count and ordered week numbers are coherent with the generated block before applying sports rules. Missing, extra, duplicate, out-of-order, or positionally mismatched week context SHALL produce deterministic violations and SHALL prevent the result from being valid; no week rule may be silently skipped.

At validator integration, policy-context week count, week numbers, and projection phases SHALL also be compared positionally with the trusted projected weeks. Any mismatch SHALL produce deterministic violations after the established contextual validator order and before sports-policy violations can be accepted.

### Deterministic result

The policy result and metadata SHALL be immutable. Context-coherence violations SHALL be emitted before sports-policy evaluation. For coherent context, sports violations SHALL be ordered as follows:

1. block-wide intensity violations;
2. strength violations in generated week order;
3. demanding-session violations in generated week and session order.

Within each category, rule order is fixed by the policy implementation. Elevation policy is metadata, not a violation. Repeated validation of the same block and context SHALL return equal results without relying on set or mapping iteration order.

### Validator integration

`validate_generated_training_block()` SHALL require trusted policy context and append policy violations after its established contextual validation order. A block that violates the sports policy SHALL therefore be rejected through the same deterministic validator boundary, while pre-existing contextual violation ordering remains unchanged.
