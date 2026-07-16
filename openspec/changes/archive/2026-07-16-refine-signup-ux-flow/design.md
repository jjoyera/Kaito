# Technical Design: Refine Signup UX Flow

## Status and scope

This design implements the approved `signup-registration-ux` specification. It is limited to the web auth capability under `apps/web/features/auth/`, the `/register` and `/login` route composition, auth E2E tests, and the associated global styles. It does not add password recovery, change Supabase policy, or alter onboarding.

The current uncommitted implementation on `feature/supabase-signup-registration` is a frozen reference. This document describes how a later apply phase will reconcile it; no application code is changed in the design phase.

Session constraints for the eventual implementation are strict TDD, one PR by default, and no more than 3,000 changed lines.

## Decisions

1. **Normalize provider responses at the auth use-case boundary.** Supabase-specific status and error codes remain in the adapter. Components consume a closed `RegisterOutcome` union and never inspect provider messages.
2. **Model rate limits with optional normalized seconds.** A trusted, structured provider value may flow as `retryAfterSeconds`; otherwise the UI uses exactly 60 seconds. Human-readable provider error messages are never parsed.
3. **Use an explicit registration state machine.** Request activity, navigation, inline feedback, and cooldown are mutually exclusive states instead of loosely related booleans.
4. **Use a tab-scoped, one-time nonce bridge for confirmation guidance.** A random nonce appears temporarily in the URL and must match a short-lived `sessionStorage` record created only after a no-session signup result. The record contains no email or credentials and is consumed before the banner is shown.
5. **Own the custom overlay in auth.** Registration is the only real feature consumer. The component moves to `features/auth/_components/`; the speculative shared native `<dialog>` is removed.
6. **Do not add a component test stack.** Pure contracts/state are covered by the existing Node runner, while browser rendering, focus, inertness, announcements, navigation, and timers are covered by Playwright.

## Provider and use-case contracts

### Provider-normalized result

`apps/web/features/auth/_use-cases/register-client.ts` will retain provider-agnostic input and define the following boundary:

```ts
type ProviderRegisterError = {
  code?: string;
  status?: number;
  retryAfterSeconds?: number;
};

type ProviderRegisterResult =
  | { ok: true; hasSession: boolean }
  | { ok: false; error?: ProviderRegisterError };

type RegisterOutcome =
  | { status: "authenticated" }
  | { status: "confirmation_required" }
  | { status: "duplicate_account" }
  | { status: "rate_limited"; retryAfterSeconds?: number }
  | { status: "system_error" };
```

No raw Supabase `Session`, user object, message, response body, email, or token crosses this boundary.

### Supabase mapping

`createSupabaseSignUpAdapter` maps `auth.signUp` as follows:

| Supabase observation | Provider result | Use-case outcome |
| --- | --- | --- |
| no error and `data.session !== null` | `{ ok: true, hasSession: true }` | `authenticated` |
| no error and `data.session === null` | `{ ok: true, hasSession: false }` | `confirmation_required` |
| error code `user_already_exists` or `email_exists` | rejected with redacted code/status | `duplicate_account` |
| error code `over_email_send_rate_limit` or HTTP status `429` | rejected with redacted code/status and optional structured retry seconds | `rate_limited` |
| any other provider error | rejected with redacted code/status | `system_error` |
| thrown provider/network error | caught by `createRegisterWithPassword` | `system_error` |

Duplicate status is inferred only from the explicit allow-listed codes. It is not inferred from message text, an empty identities array, or a no-session success. If a Supabase configuration intentionally obscures duplicate accounts as a successful no-session response, Kaito follows that provider result and treats it as confirmation-required.

Supabase Auth JS 2.110.0 exposes code/status on the public signup error but does not provide a documented `Retry-After` header through `signUp`. Consequently the current adapter will normally leave `retryAfterSeconds` absent and the 60-second fallback will apply. The contract permits a future adapter to populate it only from a documented structured provider field/header. The implementation MUST NOT parse localized or mutable error message text.

