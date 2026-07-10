# Tasks — build-login-ui

## Review Workload Forecast

| Field | Value |
| ------- | ------- |
| Estimated changed lines | 650–900 additions/deletions |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 auth validation/boundaries/tests → PR 2 `/login` UI behavior/E2E → PR 3 visual polish/accessibility/reduced-motion |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

## Implementation Tasks

### 1. RED — establish auth validation and boundary tests

- [x] Add focused tests for `apps/web/features/auth/login-validation.ts` covering required email, invalid email shape, required password, valid input, trimmed submission email, and visible email preservation.
- [x] Add focused tests for `apps/web/features/auth/auth-client.ts` covering Kaito-owned outcomes: `success`, `invalid_credentials`, and `system_error` without exposing raw provider errors.
- [x] Add focused tests for `apps/web/features/auth/authenticated-handoff.ts` proving the success boundary delegates to one centralized authenticated-flow destination and does not inspect onboarding/dashboard state.
- [x] If a new web unit-test script is needed, update `apps/web/package.json` and root workspace scripts only enough to run these tests with existing TypeScript tooling.
- Acceptance: tests fail before implementation, identify the expected module names/contracts, and do not require real Supabase accounts or backend changes.

### 2. GREEN — implement pure auth helpers and handoff boundary

- [x] Create `apps/web/features/auth/login-validation.ts` with pure validation helpers and exported types for field errors.
- [x] Create `apps/web/features/auth/auth-client.ts` with provider-agnostic `SignInInput`, `SignInOutcome`, and `SignInWithPassword` contracts plus outcome mapping.
- [x] Create `apps/web/features/auth/authenticated-handoff.ts` with `continueToAuthenticatedFlow(...)` as the only post-login routing abstraction.
- [x] Keep Supabase/provider types and raw error payloads out of UI-facing APIs.
- Acceptance: Task 1 tests pass; successful handoff remains centralized and does not decide onboarding versus dashboard routing.

### 3. RED — add `/login` browser behavior coverage

- [x] Add `apps/web/e2e/login.spec.ts` for `/login` covering visible labels, keyboard reachability, local required-field validation, invalid email validation, and preservation of the entered email value.
- [x] Add controlled-auth-outcome coverage in `apps/web/e2e/login.spec.ts` for pending duplicate-submit prevention, invalid-credentials feedback, technical/system error feedback, and successful authenticated-flow handoff.
- [x] Use a test-only mock adapter selected by an explicit Playwright/non-production flag in `apps/web/playwright.config.ts`, or document a concrete network-interception target if the implementation chooses interception.
- Acceptance: tests fail before UI implementation and verify that local validation blocks auth attempts.

### 4. GREEN — build route and login form behavior

- [x] Create `apps/web/app/(auth)/login/page.tsx` as a thin route-level composition for `/login`.
- [x] Create `apps/web/features/auth/login-form.tsx` as a client component for field state, validation, pending state, submit handling, and error rendering.
- [x] Ensure email/password controls use accessible labels, `type="email"`, `type="password"`, `autoComplete="email"`, and `autoComplete="current-password"`.
- [x] Disable or guard submit while pending so repeated activation cannot start a second sign-in attempt.
- [x] Render generic invalid-credentials feedback separately from technical/system feedback.
- [x] On success, call `continueToAuthenticatedFlow(...)`; do not add signup, password reset, magic-link, social auth, demo access, route guards, onboarding/dashboard branching.
- Acceptance: Task 3 behavior tests pass and `/login` is additive; existing `/` scaffold tests remain valid unless intentionally updated.

### 5. TRIANGULATE — visual styling from the approved mockup and Kaito brand

