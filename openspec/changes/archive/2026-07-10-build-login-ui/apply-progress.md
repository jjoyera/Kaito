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

## Remaining tasks at PR 1 handoff (historical)

The following was the unchecked snapshot at the PR 1 handoff; see the PR 2
update below for the current checklist:

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

---

## PR 2 update — Functional `/login` UI and E2E behavior

### Status consumed

- Parent-provided SDD status was authoritative: OpenSpec files are authoritative because `openspec/` exists and artifact store is `both`.
- Active change: `build-login-ui`.
- Strict TDD mode: active from `openspec/config.yaml` and parent prompt; global strict-TDD guidance was read from `$HOME/.pi/agent/gentle-ai/support/strict-tdd.md`.
- Action context: repository workspace root; all edits stayed inside this workspace.
- Review workload guard: high 400-line budget risk and chained PRs recommended. Parent explicitly assigned the resolved chained slice: **PR 2 / Tasks 3–4 only**.

### Workload / PR boundary

- Current slice: **PR 2 — Functional `/login` UI and E2E behavior**.
- Implemented only Tasks 3–4.
- Out of scope and not implemented: PR 3 visual polish, approved mockup-level mountain background, decorative animation, reduced-motion CSS, broad accessibility hardening, signup, password reset, magic-link, social auth, demo access, route guards, onboarding/dashboard branching, backend changes, real Supabase account integration, and commits.

Dependency diagram:

```text
PR 1 Auth contracts and unit-level tests
   ↓
📍 PR 2 Functional /login UI and E2E behavior
   ↓
PR 3 Visual polish, accessibility, and reduced-motion hardening
```

### Completed tasks and persisted checkbox updates

Persisted in `openspec/changes/build-login-ui/tasks.md`:

- [x] Task 3.1 Playwright `/login` coverage for labels, keyboard reachability, local required-field validation, invalid email validation, and visible email preservation.
- [x] Task 3.2 Controlled-auth-outcome Playwright coverage for pending duplicate-submit prevention, invalid-credentials feedback, technical/system error feedback, and successful authenticated-flow handoff.
- [x] Task 3.3 Test-only auth mock adapter selected by explicit Playwright/non-production env flag `NEXT_PUBLIC_KAITO_TEST_AUTH_ADAPTER=1` in `apps/web/playwright.config.ts`.
- [x] Task 4.1 Thin `/login` route composition in `apps/web/app/(auth)/login/page.tsx`.
- [x] Task 4.2 Client `LoginForm` component for field state, validation, pending state, submit handling, and error rendering.
- [x] Task 4.3 Email/password controls use accessible labels, `type="email"`, `type="password"`, `autoComplete="email"`, and `autoComplete="current-password"`.
- [x] Task 4.4 Submit is disabled during pending and guarded with an in-flight ref.
- [x] Task 4.5 Invalid-credentials and technical/system feedback render as separate messages.
- [x] Task 4.6 Success calls `continueToAuthenticatedFlow(...)`; no out-of-scope auth entry points or downstream routing branches were added.

### Files changed

- `apps/web/e2e/login.spec.ts`
- `apps/web/playwright.config.ts`
- `apps/web/app/(auth)/login/page.tsx`
- `apps/web/features/auth/login-form.tsx`
- `apps/web/app/styles.css` — minimal functional layout/focus/error styles only, not PR 3 visual polish.
- `openspec/changes/build-login-ui/tasks.md`
- `openspec/changes/build-login-ui/artifacts.md`
- `openspec/changes/build-login-ui/apply-progress.md`

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3/4 `/login` form behavior | `apps/web/e2e/login.spec.ts` | E2E | N/A for new route/form; existing `pnpm test:web-auth` passed 15/15 before final validation | ✅ Written first; focused Playwright run failed because `/login` UI did not exist and timed out/failed as expected | ✅ Implemented `/login` route and form; focused `pnpm --filter web exec playwright test e2e/login.spec.ts` passed 7/7 | ✅ Covered labels/focus order, required fields, invalid email preservation, pending duplicate guard, invalid credentials, system error, and success handoff | ✅ Tightened duplicate-submit guard with `useRef`, filtered Next route-announcer alert in assertions, and focused E2E remained 7/7 |
| 3 test auth adapter flag | `apps/web/e2e/login.spec.ts` | E2E/config | Existing `apps/web/playwright.config.ts` read before edit | ✅ Tests required controlled auth outcomes without real accounts | ✅ Added `NEXT_PUBLIC_KAITO_TEST_AUTH_ADAPTER=1` in Playwright config and test-only adapter branches in `login-form.tsx` | ✅ Distinct emails exercise pending, invalid-credential, system-error, and success outcomes | ✅ Kept adapter explicit to Playwright/non-production env and avoided network/backend changes |

