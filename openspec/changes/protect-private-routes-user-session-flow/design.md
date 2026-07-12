# Technical Design — Protect Private Routes and Define the User Session Flow

> **Current implementation status:** PR 1A/1B foundation and the behavior-preserving ownership refactor are complete. The live handoff intentionally remains `/`. PR 2 route creation/protection and `/onboarding` handoff activation are unstarted; prescriptive route behavior below remains the approved future design.

## 1. Design summary

This change introduces a cookie-backed Supabase session boundary for the Next.js App Router. Next.js `proxy.ts` refreshes/resolves the session for `/login` and `/onboarding`, applies explicit route policy, and performs the earliest redirect. Server pages repeat the authorization-sensitive decision before rendering. Client code owns password sign-in, post-login replacement navigation, and recoverable API-authentication UX.

The default authenticated destination is `/onboarding`. `/` remains public and is not part of the authenticated handoff. FastAPI remains unchanged and independently validates every bearer token used by a private API.

## 2. Superseded design-time architecture snapshot

> Historical inspection retained as design evidence. Paths and runtime observations here are superseded by the current-status banner and the approved ownership correction in section 7.

Repository inspection found:

- `apps/web/app/page.tsx` is the public `/` scaffold.
- `apps/web/app/(auth)/login/page.tsx` is a server page that renders the client `LoginForm`; it does not resolve a session or inspect query parameters.
- `apps/web/features/auth/login-form.tsx` implements validation, duplicate-submit prevention, accessible errors, Sentry reporting, and a loopback-only Playwright adapter. Its production sign-in path currently always returns `system_error`.
- `apps/web/features/auth/auth-client.ts` already isolates provider result mapping behind `SignInWithPassword`, but no Supabase adapter is wired.
- `apps/web/features/auth/authenticated-handoff.ts` centralizes `router.replace`, but its destination is currently `/` and it has no return-URL input.
- Existing Node tests cover validation, provider-result mapping, and handoff. Playwright covers `/login`, including a simulated successful handoff to `/`.
- `apps/web/package.json` has no Supabase dependency. It provides `tsx --test` auth tests, ESLint, Next build, and Playwright scripts.
- There is no `proxy.ts`/middleware, `/onboarding` route, session provider, private API fetch helper, or frontend API base-URL convention.
- `packages/api-client` is explicitly a reserved placeholder and is not consumed by the web app. Activating or generating that package is unnecessary for this slice.
- FastAPI already exposes `GET /auth/me`. `get_current_user` parses bearer credentials, maps missing/malformed/invalid tokens to `401`, and obtains provider-neutral `UserContext` only from the configured verifier. `AuthConfigError` remains an app-level `503`. `/health` remains public.
- Backend Supabase verification uses the explicit JWKS configuration and verified claims. No backend code needs to change.

## 3. Proposed session architecture

### 3.1 Dependencies and session storage

Add `@supabase/supabase-js` and `@supabase/ssr` to `apps/web`. Use `@supabase/ssr` cookie storage so the browser, Next.js proxy, and server components observe the same supported Supabase session representation. Do not create custom token cookies or expose a service-role key.

Create three narrow boundaries:

1. **Browser client** — a singleton created with `createBrowserClient`; used by login, sign-out/recovery, and token acquisition for browser API calls.
2. **Server client** — request-scoped `createServerClient` using `cookies()`; used by server pages to call `auth.getUser()`.
3. **Proxy client** — request-scoped `createServerClient` whose `getAll` reads `NextRequest.cookies` and whose `setAll` writes both the forwarded request cookies and returned response cookies. It calls `auth.getUser()` once so refresh writes are propagated.

The server and proxy must use `getUser()`, not unverified claims or `getSession()` alone, for route-render decisions. Browser API token acquisition may use `getSession()` because the backend re-verifies the token; the frontend must never infer backend authorization from it.

### 3.2 Session result model

Normalize provider outcomes into an internal result rather than leaking Supabase error text:

- `authenticated`: verified user exists;
- `anonymous`: no session exists;
- `invalid`: stale/expired session could not be refreshed or validated;
- `unavailable`: required frontend auth configuration is absent or the provider cannot be reached.

`AuthSessionMissingError` maps to `anonymous`; an actual refresh/validation rejection maps to `invalid`; network/configuration failures map to `unavailable`. Only `invalid` may produce the expired-session message. Provider details and tokens must not enter URLs, rendered errors, or Sentry context.

### 3.3 Data flow

**Private route request**

