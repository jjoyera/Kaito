# Proposal — Protect Private Routes and Define the User Session Flow

> **Current implementation status:** PR 1A/1B foundation and the auth ownership refactor are complete. The live handoff intentionally remains `/`. All `/onboarding` route, protection, and handoff behavior below is an approved **future PR 2 requirement** and is unstarted.

## Intent

Establish a coherent authenticated web experience for Kaito so private product pages are not shown without a valid user session, successful login enters a real protected application route, and private API operations trust only identities validated by the backend.

The first product slice will use a minimal private `/onboarding` page as the default post-login destination. This placeholder establishes the protected route and may display simple copy such as “Onboarding process,” but it does not implement an onboarding workflow or domain logic.

Supabase Auth remains the source of truth for frontend identity and session state. The frontend sends the current Supabase access token to private Kaito APIs, while FastAPI independently validates that token before deriving or trusting user identity.

## Business problem and desired outcome

Kaito's MVP depends on authenticated, user-owned onboarding, plans, training sessions, and logs. The current web scaffold navigates to `/` after a simulated login but has no production Supabase session integration or route protection. An unauthenticated visitor can open the current handoff directly, and the application cannot consistently explain what happens while a session is loading, has expired, or is rejected by a private API.

Using `/` as the authenticated fallback also conflicts with its likely future role as a public landing page. Creating a minimal `/onboarding` destination now gives the authenticated flow an explicit private entry without prematurely building onboarding behavior.

After this change:

- unauthenticated visitors cannot remain on `/onboarding` or other explicitly private routes;
- users are redirected to login before private content renders, with a safe return URL preserved;
- successful login without another valid return destination leads to `/onboarding`;
- `/onboarding` clearly communicates that the user has entered the onboarding area, while containing no workflow, form, state machine, or domain logic;
- loading and invalid/expired-session states have deterministic, contextual behavior;
- a private API `401` produces a recoverable authentication error instead of an unconditional redirect or retry loop;
- `/` is no longer required to act as the temporary private fallback and can remain the current scaffold or evolve toward a public landing page later; and
- frontend route protection improves UX without replacing backend authorization for private data.

## Superseded proposal-time snapshot: current-state gap

> Historical repository snapshot retained as proposal evidence. It is superseded for current implementation status by the banner above.

Repository inspection found only two routable web pages:

- `apps/web/app/page.tsx` exposes `/` as a public scaffold page;
- `apps/web/app/(auth)/login/page.tsx` exposes `/login` and uses a client-only login form.

Successful login is centrally handed off to `/`. There is currently no `/onboarding` page, production Supabase client/session integration, middleware, server guard, or client session boundary protecting a private entry.

The backend already provides the authority foundation: `GET /auth/me` requires a bearer token and maps valid Supabase claims to Kaito's canonical `UserContext`; missing, malformed, invalid, or expired credentials return `401`, and missing auth configuration returns `503`. The missing piece is a consistent frontend session, error, navigation, and private-route flow connected to this boundary.

## Proposal question rounds: decisions and assumptions

Earlier proposal rounds established that:

1. Routes are classified from actual route files rather than an unbounded naming convention.
2. Private routes should be rejected as early as the deployed session model permits, preferring middleware/server redirects and preserving a safe return URL; a client loading state remains necessary to avoid session-resolution flashes.
3. Supabase Auth owns login, identity, and session state. The frontend sends its access token to private APIs, and FastAPI validates it before trusting identity.
4. A private API `401` surfaces a recoverable session/authentication error with a user action rather than automatically redirecting or retrying indefinitely.
5. An invalid or expired route session returns the user to `/login` with brief trusted context such as “Your session expired. Sign in again.”
6. `/` may become a public landing page and must not be encoded as Kaito's permanent private entry.

The latest user decision supersedes the previous temporary-fallback assumption:

1. The first slice will create and use a real private `/onboarding` route as the default successful-login destination.
2. `/onboarding` is only a minimal placeholder screen, with simple product copy such as “Onboarding process.” Real onboarding workflow, forms, persistence, lifecycle state, and domain decisions are excluded.
3. `/` is no longer the authenticated fallback. Its current scaffold behavior may remain unchanged in this slice, and its eventual public/landing role is deferred.
4. `/dashboard` and any data-driven choice between onboarding and dashboard remain out of scope.

