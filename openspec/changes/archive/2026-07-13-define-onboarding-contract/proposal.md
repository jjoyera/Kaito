# Proposal — Define the Onboarding Contract

Define one canonical, versioned onboarding contract for authenticated runners so frontend and persistence work can share the same product vocabulary, validation boundary, and lifecycle semantics without implementing either in Issue #20.

## Intent

Establish the database-ready domain and transport boundary for the minimum runner profile and event goal data needed before plan eligibility or generation. The contract must support resumable incomplete drafts, deterministic conditional fields, authoritative completion validation, and safe downstream consumption while remaining independent of UI step order and storage design.

## Approved decision summary

| Area | Decision |
| --- | --- |
| Payload | One versioned onboarding payload with separate `profile` and `goal` blocks. Stable contract vocabulary must not encode UI step order or database tables. |
| Ownership | The API derives ownership from verified `UserContext.user_id`; no client-supplied owner identity belongs in the contract. |
| Modalities | Canonical values are `trail`, `ultra_trail`, `ocr`, and `backyard`. |
| Goal dates | Every modality requires a local ISO calendar date (`YYYY-MM-DD`). Today and past dates are invalid. Any future date is accepted; a near-date feasibility concern produces a non-blocking warning for planning to assess. |
| Trail / ultra-trail | Require target distance, target date, positive elevation, and route-based technicality. Estimated maximum altitude is optional. |
| OCR | Require target distance, target date, and positive obstacle count. Obstacle difficulty is optional. |
| Backyard | Require only target date and target loops. Target hours are derived one-to-one from loops because every Backyard loop uses a fixed 60-minute event cycle. Neither target hours nor loop-cycle duration is client input; rest-margin strategy belongs to downstream planning. |
| Units | Canonical measurement units are metric. Dates are date-only values, not UTC instants. |
| Prior experience | Represent prior experience only through observable history: training years (zero is valid), a bounded completed-race count range, longest completed distance (zero is valid), and practiced modality/terrain history. The contract defines no subjective experience categorization. |
| Plan approaches | Camino Kaio (`kaio_path`), Modo Z (`z_mode`), and Kaioken (`kaioken`) are downstream planning approaches and do not belong to this onboarding vocabulary. Neither prior-experience history nor the current baseline directly selects an approach; downstream planning evaluates approach eligibility. |
| Current baseline | Keep current readiness separate from prior history by capturing the previous four weeks: sessions, training hours, distance, positive elevation, and longest outing. |
| Availability | Capture available days with integer minutes per available day, from 15 through 300 inclusive. |
| Restrictions | Require a yes/no restrictions answer. If yes, detail is required, non-empty, non-diagnostic, and at most 500 characters. If no, no detail is retained. |
| Conditional data | Answers that become hidden because a controlling answer changes are deleted rather than retained as stale data. |
| Lifecycle | Support `incomplete` and `completed`. Incomplete drafts must be resumable across sessions. Completion is validated authoritatively, and edits to completed data trigger revalidation rather than assuming completion remains valid. |

## Scope

### In scope

