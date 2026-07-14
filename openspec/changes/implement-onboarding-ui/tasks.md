# Tasks: Implement Onboarding UI

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 900-1,400 |
| Review budget | <=2,500 (default single-PR, no size exception requested) |
| Chained PRs recommended | No |
| Suggested split | One PR on a new `feat/onboarding-ui-22-pr1` branch |

## 1. Shared adapter promotion

- [x] 1.1 **RED:** confirm the existing `apps/web/features/auth/_adapters/private-fetch.test.ts` passes unmoved as the pre-move regression baseline. (5/5 passed pre-move.)
- [x] 1.2 **GREEN:** move `private-fetch.ts` and its test to `apps/web/shared/adapters/`; update every `features/auth` import site. No behavior change. (`git mv` both files; updated the type-only import in `session-recovery-controller.ts`; extended the `test:auth` glob in `apps/web/package.json` to also cover `shared/**/*.test.ts` so CI keeps exercising the moved test.)
- [x] 1.3 **REFACTOR/verify:** rerun `pnpm test:web-auth` and the relocated test from their new path; confirm no import cycles and no auth-visible change. (`pnpm test:web-auth` → 55/55 passed; `pnpm lint:web` → clean.)

## 2. Onboarding domain layer (pure, TDD)

- [x] 2.1 **RED:** `_domain/steps.test.ts` asserts the ordered step list and which contract fields each step owns. (Module-not-found failure confirmed before implementation.)
- [x] 2.2 **GREEN:** implement `_domain/steps.ts`. (9/9 passed.)
- [x] 2.3 **RED:** `_domain/step-validation.test.ts` covers structural types, ranges, and conditional-field rules per step, mirroring `openspec/specs/onboarding-contract`. (Module-not-found failure confirmed before implementation.)
- [x] 2.4 **GREEN:** implement `_domain/step-validation.ts`. (18/18 passed.)
- [x] 2.5 **RED:** `_domain/conditional-clearing.test.ts` covers modality-hidden goal fields and restriction-detail clearing. (Module-not-found failure confirmed before implementation.)
- [x] 2.6 **GREEN:** implement `_domain/conditional-clearing.ts`. (8/8 passed.)
- [x] 2.7 **RED:** `_domain/diagnostic-mapping.test.ts` enumerates every field in the contract's field catalog and asserts each maps to exactly one step, with no silent fallback for an unmapped field. (Module-not-found failure confirmed before implementation.)
- [x] 2.8 **GREEN:** implement `_domain/diagnostic-mapping.ts`. (5/5 passed. Full domain suite: 40/40 passed; `pnpm lint:web` clean; `tsc --noEmit` clean.)

## 3. Onboarding use-cases (TDD with fakes)

- [x] 3.0 **RED/GREEN (unplanned prerequisite):** discovered `privateFetch` sanitizes every non-401/503 status (including 404) into a generic thrown error, which would make a legitimate "no draft yet" GET 404 indistinguishable from a real failure. Added an opt-in `passthroughStatuses` option to `shared/adapters/private-fetch.ts` (additive; default behavior unchanged) with a new RED/GREEN test; full auth+shared regression stayed green (56/56) with zero modified assertions.
- [x] 3.1 **RED:** `_use-cases/load-onboarding-draft.test.ts` covers hydrate-from-stored-snapshot, blank-start on a 404, and a load-error state. (Module-not-found failure confirmed before implementation.)
- [x] 3.2 **GREEN:** implement `_adapters/onboarding-api.ts` (GET, using `passthroughStatuses: [404]`) and `_use-cases/load-onboarding-draft.ts`. (Adapter 5/5, use-case 4/4.)
- [x] 3.3 **RED:** `_use-cases/save-onboarding-step.test.ts` covers save-on-advance with `state: "incomplete"`, and a failed save preserving the runner's local answers. (Module-not-found failure confirmed before implementation.)
- [x] 3.4 **GREEN:** implement the adapter's PUT call and `_use-cases/save-onboarding-step.ts`. (3/3 passed.)
- [x] 3.5 **RED:** `_use-cases/complete-onboarding.test.ts` covers a successful `state: "completed"` submission and a demoted-with-diagnostics outcome. (Module-not-found failure confirmed before implementation.)
- [x] 3.6 **GREEN:** implement `_use-cases/complete-onboarding.ts`. (3/3 passed. Full regression: 111/111 across onboarding+auth+shared; `pnpm lint:web` and `tsc --noEmit` clean.)