A shared pure normalizer accepts retry metadata only when it is a finite positive value from the structured adapter field; it rounds fractional seconds up. Values that are missing, non-numeric, non-finite, zero, negative, or unsafe for a JavaScript deadline are rejected and use 60 seconds. The normalized value is copied only for a classified rate-limit outcome; metadata attached to another error cannot turn it into a rate limit.

### System error reporting

The use case continues to convert thrown values to `system_error`. Sentry reporting is best effort and generic. It must not include provider message/body, form values, email, password, confirmation nonce, or sessionStorage contents.

## Registration state machine

A pure reducer under `features/auth/_domain/register-flow.ts` will make transitions testable. The component retains field values and field errors, while the reducer owns flow state:

```ts
type RegisterFlowState =
  | { kind: "idle" }
  | { kind: "submitting"; requestId: number }
  | { kind: "navigating"; destination: "onboarding" | "login" }
  | { kind: "duplicate_account" }
  | { kind: "rate_limited"; retryAt: number; now: number }
  | { kind: "system_error" };
```

`pendingSubmission.current` remains as a synchronous same-tick guard; `requestId` prevents a stale settlement from changing a newer state. There is only one provider call in flight.

### Transition table

| Current/event | Guard/action | Next state and UI |
| --- | --- | --- |
| idle or recoverable feedback / submit | validate locally | invalid: remain without provider call or overlay; focus first invalid field |
| idle or recoverable feedback / valid submit | not in cooldown and no request pending | `submitting`; one provider call; custom overlay visible |
| submitting / authenticated | matching request | `navigating(onboarding)`; close overlay; existing authenticated handoff to `/onboarding`, then refresh |
| submitting / confirmation-required | matching request | create one-time confirmation bridge, then `navigating(login)`; close overlay; `router.replace` to nonce-bound `/login` URL |
| submitting / duplicate | matching request | `duplicate_account`; close overlay; keep fields; focus inline feedback |
| submitting / rate limit | matching request | compute/store deadline; `rate_limited`; close overlay; focus inline feedback; disable every submit path |
| submitting / system error or throw | matching request | `system_error`; close overlay; clear request lock; focus inline feedback |
| duplicate / email edit | — | `idle`; the user may revise and retry |
| system error / any field edit or retry | — | `idle`; the user may retry |
| rate limited / field edit | deadline not expired | remain rate-limited; editing cannot clear the lock |
| rate limited / timer or submit | `Date.now() >= retryAt` | clear persisted deadline and return to `idle`; submit can proceed without reload |

The `navigating` state keeps submit controls disabled during the short route handoff but does not keep the request overlay open: the overlay represents only the active Supabase promise. If `router.replace` throws synchronously, the nonce record is removed and the component transitions to `system_error`.

### Inline feedback

A persistent, focusable feedback region (`tabIndex={-1}`) sits inside the form. After a non-navigation settlement, a post-render effect focuses it.

- **Duplicate:** an error-styled message states that an account already exists and may link to the real `/login` page. It includes no password-recovery link, route, disabled control, or promise of an unavailable action. Changing the email clears this outcome.
- **Rate limit:** an error-styled initial announcement explains the limit and exposes `Podrás intentarlo de nuevo en N segundos` as text associated with the submit button. The submit button is natively disabled, and the form handler also checks the deadline so Enter, click, synthetic submit, and stale render paths make zero calls. Per-second visual updates are not repeatedly live-announced; expiry emits one polite status such as `Ya puedes volver a intentarlo` and enables submit automatically.
- **System error:** a separate generic error message leaves all fields editable and retry available. It never reuses duplicate/rate-limit wording.

The deadline is calculated from receipt of the outcome, not request start. The chosen seconds are provider-derived when valid or exactly 60 otherwise. A per-second clock uses absolute `retryAt`, not decrement-only state, so delayed/background timers do not extend the lock. The deadline is also stored in sessionStorage under a dedicated non-sensitive auth key. Initial hydration restores a future deadline, and the submit handler synchronously consults the stored deadline before making a call; this prevents refresh from trivially bypassing an active same-tab cooldown. Expired/malformed stored values are removed. Storage failure falls back to the in-memory lock and must not turn a rate limit into a system error.

