# Exploration — Define the Onboarding Contract

## Executive finding

The recommended boundary is a versioned, domain-owned onboarding snapshot accepted by `apps/api` after authentication. It should describe one canonical questionnaire, typed answers, conditional visibility, validation, and lifecycle state; it should not persist data, select routes, evaluate plan approaches, generate plans, or expose provider identity fields.

## Validated sources

- `docs/00-product-vision.md`: onboarding supplies state, experience, availability, and goal context for one active plan.
- `docs/04-functional-requirements.md` (RF-04–RF-07): requires onboarding state routing, modality-specific required fields, minimum experience/availability, restrictions/preferences, and complete-before-generation validation.
- `docs/05-data-model.md`: separates `RunnerProfile` from `TrainingGoal`; names stable domain entities and fields, and requires ownership through `userId`.
- `docs/06-ai-behavior.md`: AI may consume only validated, traceable domain context and must not invent missing inputs.
- `docs/08-architecture.md`: web performs early Zod validation; API/Pydantic is authoritative; `runner_profile` owns onboarding and `planning` owns eligibility/generation.
- `apps/api/app/modules/auth/context.py`, `schemas.py`: canonical identity is provider-agnostic `UserContext.user_id` plus optional email. Domain contracts must not include JWT, Supabase, or raw claims.
- `openspec/specs/web-session-flow/spec.md`: `/onboarding` is currently a private placeholder only; the existing session contract explicitly excludes real onboarding workflow, persistence, completion state, and onboarding APIs.
- Archived `protect-private-routes-user-session-flow`: confirms the placeholder is not evidence of completion and that route/session ownership must remain separate from domain ownership.

## Proposed contract contents

| Area | Recommended contract boundary |
| --- | --- |
| Questionnaire identity | Stable questionnaire/version ID; stable question IDs; explicit answer type and unit metadata. |
| Goal | `raceType`: `trail`, `ultra`, `ocr`, `backyard`; date required for all; distance for trail/ultra/OCR; loops or hours plus loop duration and rest margin for Backyard; optional box/transition notes. |
| Experience/baseline | Explicit experience level and current baseline/volume fields, with units and bounded validation. Avoid a single ambiguous “experience” field. |
| Availability | Weekly availability as structured days/time or session-capacity data, not a free-form string; exact shape still requires product decision. |
| Restrictions | Structured training constraints/preferences plus bounded user notes; keep reported pain/medical concerns outside this contract and route them to safety messaging rather than diagnosis. |
| Lifecycle | `incomplete` and `completed` states, completion timestamp/version, and validation errors at the contract boundary. Define whether drafts are resumable and whether completion is immutable/versioned. |
| Ownership | API derives owner from verified `UserContext.user_id`; client input cannot select another owner. |
| Conditional visibility | Rules are declarative and deterministic: visible questions and requiredness derive from prior typed answers; hidden answers are either cleared or retained by an explicit policy. |

## Contradictions and product gaps

1. The canonical web-session spec says no real onboarding workflow, persistence, completion state, or onboarding APIs, while RF-04–RF-07 and the data model require them later. This change must define the contract without changing the session spec; implementation should be a later change.
2. The requirements use “trail, ultra-trail and OCR” while Issue #20 says “trail, ultra, OCR”; the stable enum and whether `ultra-trail` aliases `ultra` need approval.
3. Availability is required but has no canonical field-level shape. “Weekly availability” could mean days, hours, maximum sessions, or capacity; this affects validation and plan semantics.
4. “Experience” and “current volume/baseline” are distinct in requirements and data model but their vocabularies, units, lookback period, and nullability are unspecified.
5. Restrictions, preferences, discomfort, and pain are blended across requirements. The contract needs a deliberate boundary between training constraints and safety/medical reporting.
6. Backyard requirements allow `targetLoops` or `targetHours` but do not define mutual exclusivity, conversion, or whether both may be supplied. Loop duration and rest margin also need ranges and units.
7. Completion is required by Issue #20 but no authority is assigned for state transitions, partial saves, edits after completion, or questionnaire-version migration.
8. The data model names `RunnerProfile` and `TrainingGoal`, whereas the requested contract may be submitted as one onboarding payload. The API must define whether this is a transport DTO, a domain aggregate, or two write boundaries.
9. The canonical auth response exposes identity only; ownership must be an API concern and must not be copied from a client-provided `userId`.

## Recommended downstream decision set

Before proposal/spec, decide: canonical modality enum; question ID/version policy; exact answer primitives and units; availability representation; baseline lookback and ranges; restrictions/safety separation; Backyard field rules; hidden-answer behavior; completion/edit/version semantics; and whether the transport is one aggregate or separate profile/goal commands.

## Risks

- A “database-ready” contract can accidentally freeze storage design or leak UI step ordering.
- Ambiguous availability and baseline data can produce plans that appear valid but are not actionable.
- Conditional-answer retention can preserve stale contradictory data unless explicitly normalized.
- Mixing pain/medical data into ordinary restrictions risks unsafe product interpretation and scope creep.
- Introducing a real onboarding API now would contradict the canonical web-session spec and exceed Issue #20 non-goals.

## Recommended next phase

Draft a proposal that records the above decisions and explicitly preserves the current session-flow non-goal. Then produce a canonical change spec for contract behavior only; defer persistence/migrations, UI, RLS, and training-plan generation to separate approved changes.
