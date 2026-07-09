# Proposal — build-login-ui

## Intent

Deliver the first real login experience for Kaito so registered runners can authenticate with email and password and continue into the authenticated product flow, without deciding post-login onboarding vs. dashboard routing in this slice.

## Why now

Kaito's MVP requires email/password access before onboarding, plan generation, and dashboard flows can be validated. The repository already has backend identity verification boundaries, but the web app still exposes only a scaffold page, leaving the MVP entry flow incomplete and hard to demo or explain.

## Proposal summary

Create a dedicated web login UI aligned with Kaito's product vision: calm, clear, premium, and mountain-coach oriented. The page should support email/password sign-in, local field validation, loading and submission states, a generic invalid-credentials message, and a distinct technical/system error state when authentication cannot complete for non-user reasons.

The visual direction should lean on the warm outdoor palette already documented for Kaito and should reuse the strongest approved `.context` inspiration for background depth and restrained animation. However, any final background or motion treatment must remain secondary to clarity, readability, and trust; if the `.context` aesthetic becomes too decorative, too futuristic, too blue-SaaS, or too detached from the mountain/endurance-coaching brand, that conflict must be treated as a product risk rather than silently adopted.

## In scope

- A login route/screen for the web app.
- Email and password inputs for existing-user sign-in.
- Local validation for required fields and basic email format before submission.
- Submission/loading state that prevents duplicate sign-in attempts.
- User-facing authentication failure handling with generic invalid-credentials messaging.
- Separate technical/system error presentation when the auth service or network fails.
- Brief support/context copy consistent with a premium endurance-coaching product.
- Visual treatment for the login screen, including background composition and subtle motion, validated against Kaito brand and product docs.
- Successful-authentication handoff into the authenticated app flow, without deciding the downstream destination in this change.

## Out of scope

- Signup, password reset, magic links, social auth, or demo-user access.
- Onboarding-vs-dashboard routing decisions after successful login.
- Authenticated product pages beyond the handoff boundary.
- New backend auth contracts or changes to API identity verification rules.
- Marketing-heavy landing copy or broader brand redesign.

## Product assumptions confirmed

- Post-login routing only needs to hand off into the authenticated flow.
- Demo access is future work.
- Validation is local first, with generic credential failure messaging and separate technical/system error treatment when necessary.
- The desired tone is calm, minimal, and premium for endurance coaching.
- Support copy should stay brief.

## Affected areas

- `apps/web/app`: new login route and page-level composition.
- `apps/web/features/auth`: sign-in form behavior, validation, and state handling.
- `apps/web/components` and styling assets: reusable form, feedback, and background/motion primitives if needed.
- Frontend auth integration boundary with Supabase client/session handling.
- Web E2E and UI validation coverage for the login flow.
- Documentation/status tracking for the OpenSpec change.

## UX and content direction

- The login page should feel welcoming but disciplined: more coach than marketing site.
- The background should carry atmosphere and brand identity without competing with the form.
- Motion should be subtle, slow, and supportive of the premium feel; it should never reduce readability or make the screen feel like generic AI/futuristic UI.
- Copy should reinforce continuity and guidance for runners, not sales language.

## Key risks

1. **Visual-direction drift from product vision.** The preferred `.context` background/animation ideas may conflict with Kaito's defined brand if they become too ornamental, too abstract, or insufficiently outdoors/endurance-oriented.
2. **Premature routing coupling.** The login slice could overreach into onboarding/dashboard decision logic that the user explicitly deferred.
3. **Error-state ambiguity.** Mixing invalid-credential feedback with network/configuration failures would create a confusing support experience.
4. **Auth readiness dependency.** The UI can be proposed independently, but implementation depends on the chosen frontend auth integration being available and aligned with the existing backend/Supabase direction.

## Mitigation approach

- Keep the success path limited to authenticated handoff, with downstream routing deferred.
- Separate user-correctable auth failures from system-level failures in the UI contract.
- Validate background and motion concepts against `docs/00-product-vision.md`, `docs/09-brand-palette.md`, and the MVP login role defined in `docs/08-architecture.md` before implementation.
- Favor progressive enhancement: the page should remain clear and usable even if motion is reduced or disabled.

## Rollback

If the login UI introduces unacceptable brand, UX, or auth-integration issues, revert the new login route and related frontend auth presentation to return the web app to its current scaffold-only state while preserving backend auth boundaries already in place.

## Success criteria

- The repository has an approved proposal for a Kaito-branded login UI slice.
- Scope clearly limits the change to existing-user login and authenticated-flow handoff.
- Validation and error handling expectations are explicit enough to guide spec/design without reopening product ambiguity.
- The proposal documents the need to reuse `.context` visual inspiration while explicitly checking for conflicts with Kaito's product vision and brand palette.
- Affected areas, risks, rollback, and expected outcome are clear enough to support the next SDD phases.
