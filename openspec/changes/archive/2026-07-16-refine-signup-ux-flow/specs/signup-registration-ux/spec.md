# Signup Registration UX Specification

## Purpose

Define the accessible and state-appropriate outcomes of registration, including validation, active processing, authenticated handoff, email-confirmation handoff, duplicate accounts, rate limits, and unexpected failures.

## Requirements

### Requirement: Local validation prevents submission

The registration flow MUST keep users on `/register` when local validation fails, MUST show field-level feedback for each invalid field, MUST make zero signup calls, and MUST NOT show the processing overlay.

#### Scenario: Invalid registration input

- GIVEN the user is on `/register` with one or more locally invalid fields
- WHEN the user attempts to submit the form
- THEN the user remains on `/register`
- AND each invalid field has accessible field-level feedback
- AND no Supabase signup call is made
- AND no processing overlay is shown

### Requirement: Active signup processing is accessible and request-bound

For a locally valid submission, the registration flow MUST show a reusable custom processing overlay only while the corresponding Supabase signup request is active. The overlay MUST NOT use a native `<dialog>` element. It MUST expose modal dialog semantics, an accessible name and description, deliberate focus placement and containment, and blocked background interaction. It MUST prevent every equivalent duplicate-submission path and MUST NOT be dismissible while the request remains active.

When the request settles, the overlay MUST close. If the user remains on `/register`, focus MUST move to the resulting feedback or an appropriate registration control.

#### Scenario: Valid request is pending

- GIVEN the registration fields pass local validation
- WHEN the Supabase signup request is active
- THEN one custom non-native processing overlay is visible
- AND the overlay is programmatically identified as a named and described modal dialog
- AND focus is placed and contained within the overlay
- AND background interaction and duplicate submission are blocked

#### Scenario: User attempts to dismiss active processing

- GIVEN a valid Supabase signup request is still active
- WHEN the user presses Escape, activates the backdrop, or repeats a submission action
- THEN the processing overlay remains present
- AND no additional signup call is made
- AND the active request continues to determine the outcome

#### Scenario: Signup request settles

- GIVEN the processing overlay is visible for an active signup request
- WHEN that request succeeds or fails
- THEN the overlay is no longer shown for that request
- AND the flow presents or navigates to the corresponding outcome

### Requirement: Immediate-session signup continues to onboarding

When Supabase reports signup success with an immediate authenticated session, the system MUST navigate automatically to `/onboarding` using the authenticated handoff. It MUST NOT present the confirmation-required login message for that outcome.

#### Scenario: Signup returns an immediate session

- GIVEN a locally valid signup request is active
- WHEN Supabase returns success with an authenticated session
- THEN the processing overlay closes as the request settles
- AND the user is navigated automatically to `/onboarding`
- AND no confirmation-email banner is presented

### Requirement: No-session signup continues to login with confirmation guidance

When Supabase returns a no-session signup result, the system MUST navigate automatically to `/login` and MUST show this exact visible, accessible neutral message: `Si los datos son correctos, recibirás un correo para confirmar tu cuenta. Si ya tienes una cuenta, inicia sesión.` The message MUST NOT claim that a confirmation email was definitely sent, because the provider MAY obscure a duplicate account behind the same no-session result. The transition MUST NOT expose the submitted email or other sensitive registration data in the URL or client-visible navigation state.

The neutral message MUST appear only for a valid, immediate post-signup transition. A direct visit, refresh, or malformed or unrecognized transition to `/login` MUST NOT show the post-signup message.

#### Scenario: Signup returns no session

- GIVEN a locally valid signup request is active
- WHEN Supabase returns a no-session result, including provider-obscured duplicate behavior
- THEN the processing overlay closes as the request settles
- AND the user is navigated automatically to `/login`
- AND the exact approved neutral message is exposed to assistive technology
- AND the message does not claim that an email was definitely sent
- AND neither the URL nor client-visible navigation state contains the submitted email or other sensitive registration data

#### Scenario: Login is visited without valid post-signup context

- GIVEN no valid immediate post-signup transition is present
- WHEN the user visits or refreshes `/login`, or arrives with malformed or unrecognized transition data
- THEN the login page does not show the post-signup message
- AND the ordinary login experience remains available

### Requirement: Duplicate-account feedback remains inline and actionable without a dead recovery path

When Supabase reports that an account already exists for the submitted email, the system MUST keep the user on `/register` and MUST show clear, accessible inline feedback identifying the duplicate-account outcome without relying on color alone. The flow MUST allow the user to revise the form and try again.

This change MUST NOT present a password-recovery link, route, or other recovery call to action. It MAY provide a valid action to the existing login experience and MAY explain that password recovery will be available separately, but MUST NOT present a fake, disabled, or dead recovery action.

#### Scenario: Submitted email already has an account

- GIVEN a locally valid signup request is active
- WHEN Supabase reports a duplicate-account outcome
- THEN the processing overlay closes as the request settles
- AND the user remains on `/register`
- AND accessible inline feedback clearly states that an account already exists for that email
- AND the form can be revised and submitted again
- AND no password-recovery call to action is presented

### Requirement: Rate limiting temporarily blocks retries

When Supabase rate-limits a signup request, the system MUST keep the user on `/register`, MUST show accessible inline wait guidance that does not rely on color alone, and MUST block all equivalent registration submission paths for the active cooldown. The cooldown MUST use trustworthy positive provider retry metadata when available and MUST otherwise last 60 seconds from receipt of the rate-limit outcome.

The guidance MUST communicate the remaining wait or when retry becomes available. Attempts made during the cooldown MUST make zero additional signup calls. When the cooldown expires, the system MUST re-enable submission automatically without requiring a page reload.

#### Scenario: Rate limit includes trustworthy retry metadata

- GIVEN a locally valid signup request is active
- WHEN Supabase returns a rate-limit outcome with trustworthy positive retry metadata
- THEN the processing overlay closes as the request settles
- AND the user remains on `/register`
- AND inline guidance communicates the provider-derived wait
- AND every submission path remains blocked for that cooldown

#### Scenario: Rate limit has no trustworthy retry metadata

- GIVEN a locally valid signup request is active
- WHEN Supabase returns a rate-limit outcome without trustworthy positive retry metadata
- THEN the processing overlay closes as the request settles
- AND the user remains on `/register`
- AND inline guidance communicates a 60-second fallback wait
- AND every submission path remains blocked for 60 seconds

#### Scenario: Submission is attempted during cooldown

- GIVEN a rate-limit cooldown is active
- WHEN the user attempts to submit registration through any equivalent path
- THEN no signup call is made
- AND the wait guidance remains available

#### Scenario: Cooldown expires

- GIVEN a rate-limit cooldown is active
- WHEN its communicated wait expires
- THEN registration submission is re-enabled automatically
- AND the user can make a new valid signup attempt without reloading the page

### Requirement: Unexpected failures remain recoverable

When a signup request ends in an unexpected provider, network, or system failure, the system MUST keep the user on `/register`, MUST distinguish the outcome from duplicate-account and rate-limit feedback, and MUST present accessible inline guidance that allows another valid attempt. The processing state and any request-only submission lock MUST clear when the failed request settles.

#### Scenario: Signup fails unexpectedly

- GIVEN a locally valid signup request is active
- WHEN the request ends with an unexpected provider, network, or system failure
- THEN the processing overlay closes as the request settles
- AND the user remains on `/register`
- AND accessible inline feedback distinguishes the unexpected failure from duplicate-account and rate-limit outcomes
- AND the registration form permits another valid attempt without a page reload
