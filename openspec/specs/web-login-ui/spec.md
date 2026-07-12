# Web Login UI Specification

## Purpose

Define the first Kaito web login experience for existing users. The login page MUST allow registered runners to sign in with email and password, present clear validation and error states, and hand successful authentication to the authenticated app flow without deciding downstream onboarding or dashboard routing.

## Requirements

### Requirement: Dedicated existing-user login page

The system SHALL provide a dedicated web login page for existing Kaito users.

- The page MUST present Kaito as a calm, premium endurance-coaching product.
- The page MUST make email/password sign-in the primary action.
- The page MUST NOT include signup, password reset, magic-link, social-auth, or demo-user entry points in this change.
- The page MUST include brief support or context copy only; it MUST NOT become a marketing-heavy landing page.

#### Scenario: Existing runner opens the login page

- GIVEN an unauthenticated existing Kaito user
- WHEN the user opens the login page
- THEN the page SHALL display a Kaito-branded email/password login form
- AND the page SHALL include brief context or support copy appropriate for endurance coaching
- AND the page SHALL NOT display signup, password reset, magic-link, social-auth, or demo-user calls to action

### Requirement: Email and password form inputs

The login form SHALL collect the user's email address and password using accessible form controls.

- The email and password fields MUST be visible, labeled, and keyboard reachable.
- The email field MUST identify itself as an email input.
- The password field MUST obscure entered password text by default.
- The form MUST expose validation and submission feedback in a way that can be understood by assistive technologies.

#### Scenario: User navigates the form by keyboard

- GIVEN the login page is displayed
- WHEN the user navigates through the form using the keyboard
- THEN focus SHALL reach the email field, password field, and submit action in a logical order
- AND each control SHALL have an accessible name matching its purpose

### Requirement: Local required-field and email-format validation

The login form MUST validate required fields and basic email format locally before attempting authentication.

- Email MUST be required.
- Password MUST be required.
- Email MUST be checked for a basic valid email shape before submission.
- Local validation errors MUST be specific to the affected field and MUST be shown without calling the authentication service.
- Local validation MUST preserve the user's entered email value so it can be corrected.

#### Scenario: Required fields are missing

- GIVEN the login page is displayed
- WHEN the user submits the form with an empty email or password field
- THEN the system SHALL show field-level required validation feedback
- AND it SHALL NOT attempt authentication

#### Scenario: Email format is invalid

- GIVEN the user has entered a non-email value in the email field
- AND the password field is populated
- WHEN the user submits the form
- THEN the system SHALL show email-format validation feedback
- AND it SHALL NOT attempt authentication

### Requirement: Submission loading state prevents duplicate attempts

The login form SHALL provide a clear submission state while authentication is in progress and MUST prevent duplicate sign-in attempts.

- While a sign-in attempt is pending, the submit action MUST be disabled or otherwise guarded against repeated activation.
- While a sign-in attempt is pending, the UI MUST communicate that login is in progress.
- The form MUST return to an interactive state after an authentication failure or technical failure.

#### Scenario: User submits valid credentials once

- GIVEN the user has entered locally valid email and password values
- WHEN the user submits the form
- THEN the system SHALL start a single sign-in attempt
- AND the UI SHALL show a loading or submitting state
- AND repeated submit activation during that pending attempt SHALL NOT start additional sign-in attempts

#### Scenario: Failed submission restores interaction

- GIVEN a sign-in attempt is pending
- WHEN the attempt fails with either an authentication failure or technical failure
- THEN the form SHALL leave the loading state
- AND the user SHALL be able to edit fields and submit again

### Requirement: Generic invalid-credentials feedback

When authentication completes but the credentials are not accepted, the login page MUST show a generic invalid-credentials message.

- The message MUST NOT reveal whether the email exists, whether the password was wrong, or provider-specific failure details.
- The message SHOULD guide the user to check their email and password.
- Invalid-credential feedback MUST be visually and semantically distinct from field-level local validation.

#### Scenario: Authentication rejects credentials

- GIVEN the user has entered locally valid email and password values
- WHEN authentication completes and reports that the credentials are invalid
- THEN the page SHALL show a generic invalid-credentials message
- AND the message SHALL NOT reveal whether the email address exists or which credential was incorrect

### Requirement: Separate technical or system error feedback

When authentication cannot complete for non-user reasons, the login page MUST show a technical or system error state distinct from invalid-credentials feedback.