## 4. Wizard components

- [x] 4.0 **Unplanned prerequisite (backend CORS):** discovered `apps/api` had no `CORSMiddleware`, so the browser could never reach the API cross-origin. Decided with the maintainer to add minimal, opt-in, fail-closed backend CORS (`KAITO_WEB_ORIGIN`) rather than a Next.js proxy route. TDD: RED added 4 tests to `tests/test_main.py` (unset → no header, configured → header present, unlisted origin → no header, comma-separated list); GREEN added `get_web_settings()` to `app/core/config.py` and conditional `CORSMiddleware` registration in `app/main.py`. Full API suite 164/164, ruff clean. Documented in both `.env.example` files (`KAITO_WEB_ORIGIN`, `NEXT_PUBLIC_KAITO_API_URL`).
- [x] 4.0b **Unplanned prerequisite (access token):** added `features/auth/_adapters/get-access-token.ts` (RED/GREEN, 3/3) so the wizard can build `OnboardingApiDependencies` from the real Supabase browser session; kept in `features/auth` (single consumer today) per decision #8.
- [x] 4.1 Build the per-step components (`goal-step`, `prior-history-step`, `baseline-step`, `availability-step`, `restrictions-step`), wired to `_domain/step-validation.ts` with field-level errors using the existing accessible pattern (`label`+`id`, `aria-describedby`, `aria-invalid`, `role="alert"`). Added shared intra-feature `number-field.tsx`, `checkbox-group.tsx`, and `field-messages.ts` (reused by 3+ step components).
- [x] 4.2 Build `step-navigator.tsx`: renders each step's complete/incomplete/not-reached status and supports a direct jump to any previously-reached step without discarding other steps' answers.
- [x] 4.3 Build `completion-view.tsx` for the post-completion confirmation state.
- [x] 4.4 Build `onboarding-wizard.tsx`: owns the accumulated snapshot and step-index state, wires the load/save/complete use-cases, enforces per-step completion before advancing, and drives navigator status from `diagnostic-mapping.ts`. Normalizes `practiced_modalities`/`practiced_terrain` to `[]` on init/hydrate per decision #9.
- [x] 4.5 Replace the `app/(private)/onboarding/page.tsx` placeholder with a composition of `<OnboardingWizard />`, preserving the existing session-guard redirect behavior unchanged.

**Verification**: web suite 114/114 (onboarding+auth+shared), `pnpm lint:web` clean, `tsc --noEmit` clean. Manual smoke check: `next dev` on the route with no session → 307 to `/login?returnTo=%2Fonboarding&context=auth_unavailable` with no compile/runtime errors in the server log (full authenticated behavioral verification deferred to Phase 6's mocked E2E, since the wizard is still unstyled and needs a real Supabase session to exercise past the guard).

## 5. Styling

- [ ] 5.1 Add `onboarding-*`-prefixed rules to `app/styles.css`, reusing the existing CSS custom properties and the `.login-field`/`.login-form-error` accessible patterns; check against the brand palette and reduced-motion rules.

## 6. E2E and verification

- [ ] 6.1 Add Playwright coverage for resume-from-draft hydration, save-on-advance persistence, per-step completion gating, direct step-navigator jumps without data loss, conditional field clearing, completion success, and completion demotion with diagnostics — mocking `GET`/`PUT /runner-profile/onboarding` at the network layer.
- [ ] 6.2 **VERIFY:** run `pnpm test:web-auth` (moved-adapter regression), the new onboarding unit suites, `pnpm test:web-e2e`, `pnpm lint:web`, `pnpm build:web`, `pnpm test:portable-paths`, `git diff --check`, and compute the final authored-line count against the 2,500 budget.
