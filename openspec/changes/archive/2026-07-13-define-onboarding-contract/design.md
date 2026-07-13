# Design: Define the Onboarding Contract

## Technical Approach

Define a contract-only boundary owned by the future `apps/api/app/modules/runner_profile/` capability. A permissive typed draft model preserves structurally valid partial answers; authoritative validation normalizes conditionals and projects only completion-valid data into a strict domain snapshot. The transport vocabulary follows the specification exactly and remains independent of UI order, endpoints, and storage.

## Architecture Decisions

| Option | Tradeoff | Decision |
| --- | --- | --- |
| One transport model for every state | Simple, but lets downstream code consume partial data as complete | Use `OnboardingPayload` for typed input in either state and `CompletedOnboarding` as the strict validated projection. |
| Flat goal everywhere | Mirrors transport but spreads modality checks | Keep the specified flat `goal` transport block; project completion-valid data into discriminated Trail, Ultra Trail, OCR, or Backyard domain goals. |
| Validate while parsing | Conflates malformed input with correctable drafts | Separate structural parsing, conditional normalization, completion validation, and lifecycle resolution. |
| Binary floating point | Familiar but can corrupt decimal equality | Parse distance/elevation quantities as decimal values; reject non-finite numbers and preserve submitted precision. Keep counts, minutes, sessions, loops, and optional `max_altitude_m` integral. JSON number-versus-string encoding and decimal scale policy remain deferred to API and persistence implementation. |
| Client-provided ownership | Convenient but spoofable | Bind ownership outside the payload from verified `UserContext.user_id`; mapping ports receive owner context separately. |
| Implicit schema evolution | Fewer fields but unsafe resumability | Require exact `contract_version="1"` initially. Reject unknown versions or pass them through an explicit version translator before validation. Additive or breaking evolution introduces a new version and translator; draft migration policy remains downstream. |

## Data Flow

```text
transport payload
  -> structural parser
  -> conditional normalizer
  -> completion validator(runner-facing local validation date)
  -> lifecycle resolver
       | incomplete + diagnostics
       ` completed -> strict domain snapshot -> downstream mapper ports
```

Parsing accepts absent completion fields in drafts but rejects values that cannot match canonical types. Normalization first reads valid controllers, then clears inactive answers: restriction detail when false and every modality-specific goal field not applicable to the selected modality. Active typed answers remain even when completion-invalid.

Completion runs all applicable rules, including explicit (possibly empty) practiced arrays, half-year/history and half-hour/baseline increments, availability thresholds, local future date, and modality rules. Date validation receives an explicit runner-facing local validation date and compares it with `goal.target_date` as date-only values; it never derives today from server timezone. Trail/Ultra require route-based technicality; OCR requires obstacle count and may include event-based difficulty; altitude is optional. Editing completed data repeats the full pipeline; any blocking error resolves state to `incomplete` while retaining normalized typed answers.

## File Changes

| File | Action | Description |
| --- | --- | --- |
| `openspec/changes/define-onboarding-contract/design.md` | Create | Records the contract architecture and downstream seams. |
| `apps/api/app/modules/runner_profile/` | Deferred | Future owner of domain models and authoritative validation; no scaffold in Issue #20. |
| `docs/05-data-model.md` | Deferred | Later reconciliation removes `experienceLevel` and obsolete Backyard inputs. |

## Interfaces / Contracts

The logical transport type is `OnboardingPayload(contract_version, state, profile, goal)`. All four top-level members and both `profile` and `goal` containers are present. For `state="incomplete"`, answers within those containers may be partial or absent; absence means unanswered, while `[]` explicitly means no practiced modalities or terrain.

Validation returns `ValidationOutcome(snapshot, state, errors, warnings)`. Its strict completed projection is `CompletedOnboarding(contract_version="1", state="completed", profile, goal)`: every applicable completion-required and conditional field is present and valid, inactive answers have been cleared, and `goal` has exactly the selected modality's valid shape. No partial draft can be projected as `CompletedOnboarding`.

Diagnostics use stable transport-neutral records:

```text
Diagnostic { code: string, field: stable_field_id | null, message_key: string,
             severity: error | warning, metadata: object }
```

Errors block completion; warnings never do. Validation owns deterministic codes and field identifiers, not localized text. Near-date feasibility and optional restriction safety notices may be appended through warning-policy seams; they cannot mutate answers or become contract errors.

Downstream ports accept only explicit projections: persistence mapping receives owner context plus normalized draft/outcome; planning mapping accepts only `CompletedOnboarding`, derives Backyard target hours one-to-one from loops, and receives no experience level, plan approach, rest margin, or persistence representation.

## Testing Strategy

| Layer | What to Test | Approach |
| --- | --- | --- |
| Unit | parsing, decimals, normalization, all invariants, diagnostics, demotion | Table-driven validator tests with an injected runner-facing local validation date. |
| Contract | absent versus empty, goal variants, unsupported versions, warning/error serialization | Golden payload/outcome fixtures shared with future transport adapters. |
| Integration/E2E | None in Issue #20 | Deferred with endpoints, persistence, and UI. |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration required. This phase changes documentation only; physical schema, draft persistence, translators, and rollout belong to later changes.

## Open Questions

None.