## Confirmation-required handoff to `/login`

### Alternatives considered

- **Plain `?context=confirmation_required`: rejected.** It is allow-listed but can be copied, directly visited, or refreshed to produce a false claim.
- **Email or other registration data in search params/router state: rejected.** It violates the privacy requirement and can leak through history, logs, referrers, screenshots, or telemetry.
- **Unbound sessionStorage flag: rejected.** It can become stale and be consumed by an unrelated later visit to `/login`.
- **Transient React/module state only: rejected.** It is not reliable across an App Router navigation/server render and has poor refresh semantics.
- **Minting an HttpOnly cookie through a new route/action: not selected.** Because signup currently occurs in the browser, a cookie-mint endpoint would still accept a client assertion unless the whole signup moved server-side. It adds proxy/cookie consumption complexity without creating meaningful provider authenticity for this informational, non-authorizing banner.
- **Nonce in URL bound to one-time sessionStorage: selected.** It survives the immediate App Router transition, is tab-scoped, has explicit one-time/TTL behavior, and contains no sensitive data.

### Bridge protocol

A small auth use case, `features/auth/_use-cases/post-signup-confirmation.ts`, owns creation and consumption and accepts injected storage, clock, and nonce functions for Node tests.

1. After and only after `RegisterOutcome.status === "confirmation_required"`, generate a UUID with `crypto.randomUUID()`.
2. Store JSON under `kaito:auth:signup-confirmation:<nonce>` containing only `{ version: 1, createdAt: <epoch ms> }`.
3. Call `router.replace('/login?signupConfirmation=<encoded nonce>')`. No email, password, provider payload, session, or outcome copy is stored or navigated.
4. The login Server Component syntax-checks that `signupConfirmation` is one UUID-shaped scalar and passes it to a client `PostSignupConfirmationBanner`. Repeated values, oversized values, and malformed strings become `undefined`.
5. On mount, the client component reads only the nonce-specific key. It accepts the record only when JSON shape/version match, the nonce matches through the key, and age is from 0 through 30 seconds. It removes the key before setting the banner visible. Missing, expired, future-dated, malformed, or storage-inaccessible records show nothing and are removed where possible.
6. After successful consumption, `window.history.replaceState(window.history.state, "", cleanLoginUrl)` removes `signupConfirmation` without triggering an App Router rerender; existing safe login parameters, if any, are preserved. The banner then remains for the current mounted login page.
7. Refresh has neither the URL nonce nor the consumed record, so the message is absent. A copied/direct URL has no matching tab-scoped record. Back navigation cannot replay the record. A failed registration never creates it.

The 30-second TTL defines “immediate.” This mechanism prevents accidental/direct/stale spoofing required by the specification; it is not an authorization boundary. A script already able to write arbitrary same-origin sessionStorage could fabricate the informational message, but such script execution is an independent site compromise and no protected behavior depends on the banner.

The banner uses the exact approved Spanish copy: `Si los datos son correctos, recibirás un correo para confirmar tu cuenta. Si ya tienes una cuenta, inicia sesión.` This is deliberately neutral: a no-session result may represent a provider-obscured duplicate, so the UI does not claim that an email was definitely sent. The banner does not echo query/storage values, uses success styling plus text/icon rather than color alone, and is inserted with `role="status"` and `aria-live="polite"` so it is announced after hydration. It remains visually present while the login form remains usable.

The existing `context` handling for session-expired/auth-unavailable stays separate. `getLoginContextMessage` MUST NOT gain a signup-confirmation value because a URL allow-list alone does not satisfy the one-time proof.

## Custom accessible processing overlay

### Ownership and DOM shape

Add `apps/web/features/auth/_components/processing-overlay.tsx`. It receives `open`, `title`, `description`, and a return-focus target. It is reusable inside auth but is not promoted to `shared/`: registration is its sole real feature consumer, and multiple auth callers would still count as one feature under project conventions.