1. Request enters `proxy.ts` for `/onboarding`.
2. Proxy creates the cookie-backed Supabase client and calls `getUser()`, carrying any refreshed cookies onto the response.
3. `authenticated` continues. `anonymous` redirects to `/login?returnTo=...`. `invalid` redirects with the same return URL plus `context=session_expired`. `unavailable` fails closed and redirects with `context=auth_unavailable` without claiming the user's credentials are invalid.
4. The `/onboarding` server page performs a defense-in-depth `getUser()` check. It redirects if no verified user exists; only then does it render placeholder content.

**Login**

1. Proxy refreshes session state for `/login` too, ensuring server-readable cookies are current.
2. If authenticated, proxy replaces the request flow with a redirect to the validated `returnTo` or `/onboarding`.
3. Otherwise the login server page renders a bounded context message and passes the validated return destination to `LoginForm`.
4. `LoginForm` calls the browser Supabase adapter. After success, it calls `router.replace(validatedReturnTo)` or `router.replace('/onboarding')` and `router.refresh()` so server components observe the new cookie state.

**Private API request**

1. The web API helper obtains the current browser session immediately before the request.
2. If no access token exists, it returns an auth-required result without issuing the request.
3. It sends `Authorization: Bearer <access_token>` and never sends a user ID as authority.
4. A `401` returns a typed recoverable authentication failure, with no retry or automatic navigation. A `503` returns a distinct system/configuration failure.
5. The caller discards/does not commit response data from failed requests and renders a sign-in-again action. Only that user action clears/revalidates local auth and navigates to login with a safe current return path.

## 4. Route protection and no-flash behavior

Use root `apps/web/proxy.ts`, the Next.js 16 replacement for legacy middleware. Its matcher is explicit: `/login` and `/onboarding` (including `/onboarding` query strings, which do not affect pathname matching). It must not protect `/`, static assets, or every route by default.

Protection is layered:

- **Proxy:** earliest cookie refresh and route-policy redirect.
- **Server page:** final render gate. `/onboarding` is a server component and does not render its heading until `authenticated` is confirmed.
- **Loading boundary:** `app/(private)/onboarding/loading.tsx` contains a minimal `role="status"`/live-region message for client transitions or slow server resolution. It contains no onboarding content.
- **Client:** does not decide whether initial private HTML is authorized. Client auth events may refresh/replace navigation after sign-out or expiration, but they are not the primary guard.

If session state changes between proxy and page evaluation, the stricter server result wins. A redirect must preserve cookie mutations from the Supabase proxy response; otherwise refreshed sessions can loop. Redirect destinations must never target `/login` as their own return destination.

The placeholder should remain a simple accessible `<main>` with an `<h1>` such as “Onboarding process” and short non-technical copy. It contains no API read, forms, completion state, or workflow.

## 5. Authenticated `/login` handoff

`/login` remains public because anonymous users can always render it. It is auth-aware because proxy/server session resolution happens before the form is rendered:

- verified session + valid `returnTo` → redirect there;
- verified session + absent/invalid `returnTo` → redirect to `/onboarding`;
- anonymous → render form;
- invalid → render form with the fixed expired-session message after stale cookies are cleared by supported Supabase cookie updates;
- unavailable → render the form with fixed service-unavailable context; submission remains recoverably unavailable.

Successful sign-in uses exactly the same destination selector. Navigation uses replacement, not push, so Back does not return to a login entry that immediately redirects. `/` is never the fallback.

## 6. Safe return URL and bounded context contracts

### 6.1 Return URL

Use one shared, pure `selectReturnDestination(value)` function in server and client-compatible code. The URL is transported as a single `returnTo` query parameter using `URLSearchParams`, which performs encoding exactly once.

A candidate is accepted only if all conditions hold:

- it is a string no longer than 2,048 characters;
- it begins with exactly one `/`;
- it does not begin with `//` and contains no backslash or ASCII control character;
- resolving it against a fixed dummy application origin preserves that origin;
- it is a path/query/fragment destination, not credentials, host, or scheme;
- its normalized pathname is not `/login` (prevents a login handoff loop).

The accepted output is reconstructed from normalized `pathname + search + hash`; it is never concatenated into HTML. Absolute, protocol-relative, malformed, oversized, double-encoded escape attempts, and login-loop destinations fall back to `/onboarding`.

For an unauthenticated `/onboarding` request, proxy constructs the candidate from `request.nextUrl.pathname + request.nextUrl.search`. Fragments are browser-only and cannot be preserved by a server redirect, but supplied valid return values may contain a fragment.