## Route classification and product direction

### Web routes

| Route | Current state | First-slice classification and behavior | Future product direction |
| --- | --- | --- | --- |
| `/login` | Implemented | Public and auth-aware. Unauthenticated users can sign in. It shows trusted context after an expired/invalid session. An authenticated user continues to a safe internal return URL or `/onboarding`. | Remains an auth-flow route. |
| `/onboarding` | Not implemented | Create as a private, session-protected route. Render only a minimal placeholder such as “Onboarding process”; do not add workflow or domain state. It is the default post-login destination. | May later host the real onboarding experience. |
| `/` | Implemented public scaffold | Not the private post-login fallback. It may remain as-is; this slice does not depend on changing or protecting it as authenticated product content. | Expected to become a public `kaito.dev/` landing page. |
| `/dashboard` | Not implemented | Out of scope and not selected after login. | Expected to become a private destination after later product-state rules exist. |

`layout.tsx` and `global-error.tsx` are framework boundaries, not independently navigable product routes. There are currently no registration, password-recovery, auth-callback, onboarding, dashboard, or training page files; only the minimal onboarding route is added by this slice.

Future registration, recovery, confirmation, and OAuth callback routes must be explicitly classified as public/auth-flow routes when introduced. Future pages exposing or modifying user-owned onboarding, plans, training, or logs are expected to be private, but their classification must be explicit when they are added. Route protection must use an explicit policy rather than treating all paths—or `/`—as private by default.

### Existing API routes

| Route | Classification | Boundary |
| --- | --- | --- |
| `GET /health` | Public | Remains available without authentication. |
| `GET /auth/me` | Private | Requires a Supabase bearer access token and returns canonical Kaito identity only after backend validation. |
| Conditional `/debug-sentry` | Operational/debug | Existing environment-gated behavior remains unchanged. |

All future APIs that read or mutate user-owned product data must use the backend authenticated-user dependency. Browser route protection is never authorization.

## Proposed user and session flow

### Session loading

- On initial navigation to an auth-aware or private route, resolve the Supabase session before rendering session-dependent content.
- Do not flash `/onboarding` or other private content while session state is unknown.
- Show a minimal accessible loading state when an early server/middleware decision cannot fully resolve the session or during client-side revalidation.

### Authenticated user on a private route

- Render `/onboarding` after confirming the session.
- Include the current Supabase access token in private API requests.
- Let FastAPI validate the token and derive canonical user identity; never trust a client-supplied user ID.

### Unauthenticated user on `/onboarding`

- Redirect to `/login` as early as practical, preferring middleware/server handling where compatible with the chosen Supabase session storage.
- Preserve the requested path and query as the return URL.
- Accept only local, relative application destinations when consuming a return URL to prevent open redirects.
- Do not render the placeholder or any future private content before redirecting.
- Do not show session-expiry messaging for an ordinary unauthenticated visit.

### Authenticated user on `/login`

- After session resolution confirms authentication, redirect to a valid preserved internal return URL when present.
- Otherwise replace the login entry with `/onboarding`.

### Successful login

- Supabase establishes the session.
- Replace the login history entry with a validated internal return URL when one exists; otherwise route to `/onboarding`.
- The `/onboarding` destination is protected by the same session flow as any private route.
- Do not infer onboarding completion, redirect to `/dashboard`, or implement onboarding behavior in this slice.

### Expired or invalid session during route access

- Treat a session that cannot be refreshed or is rejected during route/session resolution as unauthenticated.
- Clear or invalidate stale local auth state as supported by Supabase, then redirect to `/login` with the current safe return URL.
- Show brief trusted context such as “Your session expired. Sign in again.”
- Do not allow arbitrary user-controlled message text or create a redirect loop.

### Private API `401` during an active experience

- Do not automatically redirect merely because one private API call returned `401`.
- Stop treating cached identity or failed private data as authorized, and do not retry indefinitely.
- Surface a recoverable session/authentication error with a clear action to sign in again or re-authenticate.
- A user-triggered recovery may clear/revalidate stale auth state and enter login with a safe return destination.
- Treat backend `503` due to missing auth configuration as a system/configuration failure, not invalid user credentials.