### Test Summary

- Total PR 2 E2E tests written: 7.
- Total PR 2 E2E tests passing: 7 focused; 9/9 full web E2E including existing smoke tests.
- Layers used: Unit (existing PR 1 auth tests rerun: 15), E2E (7 new login tests).
- Approval tests: None — no refactoring of existing production behavior beyond additive route/form/style/config changes.
- Pure functions created: 0 in PR 2; PR 2 reused PR 1 pure validation/auth/handoff helpers.

### Commands run

- RED: `pnpm --filter web exec playwright test e2e/login.spec.ts` → failed as expected before `/login` implementation; first run timed out/failures on missing UI.
- GREEN/focused: `pnpm --filter web exec playwright test e2e/login.spec.ts` → initially 4/7 passing, then 6/7 passing while fixing pending/alert behavior.
- GREEN/focused final: `pnpm --filter web exec playwright test e2e/login.spec.ts` → passed, 7/7.
- Validation: `pnpm test:web-auth` → passed, 15/15.
- Validation: `pnpm lint:web` → passed.
- Validation: `pnpm build:web` → passed; `/login` prerendered successfully.
- Validation: `pnpm test:web-e2e` → passed, 9/9.

### Deviations from design

- Real Supabase/browser auth integration remains deferred; PR 2 uses the provider-agnostic sign-in contract and an explicit Playwright-only mock adapter for deterministic UI behavior tests.
- `apps/web/app/styles.css` received only minimum functional login layout, focus, disabled, and error styles needed for usable PR 2 behavior. PR 3 brand/mockup polish, mountain background, animation, and reduced-motion CSS remain intentionally deferred.
- Successful handoff continues to use the centralized PR 1 destination (`/`) via `continueToAuthenticatedFlow(...)`; no onboarding/dashboard decision logic was added.

### Remaining tasks

Exact unchecked task lines remaining in `tasks.md`:

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

### CodeRabbit follow-up

- Production route gating was superseded during PR 3 verify: the user chose to
  expose `/login` in production, and the production-build Playwright check now
  verifies the page renders under `pnpm start` on port 3100.
- Duplicate-submit coverage now focuses an enabled control before the second
  Enter activation and verifies exactly one guarded test-adapter call.
- Rejected sign-in promises now render/report the system error and always
  release the in-flight guard.
- Final change verification and README sync remain unchecked as future PR 3/final
  tasks.

### PR 2 ready state

PR 2 implementation is complete and validated for its assigned scope. The broader
`build-login-ui` change is **not ready for final verify/archive** because PR 3
remains unchecked.

---

## PR 3 update — Visual polish, accessibility, and reduced-motion hardening

### Status consumed

- Parent-provided structured status was authoritative: `artifactStore: both`, OpenSpec authoritative because `openspec/` exists, active change `build-login-ui`, and PR 1/PR 2 dependencies ready.
- Strict TDD mode was active from `openspec/config.yaml` and the parent prompt. Global strict-TDD guidance was consumed from `$HOME/.pi/agent/gentle-ai/support/strict-tdd.md`.
- Action context warning: no separate `allowedEditRoots` was supplied; mode was not workspace-planning and every edit stayed in the authoritative repository workspace.
- Review-workload guard was resolved by the parent: `auto-chain`/assigned PR 3 slice only. No commit or push was made.

### Workload / PR boundary

- Current slice: **PR 3 — Visual polish, accessibility, and reduced-motion hardening** (Tasks 5–8, except the explicitly sync-owned README review).
- Changed production files are limited to the login route, form semantics, and global login CSS. No backend/API changes were made.
- Verification reconciliation: the current PR 3 source/test diff is 439 changed lines (355 additions, 84 deletions) before OpenSpec status documents. It stays below the configured 600-line review budget and inside the dedicated PR 3 visual/accessibility boundary.

### Completed tasks and persisted checkbox updates

Persisted in `openspec/changes/build-login-ui/tasks.md`:

- [x] Tasks 5.1–5.4: Kaito tokens and warm mountain/sun/trail composition were implemented from the inspected `Kaito.dc.html` reference; no password recovery was added and the form remains primary.
- [x] Tasks 6.1–6.4: feedback associations and alert semantics, accessibility/focus and reduced-motion Playwright coverage, `prefers-reduced-motion` CSS, and 375px/1440px no-overflow checks.
- [x] Tasks 7.1–7.4: auth feature boundary/refactor review, thin route, concise coaching copy, and frontend-only confirmation.
- [x] Tasks 8.1–8.3: expected validation commands, existing auth helper test command, and artifact status update.