When open, it creates a portal host directly under `document.body` and renders ordinary elements:

```html
<div class="auth-processing-overlay-backdrop">
  <div role="dialog" aria-modal="true" aria-labelledby="..." aria-describedby="..." tabindex="-1">
    ...
  </div>
</div>
```

No native `<dialog>`, `showModal`, `close`, `cancel`, or `::backdrop` is used.

### Accessibility and behavior contract

- `useId` supplies stable title and description IDs; `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and `aria-describedby` provide semantics.
- On open, the previously focused element is saved and the dialog container receives focus. The spinner is `aria-hidden` and the textual title/description conveys activity.
- All `document.body` children except the portal host are made `inert` for the open interval, with prior inert values saved and restored. Body scroll is locked and its prior overflow value restored. Cleanup runs on unmount as well as normal close.
- A `focusin` listener returns escaped programmatic focus to the dialog. `Tab`/`Shift+Tab` are trapped; with no interactive controls, Tab is prevented and focus remains on the dialog container.
- Escape, backdrop pointer interaction, and any close gesture are prevented. There is deliberately no close button because the underlying request is not cancellable. The form's native disabled state plus the synchronous pending guard prevents duplicate submission.
- On close, focus goes to the supplied persistent feedback region for inline outcomes or back to the submit control when no result target is requested. Navigation outcomes immediately replace the page, so temporary restoration has no user-facing dependency.
- Styles use a fixed full-viewport backdrop with a high local stacking layer. Reduced-motion mode removes spinner animation while preserving a visible processing indicator and text.

Using a portal is necessary: making background content inert while keeping an overlay nested inside that content would also inert the overlay. The component stores/restores every DOM property it changes so it does not overwrite another owner's prior state.

## Data flow

```text
/register form submit
  -> local validation
     -> invalid: field errors, no call, no overlay
     -> valid: reducer=submitting + overlay
        -> createRegisterWithPassword
           -> Supabase adapter auth.signUp
           -> redacted ProviderRegisterResult
           -> closed RegisterOutcome
        -> authenticated: reducer=navigating; authenticated handoff -> /onboarding
        -> confirmation_required: create nonce record; reducer=navigating;
                                  replace -> /login?signupConfirmation=<nonce>
                                  login consumes matching record -> banner -> strip nonce
        -> duplicate_account: reducer=duplicate; inline feedback
        -> rate_limited: normalize seconds; absolute/persisted cooldown; inline countdown
        -> system_error: generic reporting; reducer=system error; retry available
