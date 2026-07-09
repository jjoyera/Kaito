# Backend Auth Specification

## Purpose

Establish the first backend authentication boundary for Kaito. This slice defines
a small, provider-agnostic token-verification boundary that converts a valid
external auth token into a Kaito-owned canonical `UserContext`, rejects missing or
invalid auth before domain logic runs, and proves the flow through a protected
`GET /auth/me` endpoint.

Supabase Auth is the first concrete verification adapter, but the architecture MUST
remain provider-agnostic: Kaito domain-facing code depends on Kaito auth concepts
(`UserContext` and an `AuthVerifier`-style boundary), never on Supabase claim
names, SDK types, or verification internals. Token verification MUST use Supabase
JWT Signing Keys via the project JWKS endpoint (asymmetric verification); the
legacy symmetric secret (`SUPABASE_JWT_SECRET`, HS256) MUST NOT be used. The
boundary MUST preserve a clean path to future provider/strategy changes.

This spec defines WHAT must be true after the change. It is normative for the first
backend auth slice and is intended to be directly implementable and verifiable by
downstream tasks.

## Scope boundary

- In scope: a provider-agnostic backend auth verifier boundary; a canonical
  `UserContext` with required `user_id` and optional `email`; a Supabase adapter as
  the first implementation isolated from domain modules; JWKS asymmetric
  signing-key verification via the Supabase project JWKS endpoint; a protected `GET /auth/me`
  identity-only endpoint; a minimal consistent `401` response contract; backend
  startup tolerance when auth config is missing while protected routes fail clearly;
  backend developer documentation and example environment configuration; and tests
  for the verifier, dependency, endpoint, missing-config behavior, and provider
  isolation.
- Out of scope (MUST NOT be introduced by this change): signup, login, logout,
  password recovery, OAuth provider UX, or any frontend session handling; user
  registration persistence, profile creation, onboarding state, or any
  product/domain state in `/auth/me`; RBAC, roles, permissions, or authorization
  policy; a full API-wide error framework beyond the minimal unauthorized contract;
  and multi-provider runtime support beyond preserving the architectural boundary.

## Requirements

### Requirement: Provider-agnostic auth verification boundary

The system SHALL expose a small provider-agnostic auth verification boundary
(`AuthVerifier`-style) that accepts a bearer token and returns a canonical
`UserContext` on success or signals an authentication failure otherwise. The
boundary MUST be defined in terms of Kaito-owned concepts only and MUST NOT expose
provider-specific types, claim names, or verification details to callers.

- The boundary interface SHALL define, at minimum, an operation that maps a raw
  bearer token string to a canonical `UserContext` or an authentication failure.
- Domain-facing code (route handlers, dependencies, and future domain modules)
  SHALL depend only on the boundary abstraction and `UserContext`, never on a
  concrete provider adapter.
- The concrete verification adapter SHALL be selected/wired at the infrastructure
  layer, so the verification strategy can change (e.g. Supabase JWKS → another
  provider or OIDC flavor) without changing domain-facing contracts.

#### Scenario: Domain code depends only on the canonical boundary

- GIVEN a route or dependency that requires an authenticated user
- WHEN it obtains the authenticated identity
- THEN it SHALL do so through the `AuthVerifier`-style boundary returning a
  `UserContext`
- AND it SHALL NOT reference Supabase types, Supabase claim names, or verification
  internals

### Requirement: Canonical UserContext identity model

The system SHALL define a canonical `UserContext` owned by Kaito that carries the
verified identity available to protected routes and future domain modules. For this
slice, `UserContext` SHALL contain a required `user_id` and an optional `email`
only.

- `UserContext.user_id` MUST be present and non-empty for any successfully
  authenticated request; a verification result that cannot yield a `user_id` MUST be
  treated as an authentication failure.
- `UserContext.email` MUST be optional; its absence MUST NOT, by itself, cause
  authentication to fail.
- `UserContext` MUST NOT include product/domain state, profile data, roles, or
  onboarding state in this slice.