### 6.2 Context/message

Use `context` as a bounded enum, never as display text:

- `session_expired` → fixed localized copy equivalent to “Your session expired. Sign in again.”
- `auth_unavailable` → fixed localized copy explaining sign-in is temporarily unavailable.

Unknown, repeated, or oversized values render no context message. An ordinary anonymous redirect includes no `context`. Query values are only selectors for constant application-owned copy; raw provider/user text is never reflected. Because URL parameters can be manually edited, the message is informational and must not be treated as security evidence.

## 7. Approved feature ownership correction

The user-approved Screaming Architecture supersedes the earlier `lib/` layout below. The behavior-preserving structural refactor was completed after PR 1B and before PR 2; PR 2 remains unstarted.

- `app/` remains Next.js routing/orchestration only. `app/(auth)/login/page.tsx` imports auth feature behavior.
- Auth uses `_components/`, `_adapters/`, `_use-cases/`, optional warranted `_domain/`, and `_infrastructure/` for provider plumbing.
- Supabase browser/server/proxy construction belongs in `features/auth/_infrastructure/supabase/`.
- Authenticated fetch belongs in `features/auth/_adapters/`.
- Existing auth contracts are assigned to the narrowest auth scope by responsibility during the refactor; no generic `utils`/`helpers` bucket is introduced.
- `shared/` requires two distinct real feature consumers. Login, server guard, and proxy remain one auth feature and do not qualify.
- No empty future-feature folders or mechanical container are created.

Historical paths such as `apps/web/lib/supabase/*`, `apps/web/lib/api/*`, and flat `features/auth/*` describe PR 1A/1B implementation evidence only and are superseded as target architecture.

### Environment variables

Required public configuration:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

The publishable key is intended for browser use; it is not a backend authorization secret. Do not add `SUPABASE_SERVICE_ROLE_KEY`, JWT secrets, refresh tokens, or access tokens to public variables. Document the legacy anon-key naming only if the selected installed SDK requires it; the implementation should expose one canonical Kaito configuration contract.

Add `NEXT_PUBLIC_KAITO_API_URL` only when the private API helper needs a browser-visible base URL; validate it as configuration and use `http://localhost:8000` only in documented local setup, not as a silent production fallback.

Missing Supabase web variables must not break `next build` or public `/`; runtime auth operations become `unavailable`, and private content fails closed. Update `apps/web/.env.example`, package web documentation, and the concise root README during implementation because runtime setup/capabilities change.

The existing browser test adapter remains strictly non-production and loopback-only. For authenticated route E2E without live Supabase, add a server-side test session seam enabled only when `NODE_ENV !== 'production'`, a server-only `KAITO_E2E_AUTH_ADAPTER=1`, and loopback host checks all hold. It may recognize only a non-secret test cookie set by the existing browser adapter. Production code must default to Supabase and fail closed; the public browser flag alone must never bypass proxy protection. Production Playwright remains adapter-free.

## 8. Frontend private API client and recoverable `401`

Keep this implementation feature-owned at `apps/web/features/auth/_adapters/private-fetch.ts`; do not activate the reserved generated `packages/api-client` package solely for one fetch policy. The existing `apps/web/lib/api/private-fetch.ts` record is historical and will move without behavior changes before PR 2.

Contract:

- accepts a relative API path and standard `RequestInit`, but owns the `Authorization` header;
- rejects absolute caller-provided destinations and caller-provided authorization headers;
- obtains a fresh current session at call time and does not cache the access token in module state;
- performs at most one network request (no implicit retry);
- returns/throws discriminated Kaito errors: `auth_required`, `auth_rejected` (`401`), `auth_unavailable` (`503`), and `request_failed`;
- never exposes raw token/provider payloads in user-facing messages or telemetry.

A reusable client `SessionRecoveryNotice` accepts only `auth_required`/`auth_rejected`, shows a clear alert, and offers a button/link such as “Sign in again.” Activation calls Supabase sign-out or local session cleanup as supported, then replaces navigation with `/login?returnTo=<validated current path>`. It must not navigate merely because the component receives the error. `503` uses system-error UI and does not clear a valid session.

No API call is added to the minimal onboarding placeholder merely to exercise this helper. Unit/component-level contract tests cover the helper and notice now; future private feature callers must render the typed failure instead of assuming successful data. Failed or cached private data must not be committed as current after `401`.

## 9. Backend boundary and assumptions

No files under `apps/api` are modified.

The frontend assumes:

