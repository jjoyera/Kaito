# Tasks — Frontend Sentry Observability

Change: `frontend-sentry-observability`  
Scope: `apps/web` Next.js frontend Sentry integration only

## Review Workload Forecast

| Field | Value |
| ------- | ------- |
| Estimated changed lines | ~430–650 including lockfile; ~330–470 hand-written |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: dependency/config + shared scrubber + deterministic scrubber test → PR 2: runtime instrumentation + global error boundary + no-DSN E2E/docs |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Medium

## Implementation Tasks

### PR 1 candidate — dependency, config foundation, and privacy gate

- [x] Add Sentry and lightweight scrubber-test tooling in `apps/web/package.json` and update `pnpm-lock.yaml`: add `@sentry/nextjs`, add a deterministic script `test:sentry-scrubbing` using the lightest compatible runner (planned exact command: `pnpm --filter web test:sentry-scrubbing`, preferably backed by `tsx --test lib/sentry-scrubbing.test.ts`).
- [x] Update root `package.json` only if needed to expose a convenience command (planned exact command: `pnpm test:web-sentry-scrubbing` delegating to `pnpm --filter web test:sentry-scrubbing`).
- [x] Modify `apps/web/next.config.mjs` so `withSentryConfig` wraps the plain Next config only when `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` are all present; otherwise export the plain config with no source-map upload attempt. When enabled, configure quiet output, no widened client upload, and disabled Sentry build telemetry.
- [x] Create `apps/web/lib/sentry-scrubbing.ts` with shared `beforeSend` and `beforeSendTransaction` helpers, safe env/sample-rate helpers if useful, `sendDefaultPii: false`-compatible options, denylist redaction, safe-key allowlisting, URL/query/path normalization, message/exception/breadcrumb scrubbing, and fixed `"[redacted]"` placeholders.
- [x] Create `apps/web/lib/sentry-scrubbing.test.ts` (RED first, then GREEN) covering representative event and transaction payloads with tokens, Supabase/Strava auth fields, emails, GPS coordinates, activity/training fields, dynamic path segments, query strings, breadcrumb messages, and free-form `extra` / `request.data`; assert allowlisted technical fields (`runtime`, `component`, `operation`, `statusCode`, `errorName`, `release`, `environment`) are preserved.
- [x] Run and record PR 1 acceptance checks: `pnpm --filter web test:sentry-scrubbing`, `pnpm lint:web`, and `pnpm build:web` with all Sentry env vars unset.

### PR 2 candidate — runtime coverage, no-DSN validation, and docs

- [x] Create `apps/web/instrumentation-client.ts` to initialize `@sentry/nextjs` only when `NEXT_PUBLIC_SENTRY_DSN` is non-empty, wire shared `beforeSend` / `beforeSendTransaction`, set low env-overridable tracing, avoid replay/profiling/analytics/user identity, and export `onRouterTransitionStart` for navigation performance.
- [x] Create `apps/web/sentry.server.config.ts` for Node runtime initialization with the same DSN gate, scrubbing hooks, low sampling, and no PII/replay/profiling/user identity.
- [x] Create `apps/web/sentry.edge.config.ts` for edge runtime initialization with the same DSN gate, scrubbing hooks, low sampling, and no PII/replay/profiling/user identity.
- [x] Create `apps/web/instrumentation.ts` with `register()` dispatching by `process.env.NEXT_RUNTIME` to the server or edge config only when appropriate, and re-export `onRequestError` through Sentry request-error capture.
- [x] Create `apps/web/app/global-error.tsx` as a client App Router global error boundary that calls `Sentry.captureException(error)` and renders a minimal fallback including its own `<html>` and `<body>` elements.
- [x] Add automated no-DSN no-network validation under `apps/web/e2e/` (for example `apps/web/e2e/no-sentry-network.spec.ts`) that unsets `NEXT_PUBLIC_SENTRY_DSN`, renders the app, fails if any Sentry ingestion/envelope/store request is attempted, and remains covered by `pnpm test:web-e2e`.
- [x] Add `apps/web/.env.example` documenting optional Sentry variables: `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_ENVIRONMENT`, `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN`.
- [x] Add or update `apps/web/README.md` (or the nearest existing contributor doc if no README exists) with a short “Frontend observability (Sentry)” section covering no-DSN no-op behavior, optional source-map credentials, privacy exclusions, and validation commands.
- [x] Verify no forbidden telemetry features were introduced by searching changed `apps/web` files for `replayIntegration`, profiling integrations, analytics/user tracking, and `Sentry.setUser`; remove any occurrence unless it is in tests/docs asserting absence.
- [x] Run and record final acceptance checks with Sentry env vars unset: `pnpm --filter web test:sentry-scrubbing`, `pnpm lint:web`, `pnpm build:web`, and `pnpm test:web-e2e`.
- [x] Run and record wiring check with a dummy non-empty `NEXT_PUBLIC_SENTRY_DSN` and no source-map credentials: `NEXT_PUBLIC_SENTRY_DSN=https://public@example.com/1 pnpm build:web`; confirm build succeeds and source-map upload is skipped.
- [x] Add Docker web image validation (`pnpm test:web-docker-build`) so CI/local checks rebuild the Compose `web` image and assert Sentry instrumentation files are present inside the image, catching stale-image or missing-copy/package issues before `docker compose up`.

## Rollback Boundaries

- [x] PR 1 rollback: revert `apps/web/package.json`, `pnpm-lock.yaml`, `apps/web/next.config.mjs`, and `apps/web/lib/sentry-scrubbing*`; app returns to current no-Sentry build configuration.
- [x] PR 2 rollback: remove instrumentation files, global error boundary, no-DSN E2E test, env example, and docs; if PR 1 remains, Sentry dependency/scrubber code is inert until wiring is reintroduced.

## Required Validation Command Set

- `pnpm --filter web test:sentry-scrubbing`
- `pnpm lint:web`
- `pnpm build:web`
- `pnpm test:web-docker-build`
- `pnpm test:web-e2e`
- `NEXT_PUBLIC_SENTRY_DSN=https://public@example.com/1 pnpm build:web`