- Define the canonical onboarding payload boundary and its version identifier.
- Define typed profile and modality-specific goal fields, enums, metric units, and date-only semantics.
- Define deterministic requiredness, conditional visibility, hidden-answer clearing, and field validation rules.
- Define lifecycle semantics for incomplete, resumable drafts and validated completion.
- Define blocking validation errors separately from non-blocking planning warnings.
- Define provider-agnostic ownership: authenticated identity supplies the owner outside the client payload.
- Reconcile the Issue #20 contract with current product documents where approved MVP decisions are narrower, especially the Backyard date-and-loops input boundary and derived target hours.
- Preserve a clean handoff to persistence (#21), onboarding UI, and planning work.

### Out of scope

- Database schema, migrations, repositories, draft persistence mechanics, RLS, or other implementation from Issue #21.
- Onboarding screens, form sequencing, user-facing copy, routing, or session-flow changes.
- API endpoints, request handlers, or application implementation.
- Plan-approach eligibility, recommendation, selection, or generation.
- Feasibility rules for near event dates; planning owns those decisions after receiving the warning context.
- Backyard rest-margin strategy or other rest-allocation assumptions; downstream planning owns them.
- Medical data collection, diagnosis, injury assessment, or treatment advice.
- Multiple simultaneous primary goals, imperial-unit input, or additional modalities.
- Changes to canonical specs, design artifacts, task plans, or source code in this proposal phase.

## Product behavior boundary

### Draft and completion

An authenticated runner can have an incomplete onboarding representation that remains valid as a draft even when completion-required fields are absent. The contract must make that draft portable across sessions; #21 will decide how it is stored and retrieved. A transition to `completed` succeeds only when all currently applicable fields pass authoritative validation.

When completed answers are edited, the full payload is revalidated. If required data becomes absent or invalid, consumers must not continue treating the onboarding as completed. Conditional answers removed from scope are cleared, including restriction detail after restrictions changes to no and modality-specific fields after modality changes.

### Dates and warnings

Target dates are interpreted against the runner-facing local calendar, without converting the submitted date into an instant. Dates on or before the current local date are blocking validation errors. Every future date is contract-valid. A near date may add a warning, but the contract must not invent a hard feasibility threshold or reject the onboarding on planning grounds.

### Backyard derivation

For a Backyard goal, the client submits only the target date and target loop count. Each loop represents one fixed 60-minute event cycle, so downstream consumers derive target hours one-to-one from target loops. Target hours and loop-cycle duration are not client inputs. Rest-margin strategy is not onboarding data and remains a downstream planning decision.

### Experience, readiness, safety, and planning separation

Prior experience is represented only by observable history: training years, a bounded completed-race count range, longest completed distance, and practiced modality/terrain history. Zero is valid for training years and longest completed distance. Current readiness remains a separate previous-four-week baseline covering sessions, training hours, distance, positive elevation, and longest outing.

Neither the experience-history fields nor the current-baseline fields directly select or imply Camino Kaio, Modo Z, or Kaioken. They are validated onboarding inputs; downstream planning evaluates approach eligibility using the relevant context.

Restrictions are ordinary training constraints or preferences expressed without clinical interpretation. The contract records whether restrictions exist and, conditionally, bounded detail. It must not infer medical status.

## Affected areas

- Future shared onboarding schemas and API validation in `apps/api`.
- Future frontend form models and conditional rendering in `apps/web`.
- Future `RunnerProfile` and `TrainingGoal` persistence mapping in Issue #21.
- Future approved reconciliation of `docs/05-data-model.md`, whose current `RunnerProfile.experienceLevel` field conflicts with the observable-history decision; canonical documentation is not edited in this proposal phase.
- Planning inputs that consume validated history, baseline, availability, restrictions, and goal context, including derived Backyard target hours and planning-owned rest-margin strategy.
- Product documentation that currently allows Backyard target hours and additional event details as onboarding inputs and will need a separately approved consistency update.
- Support and UX expectations around resuming drafts and explaining blocking errors versus warnings.

## Current-state gap

The repository describes the information onboarding should collect but does not provide one approved contract for frontend, API, and persistence work. Existing documents leave availability shape, objective history fields, draft behavior, conditional-answer handling, and several modality rules ambiguous. In particular, `docs/05-data-model.md` still names `RunnerProfile.experienceLevel`; that field is flagged for a later approved reconciliation and the canonical document remains unchanged in this phase. Existing documents also allow Backyard goals by loops or hours and describe extra event details, while the approved Issue #20 MVP contract accepts only target date and target loops. Target hours are derived one-to-one from loops under the fixed 60-minute event cycle, and rest-margin strategy is deferred to planning. Without this proposal, downstream work could produce incompatible schemas or treat onboarding history or readiness as a direct plan-approach selector.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| “Database-ready” becomes storage-coupled. | Define domain fields and invariants, not tables, ORM models, or persistence mechanics. |
| Resumable drafts are promised without implementation. | Make resumability a contract requirement and explicitly defer persistence to #21. |
| A modality change leaves contradictory answers. | Require deterministic clearing of no-longer-applicable hidden fields. |
| A near event is accepted as if feasible. | Separate non-blocking date warnings from planning-owned feasibility decisions. |
| Observable history or the current baseline is treated as a direct plan-approach decision. | Keep history and the previous-four-week baseline separate and defer Camino Kaio / Modo Z / Kaioken eligibility evaluation to downstream planning. |
| Existing canonical data-model vocabulary conflicts with the approved history fields. | Flag `docs/05-data-model.md` field `experienceLevel` for later approved reconciliation without editing canonical docs in this phase. |
| Restrictions drift into medical interpretation. | Keep detail bounded and non-diagnostic; defer safety escalation behavior. |
| Product docs and the new Backyard contract diverge. | Record date and loops as the only client inputs, document the fixed-cycle target-hours derivation, and flag a follow-up documentation reconciliation. |
| Consumers treat derived hours, cycle duration, or rest margin as onboarding inputs. | State that target hours equal target loops under the fixed 60-minute cycle, while cycle duration is invariant and rest-margin strategy belongs to downstream planning. |
| Contract version changes invalidate drafts. | Require an explicit version and defer migration policy details to the later spec/design and persistence work. |

## Rollback

Because this change is documentation-only, rollback consists of reverting `proposal.md` and phase-index updates. No runtime behavior or stored user data changes. If a product decision is reversed before spec work, amend the proposal explicitly rather than introducing compatibility assumptions in implementation.

## Success criteria

- Reviewers can identify one canonical, versioned payload split into `profile` and `goal` without inferring UI or database structure.
- The proposal clearly distinguishes incomplete resumable drafts from authoritatively validated completion.
- Prior experience is captured only through observable history: training years (including zero), a bounded completed-race count range, longest completed distance (including zero), and practiced modality/terrain history.
- Current readiness is represented separately by the previous-four-week baseline: sessions, training hours, distance, positive elevation, and longest outing.
- Neither prior-experience history nor the current baseline directly selects Camino Kaio, Modo Z, or Kaioken; downstream planning owns approach-eligibility evaluation.
- The proposal flags `docs/05-data-model.md` field `experienceLevel` for later approved reconciliation and does not edit canonical documentation.
- Availability uses per-day integer minutes and rejects values outside 15–300 inclusive.
- Conditional restriction detail is required only when restrictions are present, is non-empty, is at most 500 characters, and is cleared otherwise.
- Trail, ultra-trail, OCR, and Backyard have unambiguous minimum goal inputs; Backyard onboarding accepts only target date and target loops.
- Backyard target hours are derived one-to-one from loops under the fixed 60-minute event cycle; target hours and loop-cycle duration are not client inputs.
- The onboarding contract contains no expected rest margin or box/transition notes, and explicitly leaves rest-margin strategy to downstream planning.
- Past and current local dates fail validation; all future local dates pass contract validation, with near-date viability represented only as a warning.
- Hidden conditional answers are cleared and completed payloads are revalidated after edits.
- Ownership comes from authenticated context and no provider identity or client-selected `userId` enters the payload.
- The proposal introduces no persistence, UI, endpoint, session-routing, plan-generation, spec, design, task, or implementation work.

## Next step

After proposal approval, create the contract specification for these rules. Keep persistence implementation in #21 and plan-approach behavior in downstream planning scope.
