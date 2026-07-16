# Proposal: Refine signup UX flow

## Status

**Approved — option 1 selected.** The user approved the recommended first-slice boundary: real password recovery is deferred to a later change, and this change MUST NOT ship a fake or dead recovery action. Specification and design may proceed; application implementation remains blocked by the later SDD approvals.

## Intent

Redesign Kaito's registration flow before further implementation so users receive a clear, accessible, and state-appropriate outcome from a real Supabase signup attempt. The change should remove the current ambiguous confirmation state on `/register`, prevent avoidable repeated requests during rate limiting, and present processing feedback without relying on native `<dialog>` behavior that may conflict with password managers such as Bitwarden.

## Problem and current-state gap

The frozen registration implementation already distinguishes local validation, immediate authentication, email confirmation, duplicate accounts, rate limits, and system failures. However, the resulting UX is not yet coherent enough to continue implementation:

- A successful signup without an immediate session leaves the user on `/register` and requires a manual transition, even though the next meaningful action is to confirm email and later sign in.
- The duplicate-account message identifies the problem but does not provide the desired password-recovery action.
- A rate-limited user receives guidance but can immediately submit again, risking additional HTTP 429 responses.
- Processing uses a shared native `<dialog>`, which introduces avoidable browser/password-manager interaction risk.
- Login does not yet have an agreed mechanism for displaying the post-registration confirmation message.
- No real password-recovery route or flow was found in the inspected web application, so presenting a recovery link without resolving that dependency would create a dead or misleading action.

These gaps affect new users at a high-friction moment where uncertainty can cause repeated signup attempts, support questions, or account-access confusion.

## Product outcome

After this change:

1. Invalid local input remains on `/register`, shows field-level feedback, and causes neither a network request nor the processing overlay.
2. A valid submission displays a reusable custom accessible processing overlay for exactly the active Supabase request. The overlay is modal in behavior and exposed with dialog semantics, but is not implemented with native `<dialog>`.
3. A successful signup that returns an immediate session continues automatically to `/onboarding`.
4. A signup result that returns no session redirects automatically to `/login`, where a visible, accessible banner/message uses the approved neutral guidance: `Si los datos son correctos, recibirás un correo para confirmar tu cuenta. Si ya tienes una cuenta, inicia sesión.` It does not claim that an email was definitely sent, because Supabase may obscure an existing account behind the same no-session result.
5. A duplicate-account outcome remains on the registration form with an inline explanation. Password recovery is the desired action, subject to the explicit dependency decision below; no placeholder or dead recovery link may be shipped.
6. A rate-limit outcome remains on the registration form with an inline explanation and temporarily disables further registration attempts to avoid generating additional 429 responses.
7. Unexpected provider or network failures remain distinguishable from duplicate-account and rate-limit outcomes and leave the user able to recover safely.

## Scope

### In scope

- Define the registration state transitions for local validation, active submission, immediate session, confirmation required, duplicate account, rate limit, and unexpected failure.
- Redirect confirmation-required signup results to `/login` and carry enough non-sensitive state for the login page to display a confirmation-email banner/message.
- Add the login-side presentation needed for that post-signup message, including accessible announcement behavior and safe handling of direct or malformed navigation state.
- Keep duplicate-account and rate-limit feedback inline on `/register`.
- Add a temporary retry lock after a rate-limit response. The specification/design must define its user-visible behavior and determine a deterministic duration, using trustworthy provider retry metadata if available and a documented fallback otherwise.
- Replace native `<dialog>` processing behavior with a reusable custom accessible overlay using dialog semantics, appropriate labelling, focus handling, background interaction blocking, and non-dismissible behavior while the request is active.
- Preserve client-side validation and the existing immediate-session handoff to `/onboarding`.
- Update relevant unit/contract and Playwright coverage during the later apply phase under strict TDD.
- Reconcile stable product documentation with the approved behavior during sync if implementation is completed and verified.

### Explicit password-recovery dependency and approval decision

A real password-recovery capability was not found in the current web application. The preferred duplicate-account action is password recovery, but a fake, disabled-looking, or dead link is not acceptable.

**Recommended first-slice boundary:** keep implementation of password recovery outside this signup UX change. The duplicate-account state should remain inline and may offer a valid existing action such as returning to login, while clearly identifying password recovery as a separately tracked dependency. Once a real recovery flow is approved and available, the inline state can link to it.

**Approved boundary:** the user selected this recommended option. Real password recovery is deferred to a later change; this change may mention that future availability or offer an appropriate existing login action, but it must not include a recovery route or dead recovery CTA.

The alternatives considered were:

- defer the real recovery CTA to a follow-up change; or
- expand this change to include an end-to-end password-recovery flow, which would require additional product rules, security considerations, routes, provider integration, and acceptance criteria.

The first alternative is approved. The specification must not invent a recovery destination.

### Out of scope

- Editing the currently frozen application implementation during this proposal phase.
- Changing signup credentials, password-strength rules, or local field-validation rules.
- Changing Supabase authentication policy, email templates, confirmation-token behavior, or provider-side rate limits.
- Changing login credential validation or general authenticated routing beyond the post-signup confirmation message.
- Changing onboarding behavior or destination for immediately authenticated signups.
- Building a general notification/toast framework solely for this banner.
- Broad redesign of auth-page visual styling unrelated to these registration states.
- Silently adding a password-recovery route without the explicit scope approval described above.

## Affected areas

