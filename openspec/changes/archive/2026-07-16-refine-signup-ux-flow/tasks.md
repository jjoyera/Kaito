# Implementation Tasks: Refine Signup UX Flow

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1,300–2,100 across about 17 source, test, style, and documentation files |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 provider contracts + reducer → PR 2 nonce bridge + login banner → PR 3 registration overlay/cooldown integration + E2E → PR 4 verified docs sync |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

The approved 3,000-line review budget can accommodate a single PR, but the forecast is well above the 400-line guard. The parent must confirm either the suggested chain or an explicit single-PR size exception before apply.

## Apply constraints

- Use strict TDD for every slice: **RED → GREEN → TRIANGULATE → REFACTOR**. Do not weaken existing assertions to fit the frozen diff.
- Treat the current uncommitted application changes as frozen reference only until apply begins; reconcile them through the tasks below rather than accepting them wholesale.
- Do not add a password-recovery route, link, disabled control, or placeholder CTA. A duplicate-account outcome may link only to the existing `/login` route.
- Keep provider payloads, credentials, submitted email, nonce records, and cooldown storage out of Sentry and navigation data except for the non-sensitive URL nonce defined by the design.
- Use Node.js `>=24.18 <25` for the required web commands.

## Work unit 1 — Provider contracts and registration state

**Boundary:** Starts from the frozen adapter/use-case implementation. Finishes with provider-safe outcomes and a tested pure reducer/cooldown model, without changing rendered registration behavior. Verify with `pnpm test:web-auth`. Roll back by reverting only the contract/domain files in this unit.

### RED

- [x] Extend `apps/web/features/auth/_adapters/supabase-sign-up.test.ts` with failing cases for session/no-session success, both allow-listed duplicate codes, `over_email_send_rate_limit`, HTTP 429, unknown errors, optional structured retry seconds, and redaction of session/provider message/body details. <!-- sdd-owner: implementation -->
- [x] Extend `apps/web/features/auth/_use-cases/register-client.test.ts` with failing assertions for all closed `RegisterOutcome` variants, retry metadata propagation only on classified rate limits, finite-positive validation with fractional values rounded up, 60-second fallback selection, and thrown adapter/reporter failures. <!-- sdd-owner: implementation -->

### GREEN

- [x] Update `apps/web/features/auth/_adapters/supabase-sign-up.ts` and `apps/web/features/auth/_use-cases/register-client.ts` to expose only `{ code, status, retryAfterSeconds }`, preserve the authenticated/confirmation split, allow-list duplicate/rate-limit observations, and never parse provider message text. <!-- sdd-owner: implementation -->

### TRIANGULATE

- [x] Add edge cases in both contract test files for missing, non-numeric, non-finite, zero, negative, fractional, and unsafe-deadline retry values; prove metadata on non-rate errors neither leaks nor changes classification. <!-- sdd-owner: implementation -->
- [x] Create failing `apps/web/features/auth/_domain/register-flow.test.ts` coverage for request IDs, stale settlements, authenticated/login navigation states, duplicate/system recovery, field-edit transitions, absolute provider/fallback cooldown deadlines, persisted deadline hydration, malformed/expired storage, and automatic expiry. <!-- sdd-owner: implementation -->

### GREEN

- [x] Implement `apps/web/features/auth/_domain/register-flow.ts` as the closed reducer and pure cooldown/deadline rules from the design, including the exact 60-second fallback and guards that prevent stale requests or field edits from clearing an active rate limit. <!-- sdd-owner: implementation -->

### REFACTOR

- [x] Consolidate duplicated classification/deadline helpers within the concrete auth files only, keep names provider-agnostic, and run `pnpm test:web-auth` with all work-unit tests green. <!-- sdd-owner: implementation -->

## Work unit 2 — One-time confirmation bridge and login banner

**Boundary:** Starts with no signup-confirmation handling on `/login`. Finishes with an independently testable, one-time, 30-second nonce protocol and login presentation that can be exercised by seeded session storage. Verify with auth tests plus focused login Playwright tests. Roll back the use case, banner, and login-page composition together.

### RED

- [x] Add failing `apps/web/features/auth/_use-cases/post-signup-confirmation.test.ts` cases for UUID creation, nonce-specific storage keys, `{ version: 1, createdAt }` shape, no email/credential retention, matching consumption at ages `0..30_000ms`, removal-before-success, and one-time use. <!-- sdd-owner: implementation -->

### GREEN

- [x] Implement injectable create/consume operations in `apps/web/features/auth/_use-cases/post-signup-confirmation.ts` using storage, clock, and nonce interfaces; reject malformed UUIDs/records without making storage failure an auth failure. <!-- sdd-owner: implementation -->

### TRIANGULATE

- [x] Add bridge tests for missing, expired, future-dated, wrong-version, malformed JSON, oversized/repeated nonce input, inaccessible storage, removal failure, copied URLs, and replay attempts. <!-- sdd-owner: implementation -->
- [x] Add failing browser cases to `apps/web/e2e/login.spec.ts` proving plain, direct-random, malformed, repeated, and refreshed `/login?signupConfirmation=...` visits do not show a confirmation claim, while a valid seeded one-time record does. <!-- sdd-owner: implementation -->

