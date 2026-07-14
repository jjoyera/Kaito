## Why

Issue #21 (PR #63, merged) delivered owner-scoped persistence and RLS for the
onboarding contract, but `apps/web/app/(private)/onboarding/page.tsx` is still
an unauthenticated-guard placeholder. No runner can actually answer, resume,
or complete onboarding today, which blocks the rest of the MVP funnel: plan
generation (epic #13) has no real onboarding data to consume until this UI
exists.

## What Changes

- Build a step-by-step onboarding wizard in `apps/web` that collects the
  canonical contract fields defined in `openspec/specs/onboarding-contract`:
  goal (modality plus its conditional fields), prior history, 4-week
  baseline, weekly availability, and restrictions.
- On entry, read the caller's existing snapshot (`GET
  /runner-profile/onboarding`) and resume from any stored draft instead of
  starting blank.
- Validate each step against the same types/ranges/conditional-requiredness
  rules as the backend contract before letting the runner advance: a step's
  own completion-required fields must be valid to move forward (guided UX),
  and a persistent step navigator lets the runner jump directly to any
  previously-reached step to fix something without a forced linear
  walk-back, and surface the diagnostics the backend returns after a save.
- Save progress by sending the accumulated snapshot (`PUT
  /runner-profile/onboarding`, `state: "incomplete"`) each time the runner
  advances to the next step, since the API always replaces the single
  per-owner snapshot rather than patching individual fields. A sparse,
  incomplete draft therefore survives a session end and is resumable,
  consistent with the contract's resumable-lifecycle requirement. Only the
  final step submits `state: "completed"`.
- Handle loading, save-in-progress, validation-error, persistence-unavailable
  (503), and completion states; the existing private-route session guard
  continues to own authentication redirects.
- Apply Kaito's documented brand palette and tone (`docs/09-brand-palette.md`)
  to the flow.
- Out of scope: plan-approach selection/eligibility cards (Camino Kaio / Modo
  Z / Kaioken) — that belongs to epic #13 per RF-07 and the contract's own
  scope exclusions; plan generation; dashboard; training log; any backend
  contract or persistence change (the API from PR #63 is consumed as-is).

## Capabilities

### New Capabilities
- `onboarding-ui`: step-by-step onboarding form flow (progress, per-step
  validation, resume from a stored draft, and completion handling) that
  consumes the existing onboarding contract and protected API.

### Modified Capabilities
- None. This change consumes the already-approved `onboarding-contract` spec
  and the protected API delivered by Issue #21 without altering their
  requirements.

## Impact

- `apps/web/app/(private)/onboarding/page.tsx`: replaced with the real
  wizard entry point; the existing session-guard redirect behavior is kept.
- New `apps/web/features/onboarding/` capability folder
  (`_components`, `_adapters`, `_use-cases`, and `_domain` only if pure
  step/validation rules justify it), following the same ownership pattern as
  `apps/web/features/auth/`.
- Reuses `apps/web/features/auth/_adapters` authenticated fetch and the
  existing private-route session flow; no changes to auth.
- Consumes `PUT` and `GET /runner-profile/onboarding` exactly as specified by
  the merged Issue #21 API; no backend or database changes are expected.
- Adds web unit/contract tests and Playwright E2E coverage for the new flow;
  no changes to API tests.
