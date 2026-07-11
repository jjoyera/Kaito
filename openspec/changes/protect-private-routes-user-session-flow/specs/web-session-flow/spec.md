# Web Session Flow Specification

## Purpose

Define explicit public/private route behavior and a safe, no-flash Supabase session flow for the first authenticated Kaito experience.

## Requirements

### Requirement: Explicit route classification and protection

The web app SHALL classify `/login` as public/auth-aware, `/onboarding` as private, and `/` as public and not an authenticated fallback. Private routes SHALL require a valid Supabase session before rendering private content.

#### Scenario: Unauthenticated private navigation

- GIVEN no valid session exists
- WHEN the user navigates to `/onboarding`
- THEN the app SHALL redirect to `/login` with the requested path and query as a safe return URL
- AND it SHALL not render onboarding content

#### Scenario: Authenticated private navigation

- GIVEN session resolution confirms a valid session
- WHEN the user navigates to `/onboarding`
- THEN the placeholder SHALL render

### Requirement: Minimal onboarding placeholder

The app SHALL provide `/onboarding` as a private, accessible placeholder that clearly identifies the onboarding area. It SHALL contain only simple product copy and SHALL NOT implement forms, workflow steps, persistence, completion state, domain logic, or onboarding APIs.

#### Scenario: Authenticated user views placeholder

- GIVEN a valid session
- WHEN `/onboarding` renders
- THEN the user SHALL see clear placeholder copy such as “Onboarding process”
- AND no onboarding workflow controls or domain state SHALL be presented

### Requirement: Deterministic session loading without flash

The app SHALL resolve session state before rendering session-dependent content. While state is unknown, it SHALL show a minimal accessible loading state or retain an equivalent non-private boundary, and SHALL never flash private content to an unauthenticated user.

#### Scenario: Session is still loading

- GIVEN session resolution has not completed
- WHEN a private route is requested
- THEN private content SHALL not be rendered
- AND an accessible loading state SHALL be available when an immediate redirect is not possible

### Requirement: Safe return URL validation

Return destinations SHALL be accepted only when they are local relative application paths, including optional query and fragment components. Absolute URLs, protocol-relative URLs, malformed values, and destinations outside the application SHALL be rejected; rejected values SHALL fall back to `/onboarding`.

#### Scenario: Malicious return URL is supplied

- GIVEN login receives an absolute or protocol-relative return URL
- WHEN the post-login destination is selected
- THEN the value SHALL be ignored
- AND navigation SHALL use `/onboarding`

### Requirement: Expired or invalid route session transition

When route session refresh or validation fails, the app SHALL treat the user as unauthenticated, invalidate stale local auth state as supported, and transition to `/login` with a validated return URL and bounded trusted context indicating that the session expired or is invalid. Ordinary unauthenticated visits SHALL not receive expiry messaging, and transitions SHALL not loop.

#### Scenario: Session expires on a private route

- GIVEN the user is on a private route and session validation fails
- WHEN the failure is detected
- THEN private content SHALL stop being treated as authorized
- AND the user SHALL reach `/login` with trusted context such as “Your session expired. Sign in again.”

### Requirement: Private API token attachment and recoverable 401

Private frontend API requests SHALL attach the current Supabase access token as a bearer credential. A private API `401` SHALL invalidate reliance on the failed identity/data, surface a clear recoverable authentication error and user action, and SHALL not unconditionally redirect or retry indefinitely. Backend-auth configuration `503` SHALL be presented as a system/configuration failure, not as invalid credentials.

#### Scenario: Private API request is authorized

- GIVEN a valid Supabase session and a private API request
- WHEN the request is sent
- THEN it SHALL include the current access token as a bearer credential
- AND the frontend SHALL not substitute a client-provided user ID as authority

#### Scenario: Private API rejects token

- GIVEN a private API responds with `401`
- WHEN the frontend handles the response
- THEN it SHALL show a recoverable sign-in or re-authentication action
- AND it SHALL not force an unconditional redirect or infinite retry loop

### Requirement: Backend authority boundary

FastAPI SHALL remain authoritative for private API authorization: it SHALL validate the Supabase access token before exposing canonical identity or user-owned data and SHALL derive identity from verified claims. Frontend route guards SHALL control navigation and disclosure only and SHALL never be treated as authorization.

#### Scenario: Request bypasses frontend guard

- GIVEN a request reaches a private FastAPI endpoint without a valid verified bearer token
- WHEN FastAPI processes it
- THEN it SHALL reject it according to the existing backend auth contract
- AND no client-supplied identity SHALL authorize access

### Requirement: Explicit first-slice non-goals

This change SHALL NOT introduce `/dashboard`, dashboard selection, real onboarding workflow, a redesigned landing page, roles/RBAC, or backend auth-semantic changes. `/` SHALL remain available for future public landing behavior, and existing public health and backend `401`/configuration `503` contracts SHALL remain unchanged.

#### Scenario: Scope review

- GIVEN the change is reviewed for delivered routes and behavior
- WHEN its outputs are compared with this specification
- THEN only the login/session flow and minimal private onboarding placeholder SHALL be present
- AND dashboard, landing, role, onboarding-domain, and backend-auth-contract work SHALL be absent

### Requirement: Session-flow acceptance coverage

Automated verification SHALL cover route classification, authenticated and unauthenticated navigation, loading/no-flash behavior, safe return URL rejection, login handoff, expired-session context, token attachment, recoverable API `401`, and backend authority assumptions.

#### Scenario: Acceptance suite exercises session states

- GIVEN controlled session and API outcomes
- WHEN the acceptance suite runs
- THEN it SHALL verify each listed state and SHALL prove no redirect or retry loop occurs