- Registration form interaction and state management under `apps/web/features/auth/`.
- Supabase signup outcome normalization and any retry metadata passed through auth boundaries.
- Authenticated handoff to `/onboarding` for immediate sessions.
- `/login` navigation-state handling and confirmation banner/message presentation.
- The processing overlay component and its ownership. Reuse must follow the project rule that promotion to `shared/` requires two distinct real feature consumers; if registration is its only real consumer, design should keep ownership within auth rather than preserving a speculative shared abstraction.
- Registration unit/contract tests and Playwright journeys.
- Product journey/functional-requirement documentation if the implemented behavior changes their current-state statements.

No database schema, API service, or onboarding data changes are expected.

## Business and UX rules

- The provider result, not optimistic client state, determines whether registration succeeded.
- No-session success and immediate-session success are separate valid outcomes.
- Confirmation-required users must not be shown as authenticated and must not be sent to onboarding.
- The post-signup login message must not expose the submitted email or other sensitive data in the URL or client-visible navigation state.
- Duplicate-account and rate-limit outcomes must preserve the form context and remain understandable without relying on color alone.
- The retry lock must block all equivalent submission paths while active, communicate why submission is unavailable, and restore the ability to retry without requiring a page reload once the cooldown expires.
- Local validation failures must never open the overlay or call Supabase.
- While a valid request is pending, duplicate submission must be prevented and the overlay must not be dismissible in a way that implies cancellation when the request continues.
- The custom overlay must provide accessible dialog naming/description and deliberate focus/background behavior; native `<dialog>` is prohibited for this interaction.
- Refreshing or directly visiting `/login` must not show post-signup guidance unless valid post-signup navigation context is present; even with valid context, the guidance must remain neutral and must not claim that an email was definitely sent.

## Risks and mitigations

- **Misleading recovery action:** A CTA without a working recovery flow would strand users. Mitigation: enforce the explicit dependency boundary and prohibit placeholder links.
- **Banner spoofing or stale messages:** URL-controlled context could show an inaccurate success message. Mitigation: design a constrained, non-sensitive, allow-listed navigation signal and define refresh/direct-navigation behavior.
- **Accessibility regression in a custom modal:** Replacing native dialog behavior transfers focus and interaction responsibilities to application code. Mitigation: specify keyboard, focus, labelling, announcement, scroll, and background-inert behavior and verify it in tests.
- **Over-abstraction:** Keeping a generic shared overlay without two real feature consumers would violate project conventions. Mitigation: decide ownership from demonstrated consumers during design.
- **Retry lock too short or too long:** A poor fallback can either generate more 429s or unnecessarily block users. Mitigation: prefer reliable provider retry metadata, define a bounded fallback, display the remaining wait, and test expiry.
- **Navigation race:** Closing the overlay and redirecting can create transient or stale UI. Mitigation: model outcomes as explicit transitions and test both delayed and immediate responses.
- **Password-manager compatibility remains environment-dependent:** A custom overlay reduces native-dialog conflict risk but cannot guarantee all extension behavior. Mitigation: avoid native `<dialog>`, preserve form semantics, and include targeted manual compatibility verification where practical.

## Rollback

If the refined flow causes regressions after implementation, revert the registration/login UX commit set to restore the prior behavior: confirmation-required users remain on `/register`, existing inline errors remain, and the prior processing presentation returns. No data migration or database rollback is expected.

Rollback must not alter Supabase accounts already created or imply that a submitted request was cancelled. If only the login banner fails, the redirect behavior and banner can be rolled back together to avoid sending users to `/login` without explanatory feedback.

## Success criteria

The change is successful when all of the following are demonstrated:

- Invalid local input produces accessible field feedback with zero signup calls and no processing overlay.
- A valid real signup request shows one custom, non-native accessible modal overlay until the request resolves and prevents duplicate submission.
- Immediate-session success navigates to `/onboarding` with existing authenticated handoff behavior preserved.
- A no-session result automatically navigates to `/login` and displays the exact approved accessible neutral guidance without exposing the email in navigation state or claiming that a confirmation email was definitely sent.
- Duplicate-account feedback remains inline on `/register`, and no fake recovery link exists; the approved password-recovery scope decision is reflected in the specification and implementation.
- Rate-limit feedback remains inline, blocks retries during the defined cooldown, prevents additional signup calls during that period, and re-enables retry when the cooldown ends.
- Unexpected failures remain recoverable and do not leave the overlay or submit lock stuck.
- Unit/contract and E2E tests cover the state transitions and accessibility-critical behavior under strict TDD.
- No application code is changed before proposal, specification/design, and tasks receive the required approvals.

## Proposal question round

The orchestrator supplied user-approved answers covering the success transitions, inline error placement, rate-limit behavior, loading interaction, immediate-session routing, and local-validation boundary. Those answers are treated as the completed first proposal question round.

Resulting assumptions are:

- The first slice prioritizes a coherent signup outcome rather than a broad auth redesign.
- `/login` owns the post-signup confirmation message after automatic redirection.
- The rate-limit cooldown's exact source and duration are specification/design decisions, but temporary blocking is mandatory.
- A custom overlay means custom DOM/CSS/React behavior with accessible dialog semantics, not native `<dialog>`.
- The password-recovery scope choice is resolved: real recovery is a separate follow-up, and no recovery route or CTA is included in this change.

The user approved these assumptions and selected the recommended password-recovery boundary.

## Approval boundary and next step

Approval was granted with the recommended password-recovery boundary. Proceed to the signup registration UX specification and design; do not begin tasks or application implementation yet.
