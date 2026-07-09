# Spec — Setup Supabase Auth Backend

> This flat file is the human-readable narrative entry point. The normative,
> machine-consumable requirements live in the structured new-domain spec at
> `openspec/changes/setup-supabase-auth-backend/specs/backend-auth/spec.md`.
> `backend-auth` is a **new** domain: no canonical `openspec/specs/backend-auth/spec.md`
> exists yet, so archive will copy the structured spec into the canonical location.

## Summary

This change establishes Kaito's first backend authentication boundary. It defines a
small provider-agnostic auth verifier (`AuthVerifier`-style) and a canonical
Kaito-owned `UserContext`, implements Supabase as the first isolated verification
adapter, and proves the flow through a protected `GET /auth/me` endpoint that
returns identity only. Supabase is an adapter/tool, not a domain dependency.

## Normative requirements (see structured spec for full scenarios)

1. **Provider-agnostic auth verification boundary** — domain code depends only on
   the boundary and `UserContext`, never on Supabase types or claims.
2. **Canonical `UserContext`** — required `user_id`, optional `email`; a result
   with no derivable `user_id` is an authentication failure.
3. **Valid token without email is accepted** when a `user_id` can be derived.
4. **Supabase adapter as first isolated implementation** — all provider claim
   mapping is confined to the adapter.
5. **JWKS asymmetric signing-key verification** using Supabase JWT Signing Keys via
   the explicit `SUPABASE_JWKS_URL` from Supabase onboarding (kid-selected asymmetric
   keys). `SUPABASE_URL` is optional/informational and is not used to derive JWKS;
   the legacy `SUPABASE_JWT_SECRET`/HS256 path is NOT used. The boundary preserves a
   structural path to future provider/strategy changes.
6. **Protected `GET /auth/me`** returns `200` with `user_id` and optional `email`
   only — no provider fields, raw claims, or domain state.
7. **Reject missing / malformed / invalid bearer tokens** at the boundary before
   the handler runs, without disclosing provider internals or secrets.
8. **Minimal consistent `401` contract** — exact JSON body
   `{ "detail": "Not authenticated" }` across all unauthorized token failures;
   no full API-wide error framework.
9. **Startup tolerance with clear failure when auth config is missing** — backend
   boots and public health/scaffold endpoints keep working; protected routes
   return `503 Service Unavailable` with
   `{ "detail": "Authentication is not configured" }` until configured.
10. **Default auth dependency pattern** for future protected domain APIs.
11. **Discoverable configuration and documentation** in `apps/api/.env.example` and
    `apps/api/README.md` (centered on explicit `SUPABASE_JWKS_URL` and JWKS verification).
12. **Test coverage** for verifier, protected dependency, `/auth/me` endpoint,
    missing-config behavior, and no provider leakage into domain-facing code.

## Out of scope

Signup, login, logout, password recovery, OAuth provider UX, and frontend session
handling; user registration persistence, profile/onboarding/domain state in
`/auth/me`; RBAC/roles/permissions; a full API-wide error framework beyond the
minimal `401`; and multi-provider runtime support beyond preserving the boundary.