```

## Planned file changes

| Path | Change |
| --- | --- |
| `apps/web/features/auth/_use-cases/register-client.ts` | Extend rate-limit outcome/adapter contract; keep closed outcome mapping. |
| `apps/web/features/auth/_use-cases/register-client.test.ts` | RED tests for all outcomes, metadata propagation/validation, thrown failures, and no leakage. |
| `apps/web/features/auth/_adapters/supabase-sign-up.ts` | Redact and normalize Supabase success/error observations. |
| `apps/web/features/auth/_adapters/supabase-sign-up.test.ts` | RED tests for session/no-session, allow-listed duplicate/rate codes, status 429, optional structured metadata, and redaction. |
| `apps/web/features/auth/_domain/register-flow.ts` (new) | Pure reducer and cooldown/deadline rules. |
| `apps/web/features/auth/_domain/register-flow.test.ts` (new) | State-transition, stale-request, fallback, provider-duration, and expiry tests with injected times. |
| `apps/web/features/auth/_use-cases/post-signup-confirmation.ts` (new) | Create/consume nonce-bound sessionStorage records through injectable interfaces. |
| `apps/web/features/auth/_use-cases/post-signup-confirmation.test.ts` (new) | One-time, TTL, malformed, future, storage-failure, and privacy tests. |
| `apps/web/features/auth/_components/processing-overlay.tsx` (new) | Portal-based non-native modal overlay with focus/inert/scroll ownership. |
| `apps/web/features/auth/_components/post-signup-confirmation-banner.tsx` (new) | Client consumption and accessible login banner. |
| `apps/web/features/auth/_components/register-form.tsx` | Use reducer, overlay, redirect bridge, feedback focus, cooldown, and deterministic test outcomes. |
| `apps/web/app/(auth)/login/page.tsx` | Parse nonce scalar and compose the confirmation banner separately from generic login context. |
| `apps/web/shared/components/processing-modal.tsx` | Delete speculative shared native-dialog implementation. |
| `apps/web/app/styles.css` | Remove native dialog selectors; add auth overlay/backdrop, banner, focus, disabled/cooldown, and reduced-motion styles. |
| `apps/web/e2e/register.spec.ts` | Replace frozen confirmation-on-register assertions; cover overlay, outcomes, cooldown, redirect, privacy, and replay resistance. |
| `apps/web/e2e/login.spec.ts` | Add direct/malformed/refresh confirmation-context checks without weakening existing login tests. |
| `docs/02-user-journeys.md`, `docs/04-functional-requirements.md`, `docs/08-architecture.md` | Review/update in sync after verified implementation so stable docs no longer claim signup is unimplemented. |

No dependency, database, API, environment-variable, proxy, onboarding, or password-recovery file is required.

## Strict-TDD test strategy

Implementation tasks must proceed RED-GREEN-REFACTOR in small slices; tests are committed with the behavior they drive.

### Unit/contract tests

1. **Adapter:** session presence, no-session success, each duplicate code, email rate-limit code, HTTP 429, other 4xx/unknown code, safe optional retry extraction, and provider detail redaction.
2. **Use case:** exact mapping of all six outcomes; rate metadata propagates only for rate limits; invalid metadata falls back at cooldown selection; thrown adapter/reporter failures remain `system_error`.
3. **State/cooldown:** invalid flow never begins; only matching request settles; duplicate/system recover; edits do not clear rate limits; default is 60 seconds; valid metadata controls deadline; stale/malformed persisted deadlines are ignored; expiry uses absolute time and re-enables submission.
4. **Confirmation bridge:** generated value contains no email/input; only matching UUID/key/version and age `0..30_000ms` consumes; consume is one-time; refresh/direct/malformed/repeated/future/expired/storage-error cases show no eligibility.

The existing Node/tsx runner has no DOM renderer or React Testing Library. The design deliberately keeps rules in pure/injectable modules so they receive unit coverage without adding dependencies solely for this change.

### Playwright browser coverage

The development-only auth adapter remains deterministic and is extended with a registration call counter plus fixed fixtures:

- delayed no-session result for active-overlay checks;
- immediate no-session result for redirect/banner checks;
- duplicate and system errors;
- fallback rate limit and a short structured-retry fixture for automatic expiry;
- default immediate session for onboarding.

Required browser assertions:

- invalid fields: zero call count and no overlay;
- pending request: exactly one ordinary-DOM dialog, no native `dialog` element, correct name/description, focus inside, background inert, submit disabled, Escape/backdrop/Enter cannot dismiss or make a second call;
- no-session: automatic `/login`, visible polite confirmation banner, no email/credentials in URL or storage record, nonce removed from address, refresh removes the claim;
- direct random nonce, malformed nonce, repeated nonce, and plain `/login`: no confirmation banner;
- immediate session: `/onboarding` and no confirmation banner;
- duplicate: inline alert, editable form, valid `/login` action if included, and no recovery link;
- fallback rate limit: 60-second guidance and repeated click/Enter/programmatic submit keep call count at one;
- short provider cooldown fixture: button enables automatically and a later valid submit makes exactly one new call;
- system error: distinct inline alert, overlay gone, form retry succeeds;
- focus returns to inline result after overlay settlement and reduced-motion presentation remains understandable.

Playwright runs both development and production Next.js configurations through the existing command. Timer tests use the short provider metadata fixture rather than waiting 60 seconds; the exact 60-second fallback is proven in unit tests and asserted at cooldown start in E2E.

### Validation commands

Run with Node.js `>=24.18 <25` (the recorded Node 22 preflight is unsupported):

```sh
pnpm test:web-auth
pnpm lint:web
pnpm build:web
pnpm test:web-e2e
```

No test is to be weakened to accommodate the frozen implementation. Production build/type checking is required because the login Server/Client Component boundary and DOM typings are compile-sensitive.

## Migration and reconciliation from the frozen diff

The frozen work is useful provider/validation scaffolding, but it is not accepted wholesale.

1. Preserve the existing local validation rules, adapter/use-case separation, immediate-session handoff, generic Sentry scrubbing, and deterministic auth-test approach.
2. First write failing contract tests, then extend `RegisterOutcome.rate_limited` with optional retry metadata and keep Supabase details redacted.
3. Add failing pure tests for the state reducer, cooldown, and nonce bridge before changing the form.
4. Replace the form's local string status transitions with the reducer. Remove the `confirmation_required` replacement panel and manual `Ir a iniciar sesión` step; no-session now creates the nonce bridge and redirects automatically.
5. Rework rate-limit handling from a static message with an enabled button to an absolute, persisted cooldown with a disabled submit control and handler-level guard.
6. Keep duplicate/system outcomes inline, add deliberate feedback focus, and ensure editing/retry rules follow the transition table. Do not introduce password recovery.
7. Delete `shared/components/processing-modal.tsx`, its import, native `<dialog>` lifecycle, `[open]`, and `::backdrop` CSS. Replace them with the auth-owned portal overlay and ordinary backdrop/dialog-role styles. Do not retain a shared wrapper or alias: there is only one distinct real feature consumer.
8. Add the login banner consumer and nonce parsing without adding signup confirmation to URL-only `getLoginContextMessage`.
9. Rewrite the frozen Playwright expectations that currently leave confirmation-required users on `/register`; add deterministic cooldown, replay-resistance, focus, and call-count coverage.
10. After all verification passes, sync the stable Spanish journey/functional/architecture statements that still describe signup as pending. Review the root README per project sync policy and update it only if a concise stable capability note is warranted.

This sequence avoids mixing speculative shared UI cleanup with provider behavior before tests define both contracts.

## Rollout, observability, and rollback

- Deliver as one PR within the 3,000-line review budget; the change is cohesive and needs no feature flag or data migration.
- Verify first against deterministic adapters, then perform a manual real-Supabase smoke test for immediate/no-session behavior as environment policy allows. Manually check at least one password-manager-enabled browser profile when practical; this is compatibility evidence, not an automated gate.
- Keep Sentry system-error reporting generic and monitor signup system-error/429 trends without PII. The nonce and countdown are not logged.
- Roll back registration redirect and login banner together. Rolling back only the banner would strand no-session users at `/login` without explanation. Adapter/cooldown changes can be reverted with the same commit set; there is no account or schema rollback.
- Accounts already created by Supabase are never undone, and closing the overlay never claims that an in-flight request was cancelled.

## Risks and mitigations

- **Supabase may obscure duplicates:** explicit provider success remains confirmation-required; no message/shape inference is added. Product copy must not claim stronger provider knowledge than returned.
- **Current SDK lacks retry headers:** optional metadata usually remains absent, so the deterministic 60-second fallback is the expected production path until a supported structured field exists.
- **Custom modal bugs:** portal isolation, saved/restored inert/scroll state, explicit focus trap, reduced-motion behavior, and Playwright checks cover the transferred native-dialog responsibilities.
- **Nonce bridge is client-side, not cryptographic proof of signup:** it prevents normal direct/refresh/stale replay and is sufficient for a non-authorizing message. It must never gate auth or expose sensitive state.
- **Hydration/timer races:** the submit handler checks persisted absolute deadline synchronously, and banner eligibility is consumed atomically before visibility.
- **Navigation failure:** synchronous failure removes the nonce and yields recoverable system feedback; registration redirect and banner roll back together if production navigation proves unreliable.
- **Review-size pressure:** no new framework, general notification system, server endpoint, proxy change, or password-recovery flow is included.
