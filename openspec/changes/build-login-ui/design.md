# Design — build-login-ui

## Scope and source review

This design covers the web login UI for existing Kaito users only. It is limited to email/password sign-in, local validation, submission/error states, and a successful-authentication handoff into the authenticated app flow.

Reviewed inputs:

- `openspec/config.yaml`
- `openspec/project-context.md`
- `openspec/changes/build-login-ui/proposal.md`
- `openspec/changes/build-login-ui/specs/web-login-ui/spec.md`
- `openspec/changes/build-login-ui/artifacts.md`
- `apps/web/app/page.tsx`
- `apps/web/app/layout.tsx`
- `apps/web/app/styles.css`
- `apps/web/package.json`
- `apps/web/playwright.config.ts`
- `apps/web/e2e/homepage.spec.ts`
- `apps/web/e2e/no-sentry-network.spec.ts`
- `package.json`
- `docs/00-product-vision.md`
- `docs/08-architecture.md`
- `docs/09-brand-palette.md`
- `.context/architecture.md`
- `.context/Kaito AI Running Coach.zip` (`Kaito.dc.html`, reviewed as visual reference)

Observation: `.context/Kaito AI Running Coach.zip` does include a concrete login visual reference. Its login screen uses the same warm sand/off-white, forest green, golden accent, and mountain/trail composition documented in Kaito's product and brand docs. The background and motion direction therefore aligns with the product vision and should be treated as the preferred visual reference for this slice, with one important boundary: do not copy out-of-scope actions from the mockup, such as password recovery links, because the approved proposal/spec exclude password reset from this change.

## Current frontend baseline

`apps/web` is a small Next.js 16 / React 19 scaffold using the App Router. The current root page renders a scaffold hero and the global stylesheet defines warm sand/off-white styling that is already close to Kaito's palette. There is no existing frontend auth feature, no Supabase browser client dependency, and no reusable form component layer yet. Playwright exists for Chromium smoke tests, and root commands include `pnpm lint:web`, `pnpm build:web`, and `pnpm test:web-e2e`.

## Route and component structure

Use a route-grouped login page so the public URL stays simple while auth-specific code remains isolated:

```text
apps/web/
  app/
    (auth)/
      login/
        page.tsx              # route-level composition for /login
    styles.css                # global tokens and login page styles for this slice
  features/
    auth/
      login-form.tsx          # client component: fields, validation, submit state
      login-validation.ts     # pure validation helpers and types
      auth-client.ts          # frontend sign-in boundary and outcome mapping
      authenticated-handoff.ts# named post-login handoff abstraction
```

Design rules:

- `page.tsx` remains thin: layout copy, background shell, form placement, and injection of the sign-in/handoff boundaries.
- `login-form.tsx` is a client component because it owns field state, validation, pending state, and submit handling.
- Validation helpers stay pure so they can be tested without a browser.
- Auth provider details stay behind `auth-client.ts`; UI components consume Kaito-owned outcomes, not raw Supabase/provider errors.
- The route path is `/login`. The existing scaffold homepage may remain unchanged unless implementation chooses to update smoke-test expectations separately.

## Auth boundary and successful handoff

Introduce a small frontend boundary:

```ts
type SignInInput = { email: string; password: string };
type SignInOutcome =
  | { status: "success" }
  | { status: "invalid_credentials" }
  | { status: "system_error" };

type SignInWithPassword = (input: SignInInput) => Promise<SignInOutcome>;
```

Implementation may use Supabase Auth as the concrete adapter, but the form must not depend on Supabase SDK types or provider-specific messages. Missing browser auth configuration, network failures, unavailable services, and unexpected provider errors map to `system_error`. Credential rejections map to `invalid_credentials` only when the provider clearly reports an authentication rejection.

After `success`, call a named handoff abstraction such as `continueToAuthenticatedFlow(router)`. This boundary is intentionally the only place allowed to know the current authenticated entry path. It must not inspect onboarding/profile/dashboard state and must not implement route-guard policy. If the broader authenticated product flow is not available yet, the implementation should keep the behavior centralized and clearly temporary rather than embedding onboarding/dashboard choices in the login form.

## Validation and error-state model

Field state:

```ts
type LoginFieldErrors = {
  email?: "required" | "invalid_format";
  password?: "required";
};
```

Form state:

```ts
type LoginStatus =
  | "idle"
  | "submitting"
  | "invalid_credentials"
  | "system_error"
  | "authenticated_handoff";
```

Validation behavior:

- Trim email for validation and submission; preserve the visible entered email for correction.
- Required email/password validation runs before any auth call.
- Basic email validation should use a conservative shape check, not complex deliverability rules.
- Field-level validation errors clear or update as the user edits the affected field.
- Server/auth-level errors clear on the next submit attempt and may clear on edit to avoid stale feedback.
- Pending submissions are guarded with both disabled UI and an in-flight check so duplicate activation cannot start another sign-in attempt.

User-facing messages:

- Invalid credentials: generic, e.g. "We could not sign you in with that email and password. Check both fields and try again." Do not reveal whether the email exists.
- System error: separate wording, e.g. "Kaito could not reach the sign-in service right now. Try again in a moment or contact support if it continues." Do not expose secrets, stack traces, provider internals, or raw error payloads.

