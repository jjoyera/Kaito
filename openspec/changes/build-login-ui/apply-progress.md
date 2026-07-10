# Apply Progress — build-login-ui

## Status consumed

- Parent-provided SDD status was authoritative: `artifactStore: both` with OpenSpec files authoritative because `openspec/` exists.
- `applyState/dependencies.apply`: ready.
- Strict TDD mode: active from `openspec/config.yaml` and parent prompt.
- Action context: repository workspace root; no separate edit-root restriction was provided, and all edits stayed inside the workspace.
- Review workload guard: high 400-line budget risk with chained PRs recommended. User explicitly approved chained PR flow and PR 1 first.

## Workload / PR boundary

- Current slice: **PR 1 — Auth contracts and unit-level tests**.
- Implemented only Tasks 1–2.
- Out of scope and not implemented: `/login` route, visual UI, `login-form.tsx`, Playwright login E2E, styling polish, password recovery/signup/demo/social auth, backend changes.

Dependency diagram:

```text
📍 PR 1 Auth contracts and unit-level tests
   ↓
PR 2 Functional /login UI and E2E behavior
   ↓
PR 3 Visual polish, accessibility, and reduced-motion hardening
```

## Completed tasks and persisted checkbox updates

Persisted in `openspec/changes/build-login-ui/tasks.md`:

- [x] Task 1.1 login validation tests.
- [x] Task 1.2 auth-client outcome mapping tests.
- [x] Task 1.3 authenticated-handoff boundary tests.
- [x] Task 1.4 web/root unit-test scripts for auth helpers.
- [x] Task 2.1 pure login validation helpers and field-error types.
- [x] Task 2.2 provider-agnostic sign-in contracts and outcome mapping.
- [x] Task 2.3 centralized authenticated-flow handoff abstraction.
- [x] Task 2.4 UI-facing APIs keep Supabase/provider types and raw error payloads out.

## Files changed

- `apps/web/features/auth/login-validation.test.ts`
- `apps/web/features/auth/login-validation.ts`
- `apps/web/features/auth/auth-client.test.ts`
- `apps/web/features/auth/auth-client.ts`
- `apps/web/features/auth/authenticated-handoff.test.ts`
- `apps/web/features/auth/authenticated-handoff.ts`
- `apps/web/package.json`
- `package.json`
- `openspec/changes/build-login-ui/tasks.md`
- `openspec/changes/build-login-ui/artifacts.md`
- `openspec/changes/build-login-ui/apply-progress.md`

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1/2 login validation | `apps/web/features/auth/login-validation.test.ts` | Unit | N/A (new files) | ✅ Written first; focused run failed because `./login-validation` did not exist | ✅ `pnpm test:web-auth` passed | ✅ 6 cases: required email, invalid email shape, required password, valid input, trimmed submission email, visible email preservation | ✅ Extracted email pattern/types; `pnpm test:web-auth` still passed |
| 1/2 auth client | `apps/web/features/auth/auth-client.test.ts` | Unit | N/A (new files) | ✅ Written first; focused run failed because `./auth-client` did not exist | ✅ `pnpm test:web-auth` passed | ✅ 5 cases: success, invalid credentials, system error, adapter input, thrown provider failure | ✅ Extracted invalid-credential constants/types; `pnpm test:web-auth` still passed |
| 1/2 authenticated handoff | `apps/web/features/auth/authenticated-handoff.test.ts` | Unit | N/A (new files) | ✅ Written first; focused run failed because `./authenticated-handoff` did not exist | ✅ `pnpm test:web-auth` passed | ✅ 2 cases: centralized destination delegation and no onboarding/dashboard state inspection | ✅ Removed lint warning while preserving behavior; `pnpm test:web-auth` still passed |
| 1 script addition | `package.json`, `apps/web/package.json` | Unit command wiring | Existing `tsx --test` pattern reviewed in `test:sentry-scrubbing` | ✅ Auth tests initially runnable only through ad-hoc `pnpm --filter web exec tsx --test features/auth/*.test.ts` | ✅ `pnpm test:web-auth` passed | ➖ Structural command wiring; triangulated by root script invoking package script | ✅ JSON lint/parse clean |

## Test Summary

- Total tests written: 13.
- Total tests passing: 13.
- Layers used: Unit (13), Integration (0), E2E (0).
- Approval tests: None — no refactoring of existing production behavior.
- Pure functions/contracts created: `validateLoginInput`, `mapProviderSignInResult`, `createSignInWithPassword`, `continueToAuthenticatedFlow`.

## Commands run