- [ ] Update `apps/web/app/styles.css` with Kaito login tokens and page styles: warm sand background, off-white card, forest/deep green primary, restrained gold/orange accents, and earth-red errors.
- [ ] Use `.context/Kaito AI Running Coach.zip` / `Kaito.dc.html` as the primary visual reference for background depth, motion, card styling, compact brand header, mountain/sun language, and golden trail accent.
- [ ] Do not copy the mockup password-recovery affordance; password reset remains out of scope.
- [ ] Keep background and motion secondary to readable form focus; avoid generic blue SaaS, futuristic AI clichés, medical styling, and aggressive gym branding.
- Acceptance: visual review can confirm calm premium mountain-coach tone while the form remains the primary readable focus.

### 6. TRIANGULATE — accessibility, responsive layout, and reduced motion

- [ ] Ensure `aria-invalid`, `aria-describedby`, and semantic alert/live-region behavior for field-level and form-level feedback in `apps/web/features/auth/login-form.tsx`.
- [ ] Add or extend Playwright checks in `apps/web/e2e/login.spec.ts` for accessible names, focus order, feedback exposure, and reduced-motion behavior.
- [ ] Add `@media (prefers-reduced-motion: reduce)` handling in `apps/web/app/styles.css` so decorative animation is disabled without changing essential behavior.
- [ ] Verify mobile and desktop layouts avoid horizontal overflow and keep touch targets comfortable.
- Acceptance: accessibility-relevant E2E assertions pass and no login behavior depends on animation.

### 7. REFACTOR — keep the slice small and provider boundaries clean

- [ ] Review `apps/web/features/auth/*` for duplication, provider leakage, raw error exposure, and oversized components.
- [ ] Keep route composition in `apps/web/app/(auth)/login/page.tsx` thin; move form logic only to feature files.
- [ ] Keep copy brief and coaching-oriented; do not turn `/login` into a marketing landing page.
- [ ] Confirm no backend/API files are touched unless a new discovery makes that unavoidable and separately approved.
- Acceptance: implementation remains frontend-centered and rollback is limited to the login route, auth feature files, related tests, and styles.

### 8. Verification and documentation/status

- [ ] Run expected frontend validation commands after implementation: `pnpm lint:web`, `pnpm build:web`, and `pnpm test:web-e2e`.
- [ ] If package scripts were added for unit tests, run the corresponding web/root test command and document it in the apply result.
- [ ] Update `openspec/changes/build-login-ui/artifacts.md` during apply/verify with implementation and verification status.
- [ ] During sync, review `README.md`; update it only if this login UI changes stable capabilities, setup/environment variables, architecture/runtime behavior, or developer commands.
- Acceptance: verification results are recorded, OpenSpec status is current, and any README update is concise and justified.

## Chained PR boundaries

1. **PR 1 — Auth contracts and unit-level tests**
   - Start: no login feature files exist.
   - Finish: `login-validation.ts`, `auth-client.ts`, `authenticated-handoff.ts`, and their tests pass.
   - Verification: web unit test command plus `pnpm lint:web`.
   - Rollback: remove the new auth feature helper files/tests and any unit-test script addition.

2. **PR 2 — Functional `/login` UI and E2E behavior**
   - Start: PR 1 contracts are available.
   - Finish: `/login` route and `login-form.tsx` satisfy validation, pending, error, and handoff behavior.
   - Verification: `pnpm lint:web`, `pnpm build:web`, `pnpm test:web-e2e`.
   - Rollback: remove `/login`, `login-form.tsx`, and `login.spec.ts`; keep PR 1 contracts if still useful.

3. **PR 3 — Visual polish, accessibility, and reduced-motion hardening**
   - Start: functional login UI exists.
   - Finish: styles match Kaito/mockup direction without password reset affordance, and accessibility/reduced-motion checks pass.
   - Verification: `pnpm lint:web`, `pnpm build:web`, `pnpm test:web-e2e`, plus visual review against `.context/Kaito AI Running Coach.zip` / `Kaito.dc.html`.
   - Rollback: revert login-specific CSS and visual-only E2E assertions while preserving functional login behavior.
