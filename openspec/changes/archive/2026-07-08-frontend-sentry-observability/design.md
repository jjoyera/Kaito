# Design — Frontend Sentry Observability

Change: `frontend-sentry-observability`
Scope owner: `apps/web` (Next.js 16, React 19, App Router)
Status: design (proposal approved)

## 1. Objective and boundaries

Introduce a safe, environment-driven Sentry integration for the Next.js web app
that captures **errors and basic performance signals only** across the full
frontend boundary (browser/client, Next.js server + edge runtimes, and the
app-level global error boundary), while excluding session replay, analytics, and
any sensitive/PII/auth/training payloads.

Non-goals (unchanged from proposal): backend/API observability, session replay,
product analytics, alerting/on-call process, custom business instrumentation.

## 2. Current state (verified in repo)

- `apps/web` App Router with `app/layout.tsx` + `app/page.tsx` only.
- No `instrumentation.ts`, no `error.tsx`/`global-error.tsx`, no Sentry deps.
- `next.config.mjs` exports an empty `nextConfig`.
- No `.env*` files present in `apps/web`.
- Validation commands: `pnpm lint:web`, `pnpm build:web`, `pnpm test:web-e2e`.
- No frontend unit-test runner; E2E is Playwright Chromium smoke only.

## 3. Key decisions

### D1 — Use `@sentry/nextjs` with framework conventions

Adopt the official SDK and its Next.js integration points rather than custom
plumbing (per proposal review notes). This covers client, server, and edge
runtimes plus request-error capture and source-map wiring through one package.

### D2 — Next.js 16 file conventions (not legacy `sentry.client.config.ts`)

Next.js 15.3+/16 loads client instrumentation from `instrumentation-client.ts`
and server/edge instrumentation via `instrumentation.ts` `register()`. We use:

- `apps/web/instrumentation-client.ts` — browser init + `onRouterTransitionStart`
  export for navigation performance.
- `apps/web/instrumentation.ts` — `register()` dispatch by `NEXT_RUNTIME` and
  re-export of `onRequestError` (captures server component / route errors).
- `apps/web/sentry.server.config.ts` — Node runtime init.
- `apps/web/sentry.edge.config.ts` — edge runtime init.

### D3 — Enablement is DSN-gated (no-op by default)

Init runs only when the DSN env var is present. With no DSN, `Sentry.init` is
skipped so nothing is captured and the app/build behaves exactly as today. This
is the primary acceptance guarantee ("no DSN → no capture, build still works").

- Client DSN: `NEXT_PUBLIC_SENTRY_DSN` (must be public to reach the browser).
- Server/edge DSN: reuse `NEXT_PUBLIC_SENTRY_DSN` (single project) for a minimal
  first slice; a separate `SENTRY_DSN` may be added later if projects diverge.
- Environment/label: `NEXT_PUBLIC_SENTRY_ENVIRONMENT` (fallback `NODE_ENV`).

### D4 — Errors + basic performance only; replay/analytics off

- `tracesSampleRate` set low and env-overridable via
  `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` (default `0` in dev, small default in
  prod, e.g. `0.1`). No `replayIntegration`, no profiling, no user analytics.
- No `Sentry.setUser` / identity enrichment anywhere in this slice.

### D5 — Centralized privacy scrubbing (`beforeSend` + `beforeSendTransaction`)

A single shared module implements defensive scrubbing applied on all runtimes so
telemetry never carries secrets/PII/auth/training data. The scrubber must be
conservative: allow useful technical metadata, but redact or drop free-form data
that cannot be proven safe.

- `sendDefaultPii: false`.
- Strip request cookies, `Authorization` headers, and query strings.
- Normalize or redact `request.url`, transaction names, span descriptions, and
  route/path segments so dynamic identifiers are not sent. Prefer route templates
  or a fixed placeholder such as `"[redacted-path]"` for unknown dynamic paths.
- Redact any key matching a denylist (case-insensitive) in event `extra`,
  `contexts`, `request.data`, breadcrumb data, tags, span data, and transaction
  metadata:
  token, secret, password, apikey/api_key, authorization, cookie, session,
  supabase, strava, access_token, refresh_token, jwt, bearer, email, phone,
  lat, lon, latitude, longitude, gps, coordinates, activity, workout, hr,
  heartrate, athlete.
- For free-form `extra`, breadcrumb messages, exception messages, and arbitrary
  `request.data`, keep only primitive technical fields that pass an explicit
  safe-key allowlist (`runtime`, `component`, `operation`, `statusCode`,
  `errorName`, `release`, `environment`). Redact or drop everything else.
- Redacted values are replaced with `"[redacted]"`; whole payload sections are
  dropped if they cannot be safely reduced.
- Scrub message/exception values with regex for bearer tokens, emails, URLs with
  query strings, long numeric identifiers, GPS-like coordinates, and long
  base64/JWT-like strings.

### D6 — `next.config.mjs` wraps with Sentry only when build config is complete

Conditionally apply `withSentryConfig` only when source-map upload credentials
are complete (`SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`). When any are
absent, export the plain Next config so CI/local builds without secrets cannot
attempt upload, warn-fail, or alter source-map behavior. When wrapping is active,
set `silent: true`, `widenClientFileUpload: false`, and disable Sentry telemetry.

### D7 — Global error boundary

Add `apps/web/app/global-error.tsx` (client component) that calls
`Sentry.captureException(error)` and renders a minimal fallback. Because this is
an App Router global error boundary, the fallback must include its own `<html>`
and `<body>` tags.