## Background and motion strategy

Use Kaito brand tokens from `docs/09-brand-palette.md`:

- Background: warm sand `#F5F0E6`
- Surface/card: off-white `#FFFDF8`
- Text: green-black `#17211B`
- Primary: forest green `#2F5D50` / deep green `#1F3D35`
- Accent: restrained orange/gold `#E8893A` / `#F2C36B`
- Error: earth red `#B84A3A`

Recommended composition:

- Use the `.context/Kaito AI Running Coach.zip` login screen as the primary visual reference for the first implementation pass.
- Full-viewport warm sand page with a soft diagonal sand gradient similar to the mockup.
- Centered login card around `max-width: 440px`, off-white surface, rounded corners, subtle border, and soft elevated shadow.
- Background depth should use CSS/SVG mountain layers in forest-green transparencies plus a restrained golden trail/path accent, matching the mockup's atmosphere.
- Preserve the compact Kaito brand header treatment: green rounded logo mark, mountain/sun icon language, Kaito wordmark, and short coach-oriented subtitle.
- Do not include the mockup's password recovery affordance in this slice; password reset is an explicit non-goal.
- Avoid image-heavy, futuristic, blue SaaS, aggressive gym, or anime-franchise-coded visuals.
- Any animation should be slow and decorative only: for example a subtle card fade-in, low-opacity path shimmer, or gentle background drift. It must never affect layout, form readability, validation, or submit behavior.

Guardrail: the form is the primary visual object. Background and motion must remain secondary to trust, legibility, and premium endurance-coaching calm.

## Accessibility and reduced motion

- Use real `<label>` elements or equivalent explicit associations for email and password.
- Use `type="email"`, `autoComplete="email"`, `type="password"`, and `autoComplete="current-password"`.
- Mark invalid fields with `aria-invalid` and connect help/error text with `aria-describedby`.
- Present form-level invalid-credential/system errors in a semantic alert or polite live region appropriate to the severity.
- Preserve logical keyboard order: email, password, submit.
- Ensure visible focus states with adequate contrast.
- Keep button disabled/pending state understandable visually and semantically.
- Respect `prefers-reduced-motion: reduce`: disable decorative animations and transitions that are not essential.
- Do not rely on color alone for validation or error meaning.

## Responsive behavior

- Mobile: single-column layout, form first, concise copy beneath or above the card, no horizontal overflow, comfortable touch targets.
- Tablet/desktop: allow a two-column composition where context copy and background depth support the form without competing with it.
- Use fluid spacing and `clamp()` typography rather than breakpoint-heavy layout.
- Login card width should remain readable, roughly `min(100%, 32rem)`, with optional `clamp(20rem, 92vw, 32rem)` sizing when a lower bound is useful.
- Background ornaments should be clipped or simplified on small screens.

## Testing strategy and expected commands

Because strict TDD is enabled and web runners exist, implementation should add tests before or with the UI code.

Recommended coverage:

- Pure validation tests for required email, invalid email shape, required password, and valid input.
- Auth outcome mapping tests that prove provider/auth failures become either `invalid_credentials` or `system_error` without leaking provider payloads.
- Playwright UI tests for `/login` covering:
  - labels and keyboard-reachable fields/actions;
  - required-field validation blocks auth calls;
  - invalid email validation blocks auth calls;
  - pending state prevents duplicate submissions;
  - generic invalid-credentials message;
  - separate system error message;
  - successful sign-in invokes the authenticated-flow handoff boundary.
- Reduced-motion behavior can be covered with a Playwright context emulating reduced motion and asserting no essential behavior depends on animation.

If E2E needs controlled auth outcomes, prefer a test-only mock adapter selected by an explicit non-production environment flag in Playwright, or network interception around the concrete auth endpoint. Do not require real Supabase accounts or backend auth contract changes for this UI slice.

Expected commands:

```bash
pnpm lint:web
pnpm build:web
pnpm test:web-e2e
```

Backend commands are not expected to be required by this frontend-only implementation unless implementation unexpectedly touches API files.

## Implementation constraints and non-goals

Constraints:

- Keep the change centered on `apps/web`.
- Keep technical artifacts in English.
- Keep auth provider details out of visual/form components.
- Preserve generic invalid-credentials wording.
- Separate technical/system failures from user-correctable credential failures.
- Do not introduce raw provider errors into the UI or telemetry payloads.
- Do not make animation required for comprehension or operation.
- Keep copy brief and coaching-oriented, not marketing-heavy.

Non-goals:

- Signup.
- Password recovery/reset.
- Magic links.
- Social auth.
- Demo access.
- Route guards for wider app areas.
- Onboarding-vs-dashboard routing decisions.
- Backend auth contract changes.
- Real end-to-end auth/domain integration.
- Broad redesign of the Kaito brand or landing experience.

## Rollout and rollback

Rollout should be a single frontend slice that adds the `/login` page and auth UI boundary. Since the route is additive, rollback is straightforward: remove the login route, auth feature files, and related tests/styles to return the app to the scaffold-only frontend state while preserving existing backend auth boundaries.
