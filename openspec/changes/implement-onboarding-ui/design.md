## Context

`apps/web` follows Screaming Architecture (`docs/08-architecture.md` §4-5):
`app/` is routing/orchestration only, and each real product capability owns
`apps/web/features/<capability>/` with `_components`, `_adapters`,
`_use-cases`, `_infrastructure`, and `_domain` only when pure rules justify
it. `features/auth/` is the only capability implemented so far and is the
reference pattern (login form, session handoff, private-route guard).

There is no form library, state-management library, or Zod in the actual
dependency tree yet (`apps/web/package.json`) — `docs/08-architecture.md`
names Zod as a planned direction, but Issue #38 ("setup Zod validation
schemas") is still open and unstarted. The shipped login flow validates by
hand in `_domain/login-validation.ts` and holds form state with plain
`useState`/`useRef`. This design follows that existing, real convention
rather than the aspirational one, to stay consistent with what is actually
in the codebase today.

The backend (`apps/api`, Issue #21/PR #63) exposes `GET`/`PUT
/runner-profile/onboarding` over a single owner-scoped JSONB snapshot with
full-replace upsert semantics (no partial patch, no concurrency token). The
onboarding contract (`openspec/specs/onboarding-contract`) defines the exact
field catalog, types, and conditional rules this UI must mirror for
client-side validation.

## Goals / Non-Goals

**Goals:**
- Define where the wizard's accumulated-snapshot state lives and how it
  flows through load → per-step edit/validate → save-on-advance → complete.
- Define the `features/onboarding/` folder contents and how they map to the
  spec requirements (resume, save-on-advance, per-step completion gating,
  step navigator, conditional clearing, demotion handling).
- Decide whether the authenticated-fetch adapter should be promoted to
  `apps/web/shared/` now that onboarding becomes a second real consumer.
- Define how backend diagnostics map back to wizard steps.

**Non-Goals:**
- Introducing Zod, a form library, or a state-management library (Issue #38
  and any such change are separate; this design uses the existing hand-rolled
  validation and plain React state convention).
- Changing the backend contract, persistence, or API (already delivered).
- Plan-approach selection, plan generation, or dashboard UI.

## Decisions

### 1. Wizard state lives in one client component, plain React state

`OnboardingWizard` (`_components/onboarding-wizard.tsx`, `"use client"`) owns:
- the accumulated snapshot (`profile`, `goal`) as one state object,
- the current step index,
- per-field errors and per-step status, derived via `_domain` helpers.

No global store is introduced. This mirrors `LoginForm`'s use of local
`useState`/`useRef` and avoids a dependency not otherwise justified by this
change's scope.

**Alternative considered**: a `useReducer` state machine per step. Rejected
for now — the state shape (one accumulated snapshot + a status map) is
simple enough that a reducer would add ceremony without a clear win; can be
revisited if step count/complexity grows.

### 2. Promote the authenticated-fetch adapter to `apps/web/shared/`

`privateFetch` (`features/auth/_adapters/private-fetch.ts`) is currently
feature-owned. `openspec/config.yaml` sets the promotion rule at "two
distinct real feature consumers," and onboarding becomes exactly that second
consumer (its own runtime callers within auth do not count twice, but
onboarding is a genuinely different feature). This change promotes
`private-fetch.ts` (and its test) to `apps/web/shared/adapters/`, updates
`features/auth` call sites to import from there, and adds the onboarding
adapter as the second consumer.

**Alternative considered**: duplicate a private-fetch helper inside
`features/onboarding/_adapters`. Rejected — this is precisely the
duplication the project's shared-promotion rule exists to avoid once the
two-consumer threshold is met, and duplicating auth-token/error-handling
logic is a correctness risk (two places to fix a bug).

This is a pure move: no behavior change, existing `private-fetch.test.ts`
moves and continues to pass as the regression safety net.

### 3. `features/onboarding/` layout

```
apps/web/features/onboarding/
├── _components/
│   ├── onboarding-wizard.tsx       # owns state, composes everything below
│   ├── step-navigator.tsx         # renders step list + status, handles jump
│   ├── goal-step.tsx
│   ├── prior-history-step.tsx
│   ├── baseline-step.tsx
│   ├── availability-step.tsx
│   ├── restrictions-step.tsx
│   └── completion-view.tsx
├── _domain/
│   ├── steps.ts                    # ordered step definitions + field ownership
│   ├── step-validation.ts          # per-step structural/range/conditional rules
│   ├── conditional-clearing.ts     # modality/restriction field clearing
│   └── diagnostic-mapping.ts       # backend field path -> step id
├── _use-cases/
│   ├── load-onboarding-draft.ts    # GET, maps 404 -> blank, else -> load error
│   ├── save-onboarding-step.ts     # PUT state=incomplete on advance
│   └── complete-onboarding.ts      # PUT state=completed, surfaces diagnostics
└── _adapters/
    └── onboarding-api.ts           # thin fetch wrapper using shared privateFetch
```

**Amendment during implementation**: `privateFetch` sanitized every non-401/503
status (including 404) into one generic thrown error, which would have made a
legitimate "no draft yet" GET 404 indistinguishable from a real backend
failure. Rather than let the onboarding adapter duplicate token/URL-safety
logic to inspect the status itself, `shared/adapters/private-fetch.ts` gained
an opt-in `passthroughStatuses` option: callers that need to interpret a
specific status themselves declare it, and every other status keeps the
existing sanitize-and-throw behavior untouched. The change is additive (new
optional parameter, default `[]`), so it does not weaken decision #2's "pure
move, no behavior change" framing for existing callers — auth's own tests
required zero modifications, and only `fetchOnboardingSnapshot`'s 404 case
opts in.

No `_infrastructure/` — onboarding has no provider of its own; it reuses the
shared authenticated-fetch adapter and the existing Supabase session/token
plumbing already owned by `features/auth`.

`_domain/step-validation.ts` hand-ports the same types/ranges/conditional
rules as `openspec/specs/onboarding-contract` (mirroring, not replacing,
backend validation — the backend remains authoritative). `steps.ts` is the
single place that assigns each contract field to a step, and
`diagnostic-mapping.ts` uses that same assignment to route a backend
diagnostic's `field` (e.g. `goal.target_date`) to the step that owns it, so
the step navigator can mark the right step and the runner can jump directly
to it (per the "demotion" and "direct step navigation" requirements).

### 4. Route composition stays a thin server wrapper

`app/(private)/onboarding/page.tsx` keeps its existing session-guard/redirect
logic (unchanged) and renders `<OnboardingWizard />` instead of the current
placeholder markup — the same composition pattern `app/(auth)/login/page.tsx`
uses for `<LoginForm />`.

### 5. Styling extends the existing single global stylesheet

New `onboarding-*`-prefixed rules are added to `app/styles.css`, reusing the
existing CSS custom properties (`--color-primary`, `--color-accent`, etc.)
and the same accessible-input/error patterns as `.login-field`. No CSS
modules or Tailwind are introduced, consistent with the current codebase.

### 6. E2E strategy mocks the onboarding API at the network layer

Playwright tests intercept `GET`/`PUT /runner-profile/onboarding` via route
mocking rather than extending the env-gated fake-auth-adapter pattern used
for sign-in. Onboarding has no provider-specific SDK to fake (unlike
Supabase auth); mocking the two REST calls directly is simpler and keeps the
existing Docker-backed RLS integration proof as the one place that exercises
the real API end-to-end.

## Risks / Trade-offs

- **[Risk]** Client-side validation in `_domain/step-validation.ts`
  duplicates the Python contract rules in TypeScript, so the two can drift.
  → **Mitigation**: the backend stays authoritative (its response/diagnostics
  always win); a code comment in `step-validation.ts` points back to
  `openspec/specs/onboarding-contract/spec.md` so future contract edits are a
  visible prompt to update both. Introducing a shared schema (Zod +
  generated/mirrored Pydantic) is a natural follow-up but is Issue #38's
  scope, not this change's.
- **[Risk]** Full-snapshot-replace on every step advance means two open tabs
  editing the same onboarding will silently last-write-wins each other; there
  is no concurrency token in the contract. → **Mitigation**: accepted as a
  known MVP limitation consistent with the backend's own design (single JSONB
  row, no version field); not addressed by this change.
- **[Risk]** Promoting `private-fetch.ts` touches existing, already-shipped
  auth code instead of being purely additive. → **Mitigation**: it's a
  mechanical move (file relocation + import updates), the existing
  `private-fetch.test.ts` moves unchanged and must still pass, and no
  auth-visible behavior changes.
- **[Risk]** `diagnostic-mapping.ts` must cover every contract field so a
  backend diagnostic never fails to resolve to a step. → **Mitigation**: a
  unit test enumerates every field in the contract's field catalog and
  asserts each maps to exactly one step, with no fallback/default step
  allowed to silently absorb an unmapped field.

## Migration Plan

No data migration. This is a UI-only change behind the existing private-route
session guard; deployment is a normal merge/release. Rollback is a plain
revert of the PR (the backend and stored snapshots are unaffected either
way).

## Open Questions

- Exact Spanish microcopy per step is left to implementation, following the
  calm/encouraging tone already set by the login screen and brand palette
  docs.
