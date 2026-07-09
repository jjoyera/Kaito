# Backend Observability (Sentry) Specification

## Purpose

Establish a safe, environment-driven Sentry integration for the `apps/api`
backend Python runtime that captures **backend errors and request-level failures
only** as the first backend observability slice. The architectural integration
boundary is Python backend code, not a specific web framework; FastAPI is only
the current host/adapter where startup and the diagnostic route are mounted. The
integration MUST be fully optional and DSN-gated so local development and CI
continue working without any production secrets, while giving reviewers a way to
validate ingestion end-to-end before the Auth implementation phase begins.

This spec defines WHAT must be true after the change. It is normative for the
first backend observability slice and is intended to be directly implementable
and verifiable by downstream tasks.

## Scope boundary

- In scope: backend Python error and request-level exception capture in
  `apps/api` (currently hosted by FastAPI); DSN-gated enablement; safe
  environment-variable parsing with fallback; errors-only default sampling
  posture; a backend diagnostic error route exposed through the current host
  adapter for verification; backend-facing documentation and discoverable
  example environment configuration.
- Out of scope (MUST NOT be introduced by this change): frontend/`apps/web`
  observability, root README or wider deployment/platform rollout
  documentation, production alerting policy, dashboards, on-call/incident
  routing, and any performance/profiling rollout beyond opt-in configuration
  support.

## Requirements

### Requirement: DSN-gated optional backend initialization

The system SHALL treat backend Sentry as fully optional and controlled by
environment variables. Sentry bootstrap and configuration parsing SHALL be
framework-agnostic backend Python behavior. Sentry SHALL be initialized only
when a Sentry DSN is present and non-empty; otherwise the backend MUST start and
behave exactly as it does without Sentry.

- When the DSN environment variable is unset or empty, Sentry initialization
  MUST NOT run and no Sentry ingestion network request MUST be attempted.
- The backend Python application MUST import and start successfully whether or
  not the DSN is configured, with no hard dependency on any Sentry secret
  (verified today through the current FastAPI host).
- When a non-empty DSN is present, Sentry initialization SHALL run during
  application startup so backend exceptions and request-level errors can be
  reported.

#### Scenario: No DSN means no initialization and no network calls

- GIVEN `apps/api` running with the Sentry DSN environment variable unset or
  empty
- WHEN the application starts and a backend exception is raised
- THEN Sentry initialization SHALL NOT run
- AND no Sentry ingestion network request SHALL be attempted
- AND the application SHALL behave identically to a build without Sentry

#### Scenario: Initialization activates when DSN is present

- GIVEN a non-empty Sentry DSN environment variable is set
- WHEN the application starts
- THEN Sentry initialization SHALL run during startup
- AND backend exceptions and request-level errors SHALL be reported to Sentry
  subject to the sampling requirements

### Requirement: No-secret local development and CI

The system SHALL ensure that local development, existing smoke checks, and CI
continue to work without requiring any production Sentry secrets, and that
missing optional Sentry environment variables never break the backend.

- The existing import smoke check (`uv run python -c "from app.main import
  app"`) SHALL continue to succeed with Sentry code present and all optional
  Sentry variables absent.
- The `/health` endpoint SHALL remain responsive and return its healthy status
  both with and without Sentry initialized.
- Absence of any optional Sentry environment variable
  (`SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE`,
  `SENTRY_PROFILES_SAMPLE_RATE`) MUST NOT cause startup failure; documented safe
  defaults SHALL be used instead.

#### Scenario: App imports and health responds without secrets

- GIVEN no Sentry environment variables are configured
- WHEN `uv run python -c "from app.main import app"` runs and the `/health`
  endpoint is called
- THEN the import SHALL succeed
- AND `/health` SHALL return its healthy status

#### Scenario: Missing optional env vars use safe defaults

- GIVEN a DSN is set but `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE`, and
  `SENTRY_PROFILES_SAMPLE_RATE` are unset
- WHEN the application starts
- THEN startup SHALL succeed
- AND the documented safe defaults SHALL be applied for the missing variables

### Requirement: Safe numeric environment parsing with warning and fallback

The system SHALL parse numeric Sentry configuration values defensively. Invalid
numeric values MUST NOT crash startup; the backend SHALL fall back to the safe
default and emit a warning signal suitable for developer troubleshooting.

- `SENTRY_TRACES_SAMPLE_RATE` and `SENTRY_PROFILES_SAMPLE_RATE` SHALL be parsed
  as floats.
- When a value cannot be parsed as a valid float, the backend MUST continue
  startup using the safe default (`0.0`) for that setting.
- When a fallback occurs due to an invalid value, the backend SHALL emit a
  warning that identifies the offending variable so developers can correct the
  configuration.

#### Scenario: Invalid sample-rate value warns and falls back