## Frontend/backend responsibility boundary

### Supabase Auth and frontend

- Supabase Auth owns credential verification and browser session lifecycle.
- The frontend observes session state, presents loading/redirect/error UX, obtains the access token, and attaches it to private API calls.
- The frontend distinguishes route-level invalid session transitions from recoverable API-level `401` errors.
- Frontend guards control navigation and disclosure; they are not the authority for user data access.

### Kaito API

- FastAPI remains authoritative for private API resources.
- It verifies bearer tokens through the existing provider adapter and maps them to provider-neutral `UserContext`.
- Domain handlers use verified identity and enforce ownership; a client-provided user ID is never proof of identity.
- Existing `401` invalid-token and `503` auth-misconfiguration distinctions remain intact.

## First-slice scope

### In scope

- Introduce the production frontend Supabase session boundary needed by login and protected navigation.
- Create a private `/onboarding` route with only a minimal placeholder screen and basic accessible copy.
- Make `/onboarding` the default destination after successful login or when an already authenticated user visits `/login` without a valid return URL.
- Protect `/onboarding` using the earliest practical redirect and a no-flash loading fallback.
- Classify `/login` as public/auth-aware and `/onboarding` as private; stop relying on `/` as the authenticated fallback.
- Preserve and safely consume internal return URLs.
- Handle expired/invalid route sessions with contextual login feedback.
- Handle private API `401` responses with a recoverable user-invoked re-authentication path rather than unconditional redirects/retries.
- Define access-token attachment for private FastAPI calls while retaining backend token validation as authoritative.
- Cover proposal-level behavior for authenticated, unauthenticated, loading, invalid/expired-route-session, and API-`401` states.

### Non-goals

- Building a real onboarding workflow, form, questionnaire, step sequence, state machine, persistence model, completion rule, or domain API.
- Creating `/dashboard` or implementing a rule that chooses between onboarding and dashboard.
- Creating or redesigning the public landing page at `/`; unrelated root scaffold behavior may remain unchanged.
- Creating plan generation, training, registration, password reset, OAuth, or auth callback pages.
- Finalizing onboarding product copy or visual design beyond a minimal accessible placeholder.
- Adding roles, permissions, RBAC, or fine-grained authorization.
- Changing the backend provider-neutral identity model, JWT verification strategy, or `/auth/me` contract.
- Defining refresh-token storage beyond using the supported Supabase session mechanism selected during design.
- Offline recovery UX, cross-device session management, or treating middleware as a substitute for API authorization.

## Affected areas

The approved architecture correction requires a behavior-preserving structure refactor before PR 2; no application-code move is claimed by this proposal update.

- `apps/web/app`: routing/orchestration only; new private `/onboarding` boundary and auth-aware `/login` behavior arrive in PR 2. `app/(auth)/login/page.tsx` remains a route page importing auth.
- `apps/web/features/auth`: owns production sign-in, session resolution, handoff, context, return-URL validation, API-`401` recovery, and auth transitions under `_components/`, `_adapters/`, `_use-cases/`, optional warranted `_domain/`, and provider plumbing in `_infrastructure/supabase/`.
- Authenticated fetch remains feature-owned in `features/auth/_adapters/`; Supabase construction remains in `features/auth/_infrastructure/supabase/` until a second distinct real feature warrants promotion.
- `apps/web/shared` is not introduced: multiple runtime auth consumers do not satisfy the two-real-feature rule.
- `apps/api/app/modules/auth` and protected domain APIs as an unchanged authority boundary.
- Auth-focused frontend and browser-flow verification in later phases.
- Environment/setup documentation if implementation introduces frontend Supabase variables.

## Risks and tradeoffs