#### Scenario: user_id is required for authentication

- GIVEN a token whose verification succeeds and yields a canonical `user_id`
- WHEN the verifier builds a `UserContext`
- THEN `UserContext.user_id` SHALL be populated and non-empty

#### Scenario: Missing derivable user_id is an authentication failure

- GIVEN a token whose verification succeeds cryptographically but does not yield a
  canonical `user_id`
- WHEN the verifier attempts to build a `UserContext`
- THEN the request SHALL be treated as an authentication failure and rejected with
  the minimal `401` contract

### Requirement: Valid token without email is accepted

The system SHALL treat a request as authenticated when token verification succeeds
and a canonical `user_id` can be derived, even when no `email` claim is present.

- When a verified token contains a `user_id` but no email, `UserContext.email` MUST
  be left unset/`null` and the request MUST be accepted.

#### Scenario: Authenticated identity without email

- GIVEN a valid bearer token that resolves to a `user_id` but carries no email
  claim
- WHEN the token is verified
- THEN a `UserContext` SHALL be produced with the `user_id` populated and `email`
  absent/`null`
- AND the protected request SHALL be accepted

### Requirement: Supabase adapter as first isolated implementation

The system SHALL implement Supabase-backed token verification as the first concrete
adapter behind the auth boundary. The adapter SHALL be isolated in the
infrastructure/adapter layer and SHALL be the only place that knows Supabase
verification details and claim mapping.

- The adapter SHALL verify the bearer token and map provider claims to the canonical
  `UserContext` (e.g., mapping the provider subject claim to `user_id` and an email
  claim to `email` when present).
- Supabase-specific claim names, SDK types, and verification configuration MUST NOT
  leak beyond the adapter into domain-facing code.
- Replacing or adding another provider adapter MUST be possible without modifying
  the boundary interface, `UserContext`, or protected route handlers.

#### Scenario: Provider claim mapping is confined to the adapter

- GIVEN the Supabase adapter verifies a token
- WHEN it maps the verified token to a `UserContext`
- THEN all Supabase claim-name and SDK-type handling SHALL occur inside the adapter
- AND callers SHALL receive only the canonical `UserContext`

### Requirement: JWKS asymmetric signing-key verification

The system SHALL verify Supabase access tokens using Supabase JWT Signing Keys
via the project JWKS endpoint (asymmetric verification), driven by
environment-based configuration. Legacy symmetric-secret verification
(`SUPABASE_JWT_SECRET`, HS256) SHALL NOT be used.

- Verification configuration SHALL be sourced from environment/settings, using
  explicit `SUPABASE_JWKS_URL` from Supabase onboarding as the JWKS endpoint.
  `SUPABASE_URL` MAY be configured for context but SHALL NOT be required to derive
  the JWKS URL.
- The adapter SHALL fetch the JWKS, select the signing key whose `kid` matches the
  token header `kid`, and verify the token signature using the key's asymmetric
  algorithm.
- The verification implementation SHALL validate token expiry (and audience when
  configured) before producing a `UserContext`.
- The JWKS SHALL be cacheable so verification does not fetch keys on every request,
  with cache refresh and key rotation handled inside the adapter.
- The adapter/boundary structure SHALL allow swapping the verification strategy or
  provider without changing the boundary interface, `UserContext`, or protected
  route handlers.

#### Scenario: Verification uses Supabase JWKS signing keys

- GIVEN `SUPABASE_JWKS_URL` is configured and the project JWKS endpoint is reachable
- WHEN a bearer token signed by a current Supabase signing key and within its
  validity window is verified
- THEN the adapter SHALL select the key by `kid`, verify the signature, and yield a
  `UserContext`

#### Scenario: Unknown or unmatched signing key is rejected

- GIVEN a token whose `kid` does not match any key in the fetched JWKS
- WHEN the token is verified
- THEN the request SHALL be treated as an authentication failure and rejected with
  the minimal `401` contract