### GREEN

- [x] Add `apps/web/features/auth/_components/post-signup-confirmation-banner.tsx` and update `apps/web/app/(auth)/login/page.tsx` to accept one UUID-shaped scalar, consume the matching record, render fixed Spanish copy with `role="status"`/`aria-live="polite"`, and strip only `signupConfirmation` with `history.replaceState` while preserving safe existing login parameters. <!-- sdd-owner: implementation -->

### REFACTOR

- [x] Keep signup confirmation separate from `getLoginContextMessage`, remove any URL-only success path, and run `pnpm test:web-auth` plus the focused `/login` Playwright cases. <!-- sdd-owner: implementation -->

## Work unit 3 — Auth-owned overlay and registration orchestration

**Boundary:** Starts from the frozen native shared dialog, string statuses, confirmation panel, and retryable static 429 message. Finishes with the reducer-driven request flow, automatic nonce-bound login redirect, persisted cooldown, auth-owned custom overlay, and deterministic browser fixtures. Verify with auth tests and registration/login E2E. Roll back redirect and banner together; overlay/cooldown files can be reverted as the same registration unit without data migration.

### Slice 3A — Processing overlay cleanup

#### RED

- [x] Rewrite the pending-request case in `apps/web/e2e/register.spec.ts` to fail until exactly one ordinary-DOM named/described modal is present, no native `dialog` exists, focus is contained, background siblings are inert, body scrolling is locked, submit is disabled, and Escape/backdrop/Enter cannot dismiss it or produce a second signup call. <!-- sdd-owner: implementation -->

#### GREEN

- [x] Add `apps/web/features/auth/_components/processing-overlay.tsx` using a body portal, `role="dialog"`, `aria-modal`, generated label/description IDs, saved focus, focus containment, sibling inerting, scroll locking, non-dismissible input handling, and full cleanup/restoration on close or unmount. <!-- sdd-owner: implementation -->
- [x] Replace the import in `apps/web/features/auth/_components/register-form.tsx`, delete `apps/web/shared/components/processing-modal.tsx`, and replace native `[open]`/`::backdrop` rules in `apps/web/app/styles.css` with auth overlay/backdrop, focus, spinner, and reduced-motion styles. <!-- sdd-owner: implementation -->

#### TRIANGULATE

- [x] Extend `apps/web/e2e/register.spec.ts` for Tab/Shift+Tab containment, attempted programmatic focus escape, backdrop pointer input, prior inert/overflow restoration, request-bound closure, inline-result focus return, and a visible non-animated reduced-motion indicator. <!-- sdd-owner: implementation -->

#### REFACTOR

- [x] Remove every remaining `ProcessingModal`, native `<dialog>`, `showModal`, `close`, `cancel`, `[open]`, and `::backdrop` reference from concrete discovery target `apps/web/`; retain the overlay under auth because there is only one real feature consumer. <!-- sdd-owner: implementation -->

### Slice 3B — Reducer-driven outcomes and confirmation redirect

#### RED

- [x] Replace confirmation-on-register assertions in `apps/web/e2e/register.spec.ts` with failing expectations for automatic `/login` replacement, visible polite confirmation guidance, stripped nonce, absent email/credentials in URL and session storage, no replay after refresh/back, and preserved immediate-session navigation to `/onboarding`. <!-- sdd-owner: implementation -->
- [x] Add failing registration cases for zero calls/no overlay on invalid input; distinct duplicate/system feedback; editable recovery and successful retry; feedback focus after settlement; a valid existing `/login` action if rendered; and absence of every password-recovery route/link/CTA. <!-- sdd-owner: implementation -->

#### GREEN

- [x] Rework `apps/web/features/auth/_components/register-form.tsx` to use `register-flow.ts`, a synchronous `pendingSubmission` guard, monotonic request IDs, and the auth overlay; preserve local validation and the existing authenticated handoff while clearing request-only locks on every settlement. <!-- sdd-owner: implementation -->
- [x] Remove the frozen `confirmation_required` replacement panel and manual “Ir a iniciar sesión” step from `register-form.tsx`; after no-session success create the nonce record, enter `navigating(login)`, and call `router.replace` without exposing registration values. Remove the nonce and show recoverable system feedback if replacement throws synchronously. <!-- sdd-owner: implementation -->
- [x] Keep duplicate and system outcomes in a persistent focusable inline region in `register-form.tsx`; clear duplicate on email edit, clear system feedback on edit/retry, distinguish their Spanish copy without color-only meaning, and add no recovery capability. <!-- sdd-owner: implementation -->

#### TRIANGULATE

- [x] Extend the deterministic test branch in `register-form.tsx` with a dedicated registration call counter and delayed/immediate confirmation, duplicate, system-error-then-success, and immediate-session fixtures; update E2E assertions so equivalent click, Enter, and synthetic submits prove one in-flight provider call. <!-- sdd-owner: implementation -->

