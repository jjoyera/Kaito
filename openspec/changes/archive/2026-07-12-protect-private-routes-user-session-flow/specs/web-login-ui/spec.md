# Delta for Web Login UI

## MODIFIED Requirements

### Requirement: Authenticated handoff only after successful login

After a successful sign-in, the web app SHALL hand control to the authenticated flow by replacing the login history entry with a validated local return destination when present, or `/onboarding` otherwise. An already-authenticated visit to `/login` SHALL use the same destination rules.

- `/login` SHALL remain public and auth-aware.
- The app MUST NOT use `/` as the authenticated fallback.
- `/onboarding` MUST remain a protected placeholder fallback and MUST NOT be treated as evidence of onboarding completion or product-state routing.
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