- Supabase issues the access token held in the browser session;
- private Kaito endpoints accept `Authorization: Bearer <token>`;
- `GET /auth/me` and future private endpoints use `Depends(get_current_user)`;
- invalid/missing credentials remain `401 {"detail":"Not authenticated"}`;
- missing backend auth configuration remains `503 {"detail":"Authentication is not configured"}`;
- verified `sub` (and optional email) are mapped to canonical `UserContext` by FastAPI;
- CORS/deployment routing permits the configured web origin to call the API. If it does not, that deployment work is a prerequisite, not a reason to weaken token validation.

Frontend route checks are disclosure/navigation controls only. Direct API requests remain safe because FastAPI does not accept client-supplied identity as proof.

## 10. Expected file changes

Likely additions:

- `apps/web/proxy.ts`
- `apps/web/app/(private)/onboarding/page.tsx`
- `apps/web/app/(private)/onboarding/loading.tsx`
- Supabase browser/server/proxy helpers under `apps/web/features/auth/_infrastructure/supabase/`
- scoped auth components, adapters, and use cases under `apps/web/features/auth/`
- focused `*.test.ts` files and Playwright session-flow cases

Likely modifications:

- `apps/web/app/(auth)/login/page.tsx` to resolve auth state, consume bounded query context, and pass destination/context to the form
- `apps/web/features/auth/_components/login-form.tsx` and the feature-owned auth use cases it consumes
- existing auth unit and login Playwright tests (replace `/` expectations with `/onboarding`)
- `apps/web/package.json`, lockfile, Playwright development configuration, environment example, web README, and root README

Explicitly unchanged: `apps/web/app/page.tsx`, `packages/api-client`, all backend auth implementation, `/health`, and `/auth/me` semantics.

## 11. Strict-TDD test strategy

No tests are run during design. Implementation must preserve RED then GREEN evidence per behavior slice.

### Unit/contract tests (`tsx --test`)

Add failing tests first for:

- safe local paths with query/fragment and fallback rejection of absolute, `//`, backslash, control, malformed, oversized, encoded attack, and `/login` loop values;
- default `/onboarding` handoff and valid return precedence;
- Supabase provider result mapping without raw error leakage;
- normalized anonymous/invalid/unavailable session outcomes;
- private fetch bearer attachment, no caller auth override, no request without a token, one request only, typed `401`, distinct `503`, and no token caching;
- recovery UI/action policy being user-triggered rather than automatic (pure controller tests if no DOM runner is added).

Expected RED evidence is assertion/module/behavior failure for each newly specified contract, not lint or setup failure. GREEN evidence is the focused test passing after minimal implementation.

Likely focused command:

```bash
pnpm test:web-auth
```

> **Superseded planning note:** At design time the glob was `features/auth/*.test.ts`. The completed structure correction now uses recursive `features/auth/**/*.test.ts` discovery for colocated tests.

### Browser acceptance

Development Playwright with the guarded test session seam covers:

- anonymous `/onboarding?x=1` redirects to login with safe `returnTo`, no onboarding heading, and no expiry message;
- loading boundary/private-content no-flash under delayed session resolution;
- successful login replaces to `/onboarding` or a valid return URL;
- malicious return values fall back to `/onboarding`;
- an authenticated `/login` visit immediately hands off;
- expired/invalid test session shows only the bounded message and does not loop;
- authenticated `/onboarding` renders only placeholder content;
- recovery action occurs only after user click and does not loop/retry.

Production Playwright stays adapter-free and proves `/login` remains renderable without accidental test bypass. Network/API-helper behavior remains deterministic unit coverage unless a local API/Supabase test environment is explicitly introduced later.

Expected RED evidence: focused Playwright scenarios fail against the current `/` handoff/missing route/guard. Expected GREEN evidence: the same scenarios pass after implementation.

### Full regression commands

Use commands from project configuration plus the existing auth script:

```bash
pnpm test:web-auth
pnpm lint:web
pnpm build:web
pnpm test:web-e2e
cd apps/api && uv run ruff check .
cd apps/api && uv run python -c "from app.main import app"
```

Backend commands are regression evidence only because backend behavior is unchanged. If the repository's API auth pytest suite is available in the implementation environment, `cd apps/api && uv run pytest tests/auth -q` is recommended additional authority-boundary evidence, but it is not a substitute for frontend tests.

## 12. Rollout and rollback

### Rollout

