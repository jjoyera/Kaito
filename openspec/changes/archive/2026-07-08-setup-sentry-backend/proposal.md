# Proposal: setup-sentry-backend

## Intent

Introduce baseline Sentry error tracking for the backend Python runtime so backend exceptions and request-level failures become observable before the Auth implementation phase starts. The observability boundary is Python backend code (mirroring how the web side is TypeScript-first rather than framework-first), not a specific web framework. FastAPI is only the current host/adapter where startup and the diagnostic route are mounted. This slice is meant to create a reviewable observability foundation without expanding into frontend or deployment work.

## Confirmed proposal assumptions

- The first slice is backend-only.
- Verification uses an explicit backend test/error route.
- Default sampling stays errors-only: traces and profiles default to `0.0` and remain opt-in.
- Invalid Sentry environment values should warn and continue with safe defaults.
- Documentation lives in `apps/api/README.md` and `apps/api/.env.example`.
- Frontend, root README, and wider deployment rollout are out of scope unless requested later.

## Scope

This proposal covers:

- Optional Sentry initialization in `apps/api`.
- Environment-based configuration that does not block local development when Sentry is not configured.
- Safe handling of optional Sentry sampling settings.
- A dedicated backend debug route that intentionally raises an error for setup verification.
- Backend-facing documentation and discoverable example environment configuration.

This proposal does not cover:

- Frontend Sentry changes.
- Production alerting policy, dashboards, or team notification routing.
- Broad deployment platform documentation.
- Performance/profiling rollout beyond opt-in configuration support.

## Affected areas

- `apps/api` backend Python application startup and configuration flow (currently hosted by FastAPI).
- Backend Python dependencies and lockfile.
- Backend environment example/configuration guidance.
- Backend developer documentation.
- Potential backend smoke/test coverage for health and debug behavior.

## Proposal details

### 1. Add optional backend Sentry bootstrap

The backend Python runtime should initialize Sentry only when `SENTRY_DSN` is present and non-empty. Sentry bootstrap and config parsing are framework-agnostic backend Python behavior, wired in wherever the current host application boots (today FastAPI). If the DSN is missing, the app should start normally with no Sentry dependency on local secrets.

### 2. Use safe, non-breaking environment parsing

Support standard backend Sentry environment variables for DSN, environment name, traces sample rate, and profiles sample rate. Invalid numeric values must not crash startup; the backend should continue with safe defaults and emit a warning signal suitable for developer troubleshooting.

### 3. Keep the first slice errors-focused

Default sampling posture should remain conservative:

- error capture enabled when DSN exists;
- traces sample rate default `0.0`;
- profiles sample rate default `0.0`.

This keeps observability useful without introducing unexpected local overhead or premature performance-data collection.

### 4. Add an explicit backend diagnostic route

Include a dedicated backend debug route that intentionally throws an exception so developers and reviewers can validate Sentry ingestion behavior end-to-end. The route is exposed through the current host adapter (today FastAPI, because the API host currently serves routes via FastAPI), but it is a host-adapter detail rather than the architectural integration boundary. This route exists for setup verification and should be clearly documented as a diagnostic mechanism.

### 5. Document configuration where backend contributors expect it

The change should make configuration discoverable through:

- `apps/api/README.md`
- `apps/api/.env.example`

Documentation should explain optional setup, local-safe behavior when env vars are absent, available Sentry variables, and how to use the debug route for verification.

## Expected outcome

After this change:

- backend exceptions can be sent to Sentry when configured;
- local development and CI continue working without production secrets;
- reviewers can validate the feature independently before Auth work begins;
- future backend feature PRs inherit baseline error observability.

## Risks

- **Config ambiguity**: inconsistent or undocumented env names could make setup error-prone.
- **Startup fragility**: unsafe parsing of numeric env values could break local runs or CI.
- **Debug route misuse**: an intentional error endpoint could be misunderstood if not clearly documented and scoped.
- **Scope creep**: this foundational task could drift into frontend or deployment observability work.

## Rollback

If the integration causes issues, rollback is straightforward:

- remove Sentry initialization from backend startup;
- remove the Sentry dependency/config references;
- remove the debug route and associated docs;
- revert to current backend behavior with no observability coupling.

Because the proposal is additive and DSN-gated, rollback risk is low.

## Success criteria

- The backend Python application starts and runs locally without requiring Sentry secrets (via the current FastAPI host).
- Missing optional Sentry environment variables do not break local development.
- Invalid sample-rate env values do not crash startup and fall back safely.
- Backend contributors can discover setup instructions in `apps/api/README.md` and `apps/api/.env.example`.
- A backend-only debug route exists to intentionally trigger an error for verification.
- The change remains reviewable as an independent pre-Auth infrastructure slice.