1. **Server/client session mismatch:** storage unreadable by middleware could force late redirects and private-content flashes. Design must align Supabase persistence with Next.js server capabilities.
2. **False security from route guards:** protecting `/onboarding` does not secure future private APIs. Backend verification remains mandatory.
3. **Redirect vulnerabilities:** absolute or protocol-relative return URLs could enable phishing. Only validated local destinations are allowed.
4. **Redirect and retry loops:** stale cookies, failed refresh, or inconsistent checks could bounce users between `/login` and `/onboarding` or repeat failed requests.
5. **Expired-token race:** the browser may consider a session valid while FastAPI rejects the token. Recovery must not continue showing failed private data as current.
6. **Placeholder mistaken for completed onboarding:** users or stakeholders may read `/onboarding` as functional. The screen and release communication must make its placeholder status clear without exposing technical jargon unnecessarily.
7. **Accidental coupling to `/`:** existing handoff assumptions may remain in login code and undermine the new destination or future public landing direction.
8. **Premature dashboard/domain routing:** adding completion checks now would couple this slice to absent data and pages. `/onboarding` remains the unconditional default when no safe return URL exists.
9. **Operational failures misclassified as logout:** Supabase/network outages or backend `503` errors must not erase a valid session without evidence that it is invalid.
10. **Context leakage:** session-expiry context must use a bounded trusted reason, not arbitrary query text.

## Rollback

If session integration, `/onboarding` protection, or routing causes access loops or production instability:

- remove the new session guard/middleware and frontend production-auth wiring;
- remove or disable the minimal `/onboarding` route;
- restore the previous centralized login handoff to `/`;
- restore prior `/` and `/login` scaffold behavior;
- remove contextual session-expiry and API-`401` recovery UI introduced by this slice;
- remove newly introduced frontend Supabase environment documentation; and
- leave existing backend bearer-token validation and `/auth/me` protection intact because they predate this change and remain the security authority.

Rollback restores the known UX gap, so no user-owned private product pages should be released while frontend protection is disabled.

## Proposal-level acceptance criteria

- `/login` is classified as public/auth-aware, `/onboarding` as private, and `/` is not used as the temporary authenticated fallback.
- The first slice creates `/onboarding` as a minimal placeholder with accessible product copy and no onboarding workflow, forms, state, persistence, or domain logic.
- Successful login with no valid internal return URL establishes a Supabase session and replaces navigation to `/onboarding`.
- An authenticated visit to `/login` uses a valid internal return URL or redirects to `/onboarding`.
- Opening `/onboarding` without a valid session redirects to `/login`, preserves a safe internal return URL, and does not flash private content.
- Opening `/onboarding` with a valid session renders the placeholder without a login loop.
- Session resolution shows an accessible loading state where an immediate server decision is not possible.
- A route-level expired or invalid session leads to `/login` with brief trusted context and no private-content flash.
- A private API `401` surfaces a recoverable authentication error with a user action and does not trigger unconditional redirect or retry loops.
- Failed private API authentication does not allow stale identity or failed private data to be treated as authorized.
- Private frontend API calls send the current Supabase access token; FastAPI validates it before exposing canonical identity or user-owned data.
- `/` may retain its current scaffold behavior and remains free to become public/landing-oriented later.
- `/dashboard`, onboarding completion logic, and data-driven post-login route selection are not introduced.
- Public health behavior and the backend's distinct `401` versus auth-configuration `503` contracts remain unchanged.

## Remaining open questions for approval or later product work

The `/onboarding` decision resolves the first-slice default destination. These later product questions do not block this proposal:

1. What exact user-facing placeholder copy should be used? “Onboarding process” is the current working example and may be refined without expanding scope.
2. What user/domain state will eventually mark onboarding complete and select `/dashboard`?
3. When registration and recovery routes are introduced, which safe return-URL and contextual-message behavior should they share with login?
4. Should a later API-`401` recovery flow attempt one bounded silent revalidation before asking the user to sign in again? The first slice remains user-controlled and loop-free.

## Success criteria

The change is successful when a signed-in user reaches the protected `/onboarding` placeholder by default, an unsigned or expired-session user cannot see that page before authentication, `/` is no longer coupled to authenticated handoff, and private API identity continues to be enforced by FastAPI. The slice must establish a clear route/session foundation without implementing onboarding or dashboard product behavior.

## Next step

This revised proposal requires interactive approval or adjustment before spec/design. The user may approve the incorporated `/onboarding` decision, correct an assumption, or request another focused product question round covering business rules, impact, edge cases, or tradeoffs.