1. Configure Supabase URL/publishable key and API URL in development/staging.
2. Verify cookie behavior on the real HTTPS deployment domain, including refresh and SameSite defaults.
3. Deploy to staging and exercise fresh login, existing session, expired session, malicious return URL, browser Back, and API `401`/`503` distinctions.
4. Confirm telemetry contains no cookies, access tokens, credentials, return-query secrets, or provider payloads.
5. Release web changes only after backend JWKS configuration is confirmed. No database migration is required.

A feature flag is not required because route policy is narrow and rollback is code/config based. Do not release user-owned private pages while the guard is disabled.

### Rollback

Revert proxy/session modules, `/onboarding`, Supabase web dependencies/config documentation, typed API helper/recovery UI, and restore the centralized handoff destination to `/`. Keep `/` public and retain all pre-existing FastAPI bearer verification. Rollback restores the UX/security gap, so private product routes must remain unreleased or disabled.

Cookie cleanup is not a migration requirement; obsolete Supabase cookies expire/are overwritten. If rollback follows malformed-cookie loops, operators may instruct affected users to clear site cookies while the reverted app remains public-only.

## 13. Review workload and chained-PR forecast

The complete implementation is forecast at roughly **550–750 changed lines**, dominated by tests and cookie/session adapters, so a single PR likely exceeds the session's 400-line review budget. Use two chained PRs, each targeted below 400 changed lines:

1. **PR 1A — Pure auth contracts:** completed in historical paths.
2. **PR 1B — Supabase session boundaries:** completed in historical paths.
3. **Structure refactor — approved correction before PR 2:** move PR 1A/1B modules into auth underscore scopes, update imports/tests, and prove behavior unchanged. It introduces no route behavior.
4. **PR 2 — Route/UI integration:** remains forbidden and unstarted until separately authorized; it consumes the corrected auth feature boundaries.

Recalculate PR 2 after the structure-only slice. Split further rather than exceeding the review budget or weakening tests. Generated lockfile churn should be identified separately in review metrics.

## 14. Risks and mitigations

- **Cookie refresh lost on redirects:** centralize response cookie propagation in the proxy helper and test refreshed-cookie redirects.
- **Proxy/server disagreement:** use the same session normalization and `getUser()` semantics; server remains the final render gate.
- **Open redirect/double encoding:** one shared validator, one encoding step, fixed-origin parsing, length/control checks, and `/login` rejection.
- **Redirect loop:** explicit route table, `/login` cannot return to itself, replace navigation, and bounded tests with redirect-count assertions.
- **Provider outage treated as logout:** map unavailable separately; do not label it expiry or clear a valid session on API `503`.
- **API/browser session race:** backend `401` wins for that request; discard failed data and require explicit recovery rather than automatic retry.
- **Missing deployment config:** public routes/build remain available, private routes fail closed, and fixed system context is shown.
- **Test bypass leaks to production:** require non-production runtime, server-only opt-in, and loopback checks; production Playwright proves the bypass is absent.
- **Placeholder mistaken for workflow:** keep copy minimal and omit all workflow controls/state/API calls.
- **Review overload:** use the two-PR chain and split again if either PR crosses 400 changed lines.

## 15. Alternatives considered

- **Client-only auth provider/guard:** rejected because it can flash private content and delays redirects until hydration.
- **Proxy-only guard:** rejected as the sole gate because server rendering should fail closed if state changes or proxy matching is accidentally broadened/narrowed.
- **Server-page-only guard:** viable for no-flash rendering, but proxy is still preferred for shared refresh cookies and the earliest login/private-route handoff.
- **Custom localStorage session:** rejected because the server cannot read it and it bypasses supported Supabase SSR lifecycle handling.
- **Custom JWT verification in Next.js:** rejected; it duplicates provider/backend authority and complicates refresh. `getUser()` is used for web route state, while FastAPI remains API authority.
- **Automatic redirect/retry on every API `401`:** rejected due to loops and loss of user control.
- **Calling `/auth/me` from the placeholder:** rejected because the placeholder has no data need and should not become unavailable solely to demonstrate the API helper.
- **Activating `packages/api-client`:** deferred; it is currently a reserved generator boundary, and this slice needs only a small web-local authenticated fetch policy.
- **Protect all routes except an allowlist:** rejected; `/` is public and future auth-flow/public routes require explicit classification.

## 16. Explicit non-goals

This design does not add a real onboarding workflow, onboarding persistence, completion logic, `/dashboard`, dashboard selection, a landing-page redesign, registration/recovery/OAuth callbacks, roles/RBAC, domain authorization changes, backend JWT/auth semantics, refresh-token customization, user identity telemetry, or a generated API client. It does not make frontend route protection an authorization boundary.