- Network failures, unavailable auth service, missing client configuration, unexpected provider errors, and equivalent non-user failures MUST NOT be presented as invalid credentials.
- The technical/system error message MUST be understandable to a user without exposing secrets, stack traces, provider internals, or raw error payloads.
- The UI SHOULD advise the user to retry later or contact support when appropriate.

#### Scenario: Authentication service cannot be reached

- GIVEN the user has entered locally valid email and password values
- WHEN the sign-in attempt cannot complete because of a network, service, configuration, or unexpected system failure
- THEN the page SHALL show a technical/system error message
- AND it SHALL NOT show the generic invalid-credentials message as the primary explanation
- AND it SHALL NOT expose secrets, stack traces, provider internals, or raw error payloads

### Requirement: Authenticated handoff only after successful login

After a successful sign-in, the web app SHALL hand control to the authenticated flow by replacing the login history entry with a validated local return destination when present, or `/onboarding` otherwise. An already-authenticated visit to `/login` SHALL use the same destination rules.

- `/login` SHALL remain public and auth-aware.
- The app MUST NOT use `/` as the authenticated fallback.
- The app MUST NOT infer onboarding completion, select `/dashboard`, or implement dashboard routing.
- The handoff MUST preserve the authenticated Supabase session.

(Previously: Successful login handed control to an authenticated-flow boundary without deciding whether the next destination was onboarding or dashboard.)

#### Scenario: Login succeeds without a valid return URL

- GIVEN an unauthenticated user submits valid credentials
- WHEN Supabase establishes a valid session
- THEN the app SHALL replace the login entry with `/onboarding`
- AND `/onboarding` SHALL be protected by the private-route session flow

#### Scenario: Login succeeds with a valid return URL

- GIVEN an unauthenticated user arrived with a valid local return destination
- WHEN Supabase establishes a valid session
- THEN the app SHALL replace the login entry with that destination
- AND it SHALL NOT redirect to an external or malformed destination

#### Scenario: Already-authenticated user opens login

- GIVEN session resolution confirms a valid authenticated session
- WHEN the user opens `/login`
- THEN the app SHALL replace the login entry with a valid local return destination when present
- AND otherwise SHALL replace it with `/onboarding`

### Requirement: Kaito-aligned visual treatment and restrained motion

The login page SHALL use Kaito's warm outdoor brand direction and MAY use subtle background depth or restrained motion when it supports clarity and trust.

- The visual treatment MUST align with the documented Kaito brand: warm sand or off-white surfaces, forest-green primary identity, restrained orange/golden accents, mountain/outdoor calm, and premium coaching clarity.
- The page MUST avoid generic blue SaaS styling, medical styling, aggressive gym branding, and futuristic AI clichés.
- Background composition and animation MUST remain secondary to form readability and user trust.
- Motion, if present, MUST be subtle, slow, non-blocking, and compatible with reduced-motion preferences.
- The page MUST remain clear and usable when motion is reduced or disabled.

#### Scenario: Brand review of the login screen

- GIVEN the login page is reviewed against Kaito's product vision and brand palette
- WHEN the screen is evaluated for tone and readability
- THEN it SHALL feel like a calm digital mountain coach for endurance runners
- AND the login form SHALL remain the primary readable focus
- AND any background or motion treatment SHALL NOT dominate the experience

#### Scenario: Motion is reduced

- GIVEN the user's environment requests reduced motion or motion is otherwise unavailable
- WHEN the login page is displayed
- THEN essential content and actions SHALL remain available and readable
- AND no required login behavior SHALL depend on animation

### Requirement: Login UI verification coverage

The change SHALL include automated verification for the login UI behaviors that are practical within the web test setup.

- Verification MUST cover local required-field validation, email-format validation, loading duplicate-submit prevention, invalid-credentials feedback, technical/system error feedback, and successful authenticated-flow handoff behavior.
- Verification SHOULD include accessibility-relevant assertions for labels, focusable controls, and feedback exposure.
- Verification MUST NOT require backend auth contract changes or real end-to-end domain authentication beyond the frontend boundary needed for this UI slice.

#### Scenario: Login UI tests exercise states

- GIVEN the login UI verification suite runs in the web validation environment
- WHEN mocked or controlled auth outcomes are exercised
- THEN the suite SHALL prove local validation blocks submission
- AND it SHALL prove duplicate submissions are prevented while pending
- AND it SHALL distinguish invalid credentials from technical/system failures
- AND it SHALL prove successful login reaches the authenticated-flow handoff boundary
