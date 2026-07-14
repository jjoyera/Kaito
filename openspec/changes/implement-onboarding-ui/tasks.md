# Tasks: Implement Onboarding UI

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 900-1,400 |
| Review budget | <=2,500 (default single-PR, no size exception requested) |
| Chained PRs recommended | No |
| Suggested split | One PR on a new `feat/onboarding-ui-22-pr1` branch |

## 1. Shared adapter promotion

- [ ] 1.1 **RED:** confirm the existing `apps/web/features/auth/_adapters/private-fetch.test.ts` passes unmoved as the pre-move regression baseline.
- [ ] 1.2 **GREEN:** move `private-fetch.ts` and its test to `apps/web/shared/adapters/`; update every `features/auth` import site. No behavior change.
- [ ] 1.3 **REFACTOR/verify:** rerun `pnpm test:web-auth` and the relocated test from their new path; confirm no import cycles and no auth-visible change.

## 2. Onboarding domain layer (pure, TDD)

- [ ] 2.1 **RED:** `_domain/steps.test.ts` asserts the ordered step list and which contract fields each step owns.
- [ ] 2.2 **GREEN:** implement `_domain/steps.ts`.
- [ ] 2.3 **RED:** `_domain/step-validation.test.ts` covers structural types, ranges, and conditional-field rules per step, mirroring `openspec/specs/onboarding-contract`.
- [ ] 2.4 **GREEN:** implement `_domain/step-validation.ts`.
- [ ] 2.5 **RED:** `_domain/conditional-clearing.test.ts` covers modality-hidden goal fields and restriction-detail clearing.
- [ ] 2.6 **GREEN:** implement `_domain/conditional-clearing.ts`.
- [ ] 2.7 **RED:** `_domain/diagnostic-mapping.test.ts` enumerates every field in the contract's field catalog and asserts each maps to exactly one step, with no silent fallback for an unmapped field.
- [ ] 2.8 **GREEN:** implement `_domain/diagnostic-mapping.ts`.

## 3. Onboarding use-cases (TDD with fakes)

- [ ] 3.1 **RED:** `_use-cases/load-onboarding-draft.test.ts` covers hydrate-from-stored-snapshot, blank-start on a 404, and a load-error state.
- [ ] 3.2 **GREEN:** implement `_adapters/onboarding-api.ts` (GET) and `_use-cases/load-onboarding-draft.ts`.
- [ ] 3.3 **RED:** `_use-cases/save-onboarding-step.test.ts` covers save-on-advance with `state: "incomplete"`, and a failed save preserving the runner's local answers.
- [ ] 3.4 **GREEN:** implement the adapter's PUT call and `_use-cases/save-onboarding-step.ts`.
- [ ] 3.5 **RED:** `_use-cases/complete-onboarding.test.ts` covers a successful `state: "completed"` submission and a demoted-with-diagnostics outcome.
- [ ] 3.6 **GREEN:** implement `_use-cases/complete-onboarding.ts`.

## 4. Wizard components

- [ ] 4.1 Build the per-step components (`goal-step`, `prior-history-step`, `baseline-step`, `availability-step`, `restrictions-step`), wired to `_domain/step-validation.ts` with field-level errors using the existing accessible pattern (`label`+`id`, `aria-describedby`, `aria-invalid`, `role="alert"`).
- [ ] 4.2 Build `step-navigator.tsx`: renders each step's complete/incomplete/not-reached status and supports a direct jump to any previously-reached step without discarding other steps' answers.
- [ ] 4.3 Build `completion-view.tsx` for the post-completion confirmation state.
- [ ] 4.4 Build `onboarding-wizard.tsx`: owns the accumulated snapshot and step-index state, wires the load/save/complete use-cases, enforces per-step completion before advancing, and drives navigator status from `diagnostic-mapping.ts`.
- [ ] 4.5 Replace the `app/(private)/onboarding/page.tsx` placeholder with a composition of `<OnboardingWizard />`, preserving the existing session-guard redirect behavior unchanged.

## 5. Styling

- [ ] 5.1 Add `onboarding-*`-prefixed rules to `app/styles.css`, reusing the existing CSS custom properties and the `.login-field`/`.login-form-error` accessible patterns; check against the brand palette and reduced-motion rules.

## 6. E2E and verification

- [ ] 6.1 Add Playwright coverage for resume-from-draft hydration, save-on-advance persistence, per-step completion gating, direct step-navigator jumps without data loss, conditional field clearing, completion success, and completion demotion with diagnostics — mocking `GET`/`PUT /runner-profile/onboarding` at the network layer.
- [ ] 6.2 **VERIFY:** run `pnpm test:web-auth` (moved-adapter regression), the new onboarding unit suites, `pnpm test:web-e2e`, `pnpm lint:web`, `pnpm build:web`, `pnpm test:portable-paths`, `git diff --check`, and compute the final authored-line count against the 2,500 budget.
