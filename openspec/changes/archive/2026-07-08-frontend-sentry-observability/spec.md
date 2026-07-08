# Frontend Observability (Sentry) Specification

## Purpose

Establish a safe, environment-driven Sentry integration for the `apps/web`
Next.js application that captures frontend **errors and basic performance
signals only** across the full frontend boundary — browser/client, applicable
Next.js server and edge runtimes, request errors, and the app-level global error
boundary — while excluding session replay, profiling, product analytics, and any
sensitive, PII, auth, or training/activity payloads.

This spec defines WHAT must be true after the change. It is normative for the
first observability slice and is intended to be directly implementable and
verifiable by downstream tasks.

## Scope boundary

- In scope: frontend error capture and basic performance monitoring in
  `apps/web`; DSN-gated enablement; privacy scrubbing; conditional source-map
  build configuration; deterministic scrubber tests; automated no-DSN
  no-network validation.
- Out of scope (MUST NOT be introduced by this change): backend/API
  observability outside the Next.js frontend runtime boundary, session replay,
  profiling, user/product/marketing analytics, custom business-event
  instrumentation, alert routing, dashboards, and on-call/incident process.

## Requirements

### Requirement: Full frontend boundary coverage

The system SHALL provide Sentry error and basic performance capture across the
entire `apps/web` frontend boundary using Next.js framework conventions, so no
single-runtime instrumentation creates false confidence.

Coverage SHALL include:

- Browser/client runtime errors and navigation/transition performance.
- The applicable Next.js server runtime (Node) where the web app owns the
  execution path.
- The applicable Next.js edge runtime where the web app owns the execution path.
- Server-side request errors originating from server components and route
  handlers.
- The app-level global error boundary for root render crashes.

The integration SHALL use `@sentry/nextjs` and current Next.js file conventions
(client instrumentation, server/edge `register()` dispatch, request-error hook,
and an App Router global error boundary) rather than custom plumbing or legacy
config filenames.

#### Scenario: All frontend runtimes are instrumented

- GIVEN `apps/web` with a valid Sentry DSN configured
- WHEN an unhandled error occurs in the browser, in a server component / route
  handler, in an edge-runtime path, or as a root render crash
- THEN the corresponding runtime SHALL capture the error through the shared
  Sentry integration
- AND navigation/transition performance signals SHALL be captured for the client
  runtime when performance sampling is enabled

#### Scenario: Global error boundary captures root crashes

- GIVEN the App Router global error boundary is present
- WHEN a root render crash occurs
- THEN the boundary SHALL report the error to Sentry via `captureException`
- AND it SHALL render a minimal self-contained fallback (including its own
  `<html>` and `<body>` elements) without breaking the app shell

### Requirement: DSN-gated no-op behavior

The system SHALL treat Sentry as fully optional and controlled by environment
variables. When no Sentry DSN is configured, the application MUST behave exactly
as it does without Sentry.

When the DSN environment variable is unset or empty:

- `Sentry.init` MUST NOT be called on any runtime (client, server, edge).
- No events, transactions, or breadcrumbs MUST be captured.
- No Sentry ingestion/envelope/store network request MUST be attempted.
- Builds MUST continue to succeed with no Sentry-related failure or warning-fail.

Enablement MUST be driven only by environment configuration; there MUST be no
hard dependency on a DSN for the app or build to function.

#### Scenario: No DSN means no capture and no network calls

- GIVEN `apps/web` running with the Sentry DSN env var unset
- WHEN the app renders and a frontend error is triggered
- THEN `Sentry.init` SHALL NOT run on any runtime
- AND no Sentry ingestion/envelope/store network request SHALL be attempted
- AND the app SHALL render and behave identically to a build without Sentry

#### Scenario: Build succeeds without any Sentry configuration

- GIVEN no Sentry DSN and no source-map upload credentials are set
- WHEN `pnpm build:web` runs
- THEN the build SHALL succeed with no Sentry-related error, warning-fail, or
  source-map upload attempt

#### Scenario: Wiring activates when DSN is present

- GIVEN a valid Sentry DSN env var is set
- WHEN `pnpm build:web` runs and the app initializes
- THEN Sentry initialization SHALL run on the applicable runtimes and capture
  SHALL be active subject to the scrubbing and sampling requirements

### Requirement: Errors and basic performance only

The system SHALL limit telemetry to error capture and basic performance
monitoring. Replay, profiling, and analytics integrations MUST NOT be
registered.

- Performance sampling SHALL be low by default and overridable by environment
  configuration, defaulting to no sampling in development and a small sampling
  rate in production.
- Session replay integration MUST NOT be registered.
- Profiling integration MUST NOT be registered.
- Product/user/marketing analytics MUST NOT be collected.
- User identity enrichment (e.g. `Sentry.setUser`) MUST NOT be performed
  anywhere in this slice, and `sendDefaultPii` MUST be `false`.

#### Scenario: Only errors and basic performance are enabled

- GIVEN the Sentry integration is configured with a DSN
- WHEN the SDK initializes on any runtime
- THEN no replay, profiling, or analytics integration SHALL be registered
- AND no user identity SHALL be attached to events
- AND performance sampling SHALL respect the configured low/overridable rate

### Requirement: Centralized privacy scrubbing before send

The system SHALL apply centralized, conservative privacy scrubbing to every
outgoing event and transaction on all runtimes before it is sent to Sentry, so
telemetry never carries secrets, tokens, PII, Supabase/Strava auth data, or
sensitive training/activity/GPS payloads.