#### Scenario: Future verification strategy is not precluded

- GIVEN the verification strategy or provider is later changed
- WHEN the new strategy is wired at the infrastructure layer
- THEN the boundary interface, `UserContext`, and protected route handlers SHALL
  remain unchanged

### Requirement: Protected GET /auth/me returns canonical identity only

The system SHALL expose a protected `GET /auth/me` endpoint that requires
authentication and returns only canonical auth identity data derived from the
`UserContext`.

- The endpoint SHALL require a valid bearer token verified through the auth
  boundary; unauthenticated requests SHALL be rejected with the minimal `401`
  contract.
- On success, the response SHALL contain the canonical `user_id` and, when present,
  the `email`; when no email is available, the response SHALL represent `email` as
  absent/`null`.
- The response MUST NOT include provider-specific fields, raw token claims,
  profile/product/domain state, roles, or onboarding data.

#### Scenario: Authenticated request returns identity payload

- GIVEN a valid bearer token that resolves to a `UserContext`
- WHEN `GET /auth/me` is called with that token
- THEN the response status SHALL be `200`
- AND the body SHALL contain the canonical `user_id`
- AND the body SHALL contain `email` when present or `null`/absent when not
- AND the body SHALL NOT contain provider-specific fields, raw claims, or domain
  state

### Requirement: Reject missing, invalid, or malformed bearer tokens

The system SHALL reject protected requests that do not present a valid bearer token,
before any domain logic runs.

- A request with no `Authorization` header, or an `Authorization` header that is not
  a well-formed `Bearer <token>` value, SHALL be rejected as unauthenticated.
- A request whose token fails verification (bad signature, expired, malformed JWT,
  or otherwise invalid) SHALL be rejected as unauthenticated.
- Rejection SHALL occur at the auth boundary/dependency layer before the protected
  handler body executes.
- The system SHALL NOT disclose provider internals, secret material, or detailed
  verification-failure reasons in the rejection response.

#### Scenario: Missing Authorization header is rejected

- GIVEN a request to a protected route with no `Authorization` header
- WHEN the request is processed
- THEN it SHALL be rejected with the minimal `401` contract
- AND the protected handler body SHALL NOT execute

#### Scenario: Malformed bearer value is rejected

- GIVEN a request whose `Authorization` header is not a well-formed
  `Bearer <token>` value
- WHEN the request is processed
- THEN it SHALL be rejected with the minimal `401` contract

#### Scenario: Invalid or expired token is rejected

- GIVEN a request with a `Bearer` token that fails verification (bad signature,
  expired, or malformed)
- WHEN the token is verified
- THEN the request SHALL be rejected with the minimal `401` contract
- AND the response SHALL NOT disclose provider internals or secret material

### Requirement: Minimal consistent 401 response contract

The system SHALL return a minimal, consistent unauthorized response for protected
routes in this slice, without introducing a full API-wide error framework.

- All unauthorized rejections on protected routes SHALL use HTTP status `401`.
- The `401` responses SHALL use the exact JSON body `{ "detail": "Not authenticated" }` across all unauthorized cases in this slice.
- The `401` body MUST NOT include additional fields, stack traces, secret material,
  token contents, provider-specific verification internals, or distinct reason strings for different token failures.

#### Scenario: Consistent shape across unauthorized cases

- GIVEN protected requests that fail with missing, malformed, and invalid tokens
- WHEN each is rejected
- THEN each response status SHALL be `401`
- AND each response body SHALL be exactly `{ "detail": "Not authenticated" }`
- AND no response SHALL leak secrets, token contents, provider internals, or failure-specific reason strings

### Requirement: Startup tolerance with clear protected-route failure when auth config is missing

The system SHALL allow the backend to start when auth configuration is absent so
public health/scaffold endpoints continue working, while ensuring protected
auth-dependent routes fail clearly and consistently until auth is configured.

- The backend application MUST import and start successfully when auth verification
  configuration (e.g., `SUPABASE_JWKS_URL`) is absent.