- RED: `pnpm --filter web exec tsx --test features/auth/*.test.ts` → failed as expected with missing auth modules.
- GREEN/focused: `pnpm test:web-auth` → passed, 13/13 tests.
- Validation: `pnpm lint:web` → initially failed on one unused-parameter warning in `authenticated-handoff.ts`; fixed.
- Validation: `pnpm test:web-auth` → passed, 13/13 tests.
- Validation: `pnpm lint:web` → passed.
- Validation: `pnpm build:web` → passed.

## Deviations from design

- The PR 1 handoff destination is centralized as `AUTHENTICATED_FLOW_DESTINATION = "/"` because downstream authenticated routing is deferred. This keeps the temporary destination in one place and avoids onboarding/dashboard branching.
- No concrete Supabase adapter was added in PR 1; the UI-facing contract and mapping boundary are provider-agnostic as required.

## Remaining tasks

Exact unchecked task lines remaining in `tasks.md`:

- [ ] Add `apps/web/e2e/login.spec.ts` for `/login` covering visible labels, keyboard reachability, local required-field validation, invalid email validation, and preservation of the entered email value.
- [ ] Add controlled-auth-outcome coverage in `apps/web/e2e/login.spec.ts` for pending duplicate-submit prevention, invalid-credentials feedback, technical/system error feedback, and successful authenticated-flow handoff.
- [ ] Use a test-only mock adapter selected by an explicit Playwright/non-production flag in `apps/web/playwright.config.ts`, or document a concrete network-interception target if the implementation chooses interception.
- [ ] Create `apps/web/app/(auth)/login/page.tsx` as a thin route-level composition for `/login`.
- [ ] Create `apps/web/features/auth/login-form.tsx` as a client component for field state, validation, pending state, submit handling, and error rendering.
- [ ] Ensure email/password controls use accessible labels, `type="email"`, `type="password"`, `autoComplete="email"`, and `autoComplete="current-password"`.
- [ ] Disable or guard submit while pending so repeated activation cannot start a second sign-in attempt.
- [ ] Render generic invalid-credentials feedback separately from technical/system feedback.
- [ ] On success, call `continueToAuthenticatedFlow(...)`; do not add signup, password reset, magic-link, social auth, demo access, route guards, or onboarding/dashboard branching.
- [ ] Update `apps/web/app/styles.css` with Kaito login tokens and page styles: warm sand background, off-white card, forest/deep green primary, restrained gold/orange accents, and earth-red errors.
- [ ] Use `.context/Kaito AI Running Coach.zip` / `Kaito.dc.html` as the primary visual reference for background depth, motion, card styling, compact brand header, mountain/sun language, and golden trail accent.
- [ ] Do not copy the mockup password-recovery affordance; password reset remains out of scope.
- [ ] Keep background and motion secondary to readable form focus; avoid generic blue SaaS, futuristic AI clichés, medical styling, and aggressive gym branding.
- [ ] Ensure `aria-invalid`, `aria-describedby`, and semantic alert/live-region behavior for field-level and form-level feedback in `apps/web/features/auth/login-form.tsx`.
- [ ] Add or extend Playwright checks in `apps/web/e2e/login.spec.ts` for accessible names, focus order, feedback exposure, and reduced-motion behavior.
- [ ] Add `@media (prefers-reduced-motion: reduce)` handling in `apps/web/app/styles.css` so decorative animation is disabled without changing essential behavior.
- [ ] Verify mobile and desktop layouts avoid horizontal overflow and keep touch targets comfortable.
- [ ] Review `apps/web/features/auth/*` for duplication, provider leakage, raw error exposure, and oversized components.
- [ ] Keep route composition in `apps/web/app/(auth)/login/page.tsx` thin; move form logic only to feature files.
- [ ] Keep copy brief and coaching-oriented; do not turn `/login` into a marketing landing page.
- [ ] Confirm no backend/API files are touched unless a new discovery makes that unavoidable and separately approved.
- [ ] Run expected frontend validation commands after implementation: `pnpm lint:web`, `pnpm build:web`, and `pnpm test:web-e2e`.
- [ ] If package scripts were added for unit tests, run the corresponding web/root test command and document it in the apply result.
- [ ] Update `openspec/changes/build-login-ui/artifacts.md` during apply/verify with implementation and verification status.
- [ ] During sync, review `README.md`; update it only if this login UI changes stable capabilities, setup/environment variables, architecture/runtime behavior, or developer commands.

## Ready state

PR 1 implementation is complete and validated for its assigned scope. The broader change is **not ready for verify/archive** because PRs 2–3 remain unchecked.