#### REFACTOR

- [x] Remove the obsolete local `RegisterStatus`, confirmation panel copy/styles, and loosely coupled status booleans from `register-form.tsx` and `apps/web/app/styles.css`, leaving the reducer as the single flow-state owner. <!-- sdd-owner: implementation -->

### Slice 3C — Persisted rate-limit cooldown

#### RED

- [x] Add failing `apps/web/e2e/register.spec.ts` cases for 60-second fallback guidance, disabled submit plus handler-level click/Enter/synthetic guards, persistence across same-tab refresh, short structured retry metadata, one expiry announcement, automatic re-enable, and exactly one new call after expiry. <!-- sdd-owner: implementation -->

#### GREEN

- [x] Implement absolute `retryAt` cooldown orchestration in `register-form.tsx`: derive it at outcome receipt, store it under a dedicated non-sensitive session key, hydrate only future valid deadlines, consult storage synchronously before every call, tolerate storage errors, and use an absolute-time tick rather than decrement-only state. <!-- sdd-owner: implementation -->
- [x] Add fallback and short structured-rate fixtures plus call counting to the deterministic registration adapter in `register-form.tsx`; render associated remaining-wait text, keep every submit path blocked during cooldown, avoid per-second live announcements, and announce once when retry becomes available. <!-- sdd-owner: implementation -->

#### TRIANGULATE

- [x] Add unit/E2E cases for delayed/background timer catch-up, malformed/expired stored deadlines, edits during cooldown, refresh bypass attempts, provider durations rounded up, storage exceptions, and retry exactly at the deadline. <!-- sdd-owner: implementation -->

#### REFACTOR

- [x] Centralize storage-key/deadline operations in the auth domain/use-case files already introduced, clear timers/listeners on unmount, and run `pnpm test:web-auth` plus focused `/register` and `/login` Playwright tests. <!-- sdd-owner: implementation -->

## Work unit 4 — Full verification and documentation sync

**Boundary:** Starts only after work units 1–3 are green. Finishes with all required web gates passing and stable documentation matching verified behavior. Documentation can be reverted independently; application rollback must keep the registration redirect and login banner together.

- [x] Run `pnpm test:web-auth`, `pnpm lint:web`, `pnpm build:web`, and `pnpm test:web-e2e` under Node.js `>=24.18 <25`; record failures without weakening tests, inspect generated-file changes such as `apps/web/next-env.d.ts`, and keep unrelated generated diffs out of the change. <!-- sdd-owner: implementation -->
- [x] Perform a scope/privacy audit over `apps/web/features/auth/`, `apps/web/app/(auth)/`, and `apps/web/shared/`: confirm no native dialog remains, no password-recovery artifact was added, no sensitive signup value is logged/stored/navigated, and no dependency/database/API/environment/proxy/onboarding change entered the diff. <!-- sdd-owner: implementation -->
- [x] Smoke-test the real Supabase confirmation-required outcome: account creation, email receipt, confirmation, successful login, and provider-obscured duplicate retry with the neutral banner and no new email. <!-- sdd-owner: implementation -->
- [ ] When environment policy permits, smoke-test a real Supabase immediate-session outcome; keep this as an explicitly unverified manual limitation until evidence exists. <!-- sdd-owner: parent -->
- [ ] Manually check one Bitwarden/password-manager-enabled browser profile; keep compatibility explicitly unverified until evidence exists. <!-- sdd-owner: parent -->
- [x] After all automated verification passes, update the stable Spanish signup statements in `docs/02-user-journeys.md`, `docs/04-functional-requirements.md`, and `docs/08-architecture.md` to describe the implemented outcomes, auth ownership, cooldown, and confirmation handoff without claiming password recovery exists. <!-- sdd-owner: implementation -->
- [x] Review `README.md` under the sync policy and update only concise current-capability/validation statements that became stale (including the claim that signup does not exist); avoid duplicating the detailed OpenSpec design. <!-- sdd-owner: implementation -->
- [x] Re-run the four web validation commands after documentation/refactor cleanup and capture final changed-line count against the approved 3,000-line review budget. <!-- sdd-owner: implementation -->

## Parent-owned review and lifecycle gates

- [x] Before apply, choose `stacked-to-main`, `feature-branch-chain`, or an explicit single-PR `size-exception`; the user approved a single-PR size exception with a 3,000-line budget. <!-- sdd-owner: parent -->
- [x] After apply, start or reuse one bounded review over the implemented diff, verification evidence, changed-line count, privacy/accessibility constraints, and the paired redirect/banner rollback boundary. Bounded review `review-4cdf00ab8bf8dfc9` approved after targeted corrections and validation. <!-- sdd-owner: parent -->
- [x] Approve sync/closure only after the required automated gates are green and any manual Supabase/password-manager limitations are explicitly recorded rather than represented as verified. Closure approved by user; real immediate-session and Bitwarden/password-manager checks remain explicit limitations. <!-- sdd-owner: parent -->
