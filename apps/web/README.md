# Kaito web

## Frontend observability (Sentry)

Sentry is optional for the Next.js frontend. When `NEXT_PUBLIC_SENTRY_DSN` is unset or empty, Sentry initialization is skipped in the client, server, and edge runtimes; the app should render normally and no Sentry ingestion requests should be made. The frontend integration does not add Next.js test pages or `app/api` routes; the production backend API remains the FastAPI app.

Optional variables are documented in `.env.example`:

- `NEXT_PUBLIC_SENTRY_DSN` enables capture.
- `NEXT_PUBLIC_SENTRY_ENVIRONMENT` labels events.
- `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` controls low-rate performance sampling.
- `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` enable source-map upload only when all three are present.

The integration captures errors and basic performance only. It does not enable replay, profiling, analytics, or user identity enrichment. Shared `beforeSend` and `beforeSendTransaction` hooks redact secrets, auth tokens, PII, Strava/Supabase values, GPS coordinates, and training/activity payloads before telemetry can leave the app.

Validation commands:

```bash
pnpm --filter web test:sentry-scrubbing
pnpm lint:web
pnpm build:web
pnpm test:web-docker-build
pnpm test:web-e2e
NEXT_PUBLIC_SENTRY_DSN=https://public@example.com/1 pnpm build:web
```

If Docker Compose starts an older web image or reports a missing copied file such as `apps/web/instrumentation.ts`, rebuild the local web image before starting it:

```bash
docker compose up --build web
```
