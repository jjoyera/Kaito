# Proposal — Frontend Sentry Observability

Define the first frontend observability slice for the Next.js web app so future
implementation can capture actionable errors and performance signals across the
frontend runtime without collecting sensitive user or training data.

The goal is to introduce a clear product/engineering direction for Sentry in the
frontend, keep rollout environment-driven, and ensure the app remains fully
functional when Sentry is not configured.

## Assumption summary from proposal questions

- The primary objective is frontend error capture plus performance visibility,
  not broader analytics, session replay, or product-behavior tracking.
- Privacy should stay balanced: send useful technical context and non-sensitive
  metadata, but exclude identity, secrets, tokens, PII, and sensitive
  training/Strava/activity data.
- Scope covers the full Next.js frontend boundary in `apps/web`, including the
  browser/client runtime, server-side Next.js runtime where applicable, and
  global app error handling.
- Rollout must be controlled by environment variables. If no Sentry DSN is
  configured, nothing should be captured and builds must continue to work.
- This change is about observability readiness and safe defaults, not about
  building dashboards, on-call process, or backend/API observability.

## Intent

Adopt Sentry as the standard frontend observability path for the Next.js app so
Kaito can diagnose frontend failures and major performance issues earlier while
respecting data minimization expectations for a training-coach product.

## Scope

### In scope

- Proposal for Sentry-based observability in `apps/web`.
- Frontend coverage expectations for client/browser errors.
- Frontend coverage expectations for Next.js server/runtime errors where the web
  app owns the execution path.
- Global app error handling integration expectations.
- Environment-variable-driven enablement and no-DSN no-op behavior.
- Privacy and data-scrubbing expectations for frontend telemetry.
- Basic performance monitoring direction for frontend requests/navigation where
  Sentry supports it.
- Documentation/implementation expectations for safe rollout and validation.

### Out of scope

- Backend/API observability outside the Next.js frontend runtime boundary.
- Session replay, user behavior analytics, or marketing/product analytics.
- Alert routing, team ownership process, dashboards, or incident operations.
- Custom business-event instrumentation unrelated to errors/performance.
- Capturing sensitive athlete data, personal identity data, tokens, or secrets.

## Affected areas

- `apps/web` Next.js app configuration and dependencies.
- Client-side initialization path for browser error/performance capture.
- Server-side Next.js initialization/runtime path where supported.
- Global error boundary or app-level error handling files.
- Environment configuration and contributor documentation.
- Validation/build paths to confirm Sentry remains optional.

## Current-state gap

The repository currently has no standardized frontend observability path. When
frontend failures happen, diagnosis depends on local reproduction or ad hoc log
inspection, and there is no agreed-safe way to collect technical failure context
or performance signals without risking oversharing sensitive user/training data.

## Risks

- Misconfigured defaults could send data that is too detailed for the product's
  privacy expectations.
- Incomplete coverage could create false confidence if only one runtime path is
  instrumented.
- Optional integration can become fragile if build/runtime assumptions are not
  explicit for environments without a DSN.
- Performance instrumentation can add noise or overhead if not kept focused on
  actionable frontend signals.

## Rollback

- Remove Sentry dependencies and initialization/configuration from `apps/web` if
  the integration proves unstable, too noisy, or inconsistent with privacy
  expectations.
- Revert environment variable references and documentation if the project
  decides to defer frontend observability.
- Restore the prior no-observability state while keeping the app functional in
  all environments.

## Success criteria

- The proposal clearly defines Sentry as the frontend observability direction
  for `apps/web`.
- Follow-on implementation can cover client, applicable Next.js server/runtime,
  and global app error handling paths.
- The proposal establishes that telemetry must exclude identity, secrets,
  tokens, PII, and sensitive training/Strava/activity payloads.
- The proposal requires environment-driven enablement with a no-DSN no-op mode
  that does not break builds.
- The proposal keeps scope focused on errors and performance, not broader
  analytics or backend observability.

## Review notes

- Keep the first implementation slice small and centered on safe baseline
  observability.
- Prefer framework conventions and built-in Sentry/Next.js integration points
  over custom plumbing.
- Treat privacy filtering and optional-config behavior as first-class acceptance
  concerns, not follow-up polish.
- Keep the eventual implementation small enough to fit the session review budget
  or split follow-on work if needed.

## Next step

Wait for proposal approval before starting spec and/or design work for frontend
Sentry observability.
