# Proposal — Setup Supabase Auth Backend

Establish the first backend authentication boundary for Kaito so protected API routes can trust a verified canonical user identity without depending on Supabase-specific concepts in domain code.

This slice uses Supabase Auth as the first concrete token-verification adapter, but the backend architecture must remain provider-agnostic from the start.

## Assumption summary from proposal questions

- `GET /auth/me` returns only canonical auth identity data: required `user_id` and optional `email`.
- A valid token without an `email` claim is still authenticated if `user_id` is present.
- Unauthorized responses should use a minimal consistent `401` contract now, without introducing a full API error framework.
- In this change only `/auth/me` is protected, but the auth dependency pattern defined here is the default required model for future domain APIs.
- The backend may boot when auth configuration is missing, but protected routes must fail clearly until auth is configured, while public health/scaffold endpoints continue to work.

## Intent

Create a simple, explicit backend auth verification boundary that converts a valid external auth token into a Kaito-owned `UserContext`, rejects invalid or missing auth before domain logic runs, and proves the flow through a protected `GET /auth/me` endpoint.

## Scope

### In scope

- Define a small provider-agnostic auth verifier boundary/interface for backend use.
- Define canonical `UserContext` with required `user_id` and optional `email`.
- Implement Supabase as the first infrastructure adapter for backend token verification.
- Verify tokens using Supabase JWT Signing Keys via the explicit `SUPABASE_JWKS_URL` from Supabase onboarding, driven by environment-based configuration; `SUPABASE_URL` is optional/informational and the legacy `SUPABASE_JWT_SECRET`/HS256 symmetric-secret path is explicitly out of scope.
- Add a protected `GET /auth/me` smoke endpoint that returns canonical auth identity data only.
- Enforce a minimal consistent unauthorized `401` response shape for protected routes in this slice.
- Allow backend startup when auth config is absent, while making protected auth-dependent routes clearly unusable until configured.
- Establish this dependency pattern as the default boundary for future protected domain APIs.

### Out of scope

- Signup, login, logout, password recovery, OAuth provider UX, or any frontend session handling.
- User registration persistence, profile creation, onboarding state, or product/domain state in `/auth/me`.
- RBAC, roles, permissions, or broader authorization policy.
- Full API-wide error framework beyond the minimal unauthorized contract needed here.
- Multi-provider runtime support in this slice beyond preserving the architectural boundary.

## Provider-agnostic rationale

Kaito domain modules should depend on Kaito-owned auth concepts, not on Supabase claim names, SDK types, or verification details. Supabase is the first adapter, not the domain contract. By introducing a small `AuthVerifier`-style boundary and canonical `UserContext` now, future modules can require authenticated identity in a stable way even if token verification strategy later changes (e.g. to another provider or an OIDC flavor), while the current adapter already uses Supabase's asymmetric JWKS signing keys rather than a legacy shared secret.

## Confirmed assumptions

- Kaito auth architecture must be provider-agnostic.
- Backend domain modules must depend on `UserContext` and an auth verification boundary, not directly on provider-specific concepts.
- The initial abstraction should stay small and explicit, without overengineering.
- `UserContext` includes required `user_id` and optional `email` only for this first slice.
- A token is considered authenticated when verification succeeds and canonical `user_id` can be derived, even if `email` is absent.
- Token verification uses Supabase JWT Signing Keys via explicit `SUPABASE_JWKS_URL` (asymmetric, kid-selected); the legacy `SUPABASE_JWT_SECRET`/HS256 path is not used. The boundary must still preserve a path to future provider/strategy changes.
- `GET /auth/me` is the protected smoke endpoint for this change.
- Registration, login, and user-facing auth flows remain a separate future change.

## Affected areas

- `apps/api/app/core/`: auth config, verification, and dependency wiring.
- `apps/api/app/modules/auth/`: auth router, response schema, and canonical user-context definitions.
- Protected-route dependency pattern for future domain modules.
- API developer documentation and environment configuration examples.
- Tests covering token verification, missing config behavior, and protected endpoint behavior.

## Current-state gap

The backend scaffold does not yet verify bearer tokens or provide a canonical authenticated user context to route handlers. Without this slice, future domain APIs would either remain public, duplicate provider-specific auth logic, or couple business modules directly to Supabase details.

## Risks

- Provider-specific claim mapping may leak into domain-facing code if the boundary is not kept strict.
- JWKS verification depends on network reachability of the Supabase JWKS endpoint and on caching/rotation being handled correctly inside the adapter; failures must map cleanly to the auth-failure/misconfig contracts.
- Supabase signing keys are asymmetric (e.g. ES256/RS256/EdDSA); the adapter must accept only the algorithms advertised by the JWKS and reject `alg: none` and HS* to avoid algorithm-confusion.
- Missing-auth-config behavior can become confusing if protected endpoints do not fail clearly and consistently.
- Expanding `/auth/me` beyond canonical identity would blur scope and couple this setup change to future product-state decisions.

## Rollback

- Remove the auth verifier wiring, protected endpoint, and related config if the backend auth setup must be deferred.
- Revert protected-route dependency usage and return the scaffold to its prior unauthenticated state.
- Remove documentation that presents backend auth as ready if the change is rolled back.

## Success criteria

- The backend exposes a small provider-agnostic auth verification boundary and canonical `UserContext`.
- Supabase-backed token verification works through the infrastructure adapter without making domain-facing code depend on Supabase types or claims.
- `GET /auth/me` requires authentication and returns only canonical identity data: `user_id` and optional `email`.
- A valid token without `email` is accepted when `user_id` is present.
- Unauthorized access to protected routes returns a consistent minimal `401` response.
- Public health/scaffold endpoints still work when auth config is missing, while protected routes fail clearly until configured.
- The proposal and follow-on artifacts frame this auth dependency as the default mandatory pattern for future protected domain APIs.

## Review notes

- Keep the first slice narrow: verified identity boundary plus `/auth/me` proof.
- Prefer plain, explicit architecture over generic auth frameworks.
- Avoid mixing identity verification with onboarding, profile, or domain lifecycle concerns.
- Use Supabase's asymmetric JWKS signing keys now; keep the boundary swappable for future provider/strategy changes without implementing them here.

## Next step

If approved, proceed to spec/design work that defines the exact route contract, config behavior, dependency wiring, and verification approach for the provider-agnostic backend auth boundary.