The scrubber SHALL:

- Process all events via `beforeSend` and all transactions via
  `beforeSendTransaction` on client, server, and edge runtimes.
- Strip request cookies, `Authorization` headers, and query strings.
- Normalize or redact `request.url`, transaction names, span descriptions, and
  route/path segments so dynamic identifiers are not sent, preferring route
  templates or a fixed placeholder for unknown dynamic paths.
- Redact values for any key matching a case-insensitive denylist across event
  `extra`, `contexts`, `request.data`, breadcrumb data, tags, span data, and
  transaction metadata. The denylist MUST include at least: token, secret,
  password, apikey/api_key, authorization, cookie, session, supabase, strava,
  access_token, refresh_token, jwt, bearer, email, phone, lat, lon, latitude,
  longitude, gps, coordinates, activity, workout, hr, heartrate, athlete.
- For free-form `extra`, breadcrumb messages, exception messages, and arbitrary
  `request.data`, keep only primitive technical fields that pass an explicit
  safe-key allowlist (at least: runtime, component, operation, statusCode,
  errorName, release, environment), and redact or drop everything else.
- Replace redacted values with a fixed placeholder and drop entire payload
  sections that cannot be safely reduced rather than forwarding them wholesale.
- Scrub message and exception values with pattern matching for bearer tokens,
  emails, URLs with query strings, long numeric identifiers, GPS-like
  coordinates, and long base64/JWT-like strings.

#### Scenario: Sensitive fields are redacted or dropped

- GIVEN an event or transaction containing tokens, Supabase/Strava auth fields,
  emails, GPS coordinates, activity/training fields, dynamic path segments,
  query strings, breadcrumb messages, or free-form `extra`/`request.data`
- WHEN the payload passes through the shared scrubber before send
- THEN denylisted and non-allowlisted values SHALL be redacted or dropped
- AND dynamic path segments and query strings SHALL be normalized or removed
- AND no cookies or `Authorization` headers SHALL remain on the payload

#### Scenario: Safe technical context is preserved

- GIVEN an event containing allowlisted primitive technical fields
  (e.g. runtime, component, operation, statusCode, errorName)
- WHEN the payload passes through the shared scrubber
- THEN those allowlisted technical fields SHALL be preserved to keep telemetry
  actionable

### Requirement: Conditional source-map build configuration

The system SHALL apply Sentry build-time configuration (including source-map
upload wrapping) only when the source-map upload credentials are complete. When
any credential is missing, the plain Next.js configuration MUST be used.

- The Next.js config SHALL wrap with Sentry only when all of `SENTRY_ORG`,
  `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` are present.
- When any of these are absent, the config MUST export the plain Next config so
  builds without secrets cannot attempt upload, warn-fail, or alter source-map
  behavior.
- When wrapping is active, Sentry build output SHALL be quiet, client file
  upload SHALL NOT be widened, and Sentry build telemetry SHALL be disabled.

#### Scenario: Source-map upload only with complete credentials

- GIVEN a build where one or more of `SENTRY_ORG`, `SENTRY_PROJECT`, or
  `SENTRY_AUTH_TOKEN` is missing
- WHEN the Next.js configuration is loaded and the build runs
- THEN the plain Next config SHALL be used and no source-map upload SHALL be
  attempted
- AND WHEN all three credentials are present, the Sentry wrapping SHALL be
  applied with quiet output, non-widened client upload, and disabled build
  telemetry

### Requirement: Deterministic scrubber tests and no-DSN network validation

The system SHALL include automated validation, in this slice, that proves the
privacy and no-op guarantees. These tests are acceptance-critical and MUST NOT
be deferred.

- A deterministic scrubber test SHALL assert that representative event and
  transaction payloads redact or drop: tokens, Supabase/Strava auth fields,
  emails, GPS coordinates, activity/training fields, dynamic path segments,
  query strings, breadcrumb messages, and free-form `extra`/`request.data`
  values, while preserving allowlisted technical fields.
- An automated no-DSN check SHALL confirm that, with the DSN env var unset, the
  app renders and no Sentry ingestion/envelope/store network request is
  attempted.
- Existing validation commands (`pnpm lint:web`, `pnpm build:web`,
  `pnpm test:web-e2e`) SHALL continue to pass, with lint clean and the E2E
  Chromium smoke unaffected by instrumentation.

#### Scenario: Deterministic scrubber test enforces privacy contract

- GIVEN the scrubber test suite for this slice
- WHEN it runs against representative payloads containing sensitive data
- THEN it SHALL assert that sensitive values are redacted or dropped and
  allowlisted technical fields are preserved
- AND the test SHALL be deterministic (no network, no external Sentry project)

#### Scenario: Automated no-DSN no-network validation

- GIVEN the DSN env var is unset in the validation environment
- WHEN the automated no-DSN check runs
- THEN it SHALL confirm the app renders successfully
- AND it SHALL confirm no Sentry ingestion/envelope/store network request is
  attempted

#### Scenario: Existing validation still passes

- GIVEN the instrumented `apps/web`
- WHEN `pnpm lint:web`, `pnpm build:web`, and `pnpm test:web-e2e` run
- THEN lint SHALL pass with no warnings, the build SHALL succeed without Sentry
  env vars, and the Playwright Chromium smoke SHALL still pass