- Public health/scaffold endpoints (e.g., `/health`) MUST continue to respond
  normally when auth config is absent.
- When auth config is missing, protected routes such as `GET /auth/me` MUST fail
  clearly and consistently rather than crashing the server, returning a stable
  error that indicates authentication cannot be performed.
- The missing-config failure on protected routes MUST NOT expose secret material or
  provider internals.

#### Scenario: Backend starts and health works without auth config

- GIVEN the backend runs with no auth verification configuration set
- WHEN the application starts and `/health` is called
- THEN startup SHALL succeed
- AND `/health` SHALL return its healthy status

#### Scenario: Protected route fails clearly without auth config

- GIVEN the backend runs with no auth verification configuration set
- WHEN `GET /auth/me` is called
- THEN the request SHALL fail clearly and consistently without crashing the server
- AND the response SHALL NOT expose secret material or provider internals

### Requirement: Default auth dependency pattern for future protected APIs

The system SHALL establish the auth dependency defined here as the default,
mandatory model for protecting future domain APIs, so protected routes obtain a
`UserContext` through the shared boundary rather than reimplementing verification.

- The protected-route dependency (e.g., a `get_current_user`-style dependency
  yielding `UserContext`) SHALL be reusable by future domain routers.
- Documentation SHALL frame this dependency as the default required pattern for
  protecting future domain endpoints.

#### Scenario: Reusable dependency documented as the default

- GIVEN a developer adding a future protected domain route
- WHEN they consult the backend auth documentation
- THEN they SHALL find the shared auth dependency presented as the default required
  way to obtain an authenticated `UserContext`

### Requirement: Discoverable backend auth configuration and documentation

The system SHALL make backend auth configuration discoverable where backend
contributors expect it, without documenting signup/login UX, frontend session
handling, or wider deployment rollout concerns.

- `apps/api/.env.example` SHALL list the required auth environment variables
  (including explicit `SUPABASE_JWKS_URL` and any supporting settings) with
  placeholder/default guidance.
- `apps/api/README.md` SHALL document the auth boundary, the required environment
  configuration, the local behavior when auth config is absent (public endpoints
  work, protected routes fail clearly), and how to exercise `GET /auth/me` for
  verification.
- Documentation SHALL make clear that Supabase is the first verification adapter and
  that domain code depends on the canonical `UserContext` and auth boundary.

#### Scenario: Contributor discovers backend auth setup

- GIVEN a backend contributor inspecting `apps/api`
- WHEN they open `apps/api/.env.example` and `apps/api/README.md`
- THEN they SHALL find the required auth variables with default/placeholder guidance
- AND they SHALL find instructions describing the auth boundary, missing-config
  behavior, and how to verify `GET /auth/me`

### Requirement: Test coverage for the auth boundary slice

The system SHALL include tests that prove the auth boundary behaves as specified,
covering verification, the protected dependency, the endpoint contract,
missing-config behavior, and provider isolation.

- There SHALL be tests for the verifier/adapter covering successful verification,
  token without email, and invalid/expired/malformed token rejection.
- There SHALL be tests for the protected-route dependency covering missing,
  malformed, and invalid bearer tokens producing the minimal `401` contract.
- There SHALL be a test for `GET /auth/me` asserting the identity-only success
  response and the `401` behavior for unauthenticated requests.
- There SHALL be a test for missing-auth-config behavior asserting public endpoints
  work and protected routes fail clearly.
- There SHALL be a check/test asserting that no provider-specific concepts leak into
  domain-facing code (the boundary and `UserContext` remain provider-agnostic).

#### Scenario: Verifier and endpoint behaviors are covered by tests

- GIVEN the backend auth test suite
- WHEN it runs
- THEN it SHALL cover verifier success, token-without-email acceptance, and
  invalid/malformed/missing-token rejection with the minimal `401` contract
- AND it SHALL cover the `GET /auth/me` identity-only response, missing-config
  behavior, and the absence of provider leakage into domain-facing code