### Files changed

- `apps/web/app/(auth)/login/page.tsx`
- `apps/web/app/styles.css`
- `apps/web/e2e/login.spec.ts`
- `apps/web/features/auth/login-form.tsx`
- `openspec/changes/build-login-ui/tasks.md`
- `openspec/changes/build-login-ui/artifacts.md`
- `openspec/changes/build-login-ui/apply-progress.md`

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 5/6 visual, accessibility, responsive motion | `apps/web/e2e/login.spec.ts` | E2E | ✅ Existing focused login suite passed 7/7 | ✅ Added failing accessible Kaito brand assertion plus expected default card animation before production changes; 1/9 failed | ✅ Route branding, CSS composition/motion, and field alert semantics made focused suite pass 9/9 at apply time | ✅ Validated both 375px and 1440px viewports, default and reduced motion, field descriptors, and each alert message | ✅ Kept CSS-only decoration and compact route composition; focused suite passed 9/9 before subsequent user-requested visual tweaks |
| 7 refactor/boundary review | Existing auth tests | Unit + E2E | ✅ `pnpm test:web-auth` passed 15/15 before final validation | ➖ Approval behavior already covered by existing unit/E2E suite; no behavior change required | ✅ 15/15 auth tests and 9/9 focused login E2E passed | ➖ Structural review only: provider mapping and raw-error boundary remain in `auth-client.ts` | ✅ No extraction was needed; route remains composition-only and form logic remains feature-local |
| 8 verification/status | Existing validation runners | Unit + E2E | ✅ Focused suites green | ➖ Documentation/status task; no production behavior | ✅ Lint, build, auth tests, and full E2E passed | ➖ Command outcomes cover unit and browser paths | ✅ Status documentation merged with prior PR 1/PR 2 progress |

### Commands run

- Safety net: `pnpm --filter web exec playwright test e2e/login.spec.ts` → passed, 7/7 before PR 3 edits.
- RED: `pnpm --filter web exec playwright test e2e/login.spec.ts` → failed as expected: accessible `Kaito mountain coach` brand mark did not exist.
- GREEN/refactor: `pnpm --filter web exec playwright test e2e/login.spec.ts` → passed, 9/9.
- `pnpm test:web-auth` → passed, 15/15.
- `pnpm lint:web` → passed.
- `pnpm build:web` → passed; `/login` prerendered.
- `KAITO_PLAYWRIGHT_PORT=3001 pnpm test:web-e2e` → passed: 11 development E2E tests and 1 production login-page test. Expected synthetic no-DSN Sentry console diagnostics were emitted by the pre-existing no-Sentry test; the command passed.

### Deviations from design

- The approved reference uses inline SVG scenery. This slice uses CSS-only mountain layers, a sun gradient, and a diagonal serpentine orange trail running from the lower-left viewport toward the sun. Following the user's latest decision, the brand header uses a text-only `Kaito` wordmark; no image logo asset is rendered.
- User-facing login copy is Spanish (Spain) for now; no i18n framework or translation files were introduced.
- Verification reconciliation: the text-only wordmark and final trail treatment
  were subsequent user-requested visual tweaks. Their final GREEN state was
  re-established during verify with `KAITO_PLAYWRIGHT_PORT=3001 pnpm
  test:web-e2e`.
- The existing form already had `aria-invalid`, `aria-describedby`, and form-level alerts. PR 3 added `role="alert"` to field-level feedback and E2E assertions for the complete feedback contract.
- README review is intentionally not completed here: Tasks 8.4 and sync configuration assign it to sync, and this frontend visual/accessibility slice did not alter stable commands, setup, environment variables, or runtime architecture.

### Remaining tasks

Exact unchecked task line remaining in `tasks.md`:

- [ ] During sync, review `README.md`; update it only if this login UI changes stable capabilities, setup/environment variables, architecture/runtime behavior, or developer commands.

### PR 3 ready state

PR 3 implementation is complete and its completed tasks are visibly checked in the persisted task artifact. The change is ready for **verify**, then sync's required README review; it is not yet ready for archive.

---

## Final sync update

- Verification passed on 2026-07-10; canonical spec sync completed without archiving.
- Root `README.md` was reviewed and updated because `/login` is a stable production capability and the validation flow now documents `KAITO_PLAYWRIGHT_PORT` plus the production login-page check.
- The README review task is checked in `tasks.md`. See `sync-report.md` for canonical merge details.