- GIVEN `SENTRY_TRACES_SAMPLE_RATE=invalid` (or a similarly non-numeric value)
- WHEN the application starts
- THEN startup SHALL NOT crash
- AND the traces sample rate SHALL fall back to `0.0`
- AND a warning identifying the offending variable SHALL be emitted

### Requirement: Graceful degradation on malformed DSN

The system SHALL handle a non-empty but malformed `SENTRY_DSN` value gracefully so
that application import and startup never fail due to an invalid DSN string.

- When `SENTRY_DSN` is non-empty but cannot be parsed as a valid Sentry DSN, the
  backend MUST log an ERROR-level message identifying the failure and continue
  startup with Sentry disabled.
- The application MUST remain importable and the `/health` endpoint MUST remain
  responsive regardless of the DSN value.

#### Scenario: Malformed DSN logs error and continues

- GIVEN `SENTRY_DSN` is set to a non-empty string that is not a valid Sentry DSN
  URL
- WHEN the application starts
- THEN startup SHALL NOT raise an exception
- AND an ERROR-level log message SHALL be emitted identifying the failure
- AND Sentry SHALL be treated as disabled for the remainder of the session
- AND `/health` SHALL return its healthy status

### Requirement: Errors-only default sampling posture

The system SHALL keep the first backend slice conservative and errors-focused so
observability is useful without introducing unexpected local overhead or
premature performance-data collection.

- Error capture SHALL be enabled when a DSN is present.
- The traces sample rate SHALL default to `0.0`.
- The profiles sample rate SHALL default to `0.0`.
- Trace and profile sampling SHALL remain opt-in via environment configuration.

#### Scenario: Defaults capture errors only

- GIVEN a non-empty DSN is configured and no sample-rate variables are set
- WHEN the application starts
- THEN error capture SHALL be active
- AND the traces sample rate SHALL be `0.0`
- AND the profiles sample rate SHALL be `0.0`

#### Scenario: Performance sampling is opt-in

- GIVEN a non-empty DSN and a valid `SENTRY_TRACES_SAMPLE_RATE` greater than
  `0.0`
- WHEN the application starts
- THEN the configured traces sample rate SHALL be applied instead of the default

### Requirement: Backend diagnostic error route

The system SHALL provide a dedicated backend route that intentionally raises an
exception so developers and reviewers can validate Sentry ingestion behavior
end-to-end. The route is exposed through the current host adapter (today
FastAPI, because the API host currently serves routes via FastAPI), which is a
host-adapter detail rather than the architectural integration boundary. The
route exists solely for setup verification and SHALL be clearly documented as a
diagnostic mechanism.

- The route SHALL be registered **only** when the environment variable
  `ENABLE_DEBUG_SENTRY=true` is set at application startup. When the flag is
  absent or has any other value, the route MUST NOT be registered and requests
  to it MUST return 404.
- The route SHALL raise an unhandled exception when invoked.
- When a DSN is configured, invoking the route SHALL result in the error being
  reported to Sentry through the backend Python runtime integration mounted on
  the current host adapter.
- When no DSN is configured, invoking the route SHALL raise the exception
  without attempting any Sentry ingestion network request.

#### Scenario: Diagnostic route not available when flag is absent

- GIVEN the backend is running without `ENABLE_DEBUG_SENTRY=true`
- WHEN a request is made to the diagnostic debug route
- THEN the response SHALL be 404 (route not registered)

#### Scenario: Diagnostic route triggers an error when explicitly enabled

- GIVEN the backend is running with `ENABLE_DEBUG_SENTRY=true`
- WHEN the diagnostic debug route is invoked
- THEN the route SHALL raise an unhandled exception
- AND WHEN a DSN is configured, the exception SHALL be reported to Sentry
- AND WHEN no DSN is configured, no Sentry ingestion network request SHALL be
  attempted

### Requirement: Discoverable backend configuration and documentation

The system SHALL make backend Sentry configuration discoverable where backend
contributors expect it, without documenting frontend, root README, or wider
deployment rollout concerns.

- `apps/api/.env.example` SHALL list all supported environment variables
  (`SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE`,
  `SENTRY_PROFILES_SAMPLE_RATE`, `ENABLE_DEBUG_SENTRY`) with
  placeholder/default guidance.
- `apps/api/README.md` SHALL document the optional setup, the local-safe
  behavior when variables are absent, the available variables, how to use
  `--env-file` or export to load the `.env` file (the server does not
  load it automatically), and how to use the diagnostic route for verification.
- Documentation SHALL make clear that the diagnostic error route is a
  verification mechanism, not a general-purpose endpoint, and requires
  `ENABLE_DEBUG_SENTRY=true` to be registered.

#### Scenario: Contributor discovers backend Sentry setup

- GIVEN a backend contributor inspecting `apps/api`
- WHEN they open `apps/api/.env.example` and `apps/api/README.md`
- THEN they SHALL find the supported Sentry variables with default/placeholder
  guidance
- AND they SHALL find instructions for optional setup, local-safe behavior, and
  using the diagnostic route for verification