## 4. File-change plan (target ≤ ~400 changed lines)

New files (small, mostly boilerplate):

1. `apps/web/instrumentation-client.ts` — client init + router transition hook.
2. `apps/web/instrumentation.ts` — `register()` + `onRequestError`.
3. `apps/web/sentry.server.config.ts` — Node init.
4. `apps/web/sentry.edge.config.ts` — edge init.
5. `apps/web/lib/sentry-scrubbing.ts` — shared denylist/allowlist +
   `beforeSend`/`beforeSendTransaction` helpers (the only non-trivial logic).
6. `apps/web/lib/sentry-scrubbing.test.ts` — deterministic scrubber tests using
   the lightest available runner approach selected during implementation.
7. `apps/web/app/global-error.tsx` — global error boundary.
8. `apps/web/.env.example` — documented Sentry env vars, all optional.

Modified files:
9. `apps/web/next.config.mjs` — conditionally wrap with `withSentryConfig` only
   when source-map upload credentials are complete.
10. `apps/web/package.json` — add `@sentry/nextjs` dependency and, if needed, the
    smallest deterministic scrubber test command.
11. Root `pnpm-lock.yaml` — lockfile update (generated).
12. Docs: short "Frontend observability (Sentry)" section in `apps/web`
    README or contributor docs describing env vars and no-DSN behavior.

Estimated hand-written lines (excluding lockfile): ~300–380. Fits the 400-line
review budget as a single slice if the scrubber test remains focused. If the
scrubber or test runner setup pushes the implementation beyond the budget, split
scrubber tests into a separate review slice before broadening observability.

## 5. Data flow

```
Browser error / navigation
  → instrumentation-client.ts init (if NEXT_PUBLIC_SENTRY_DSN)
    → beforeSend/beforeSendTransaction (scrubbing) → Sentry ingest

Server component / route handler error
  → instrumentation.ts onRequestError → captureRequestError
    → server/edge init beforeSend (scrubbing) → Sentry ingest

Root render crash
  → app/global-error.tsx → Sentry.captureException → scrubbing → ingest

No DSN present → init skipped → zero Sentry network calls, no capture
```

## 6. Contracts

### Environment variables (all optional)

| Var | Runtime | Purpose | Default when unset |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SENTRY_DSN` | client/server/edge | enable capture | disabled (no-op) |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | all | env label | `NODE_ENV` |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | all | perf sampling | `0` dev / `0.1` prod |
| `SENTRY_ORG` | build | source-map upload | upload skipped |
| `SENTRY_PROJECT` | build | source-map upload | upload skipped |
| `SENTRY_AUTH_TOKEN` | build | source-map upload | upload skipped |

### Behavioral contract

- No DSN → `Sentry.init` not called; no events, no transactions, no Sentry
  network calls, no build break.
- Replay/analytics integrations never registered.
- Every outgoing event/transaction passes through the shared scrubber before send.
- Free-form event sections are allowlisted, redacted, or dropped; they are never
  forwarded wholesale.
- No user identity/PII enrichment.

## 7. Validation strategy

- `pnpm lint:web` — must pass with `--max-warnings=0`; new files ESLint-clean.
- `pnpm build:web` — must succeed **without** any Sentry env vars set
  (proves no-DSN/no-auth build works) and **with** DSN set (proves wiring).
- `pnpm test:web-e2e` — existing Chromium smoke must still pass (app renders,
  no runtime regression from instrumentation).
- Add a deterministic scrubber test command for this slice, using the lightest
  project-compatible option available at implementation time. It must assert that
  representative Sentry event/transaction payloads redact or drop tokens,
  Supabase/Strava auth fields, emails, GPS coordinates, activity/training fields,
  dynamic path segments, query strings, breadcrumb messages, and free-form
  `extra` / `request.data` values.
- Add or extend an automated no-DSN check in E2E/build validation so the app can
  render without Sentry config and no Sentry envelope/store network request is
  attempted when `NEXT_PUBLIC_SENTRY_DSN` is unset.
- Manual/dev check remains useful but is not sufficient for acceptance: with a
  DSN set, throwing a test error in dev confirms an event arrives; inspect it to
  confirm real project-side filtering matches local scrubber expectations.

## 8. Risks and mitigations

- **Over-collection / privacy leak** → centralized allowlist/denylist scrubber
  (D5), `sendDefaultPii:false`, no `setUser`, and deterministic scrubber tests;
  treated as acceptance-critical.
- **Build fragility without config** → DSN-gated init + conditional Sentry config
  wrapping/source-map upload (D3/D6); build validated with no env vars.
- **Partial coverage / false confidence** → instrument client + server + edge +
  global-error in the same slice (D2/D7).
- **Perf noise/overhead** → low default `tracesSampleRate`, no profiling/replay.
- **Next.js 16 convention drift** → use `instrumentation-client.ts` /
  `instrumentation.ts` per current SDK docs, not legacy config filenames.

## 9. Rollback

Remove the eight new files, revert `next.config.mjs`, drop the `@sentry/nextjs`
dependency, and remove documented env vars. App returns to prior
no-observability state with no residual behavior change.

## 10. Follow-on / out of this slice

- Separate `SENTRY_DSN` for server if projects diverge.
- Broader scrubber unit coverage once a permanent frontend unit-test runner lands. The acceptance-critical deterministic scrubber tests in this slice must not be deferred.
- Dashboards, alerting, backend/API observability (explicitly out of scope).
