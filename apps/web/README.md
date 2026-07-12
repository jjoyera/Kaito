# Kaito web

## Contribution and ownership

- Keep `app/` limited to Next.js routes, layouts, loading/error, metadata, and route-policy wiring. Route pages import product features.
- Put real capabilities in `features/<capability>/`. Auth uses `_components/`, `_adapters/`, `_use-cases/`, `_infrastructure/`, and `_domain/` only for warranted pure rules/types.
- Add a feature container only for genuine multi-concern orchestration.
- Promote code to `shared/` only after two distinct real features consume it; multiple auth callers still count as one feature. Do not add speculative abstractions, generic utils/helpers, or empty feature folders.
- Supabase construction is owned by `features/auth/_infrastructure/supabase/`, and authenticated fetch is owned by `features/auth/_adapters/`. The underscore ownership move is complete.

See `docs/08-architecture.md` for the authoritative architecture.

## Supabase SSR cookie security

Supabase SSR owns session-cookie storage and rotation. Do not independently force `HttpOnly`, because supported browser flows may require browser-readable cookies. The root `proxy.ts` applies route policy only to `/login` and `/onboarding`; it refreshes the session, preserves refresh cookies, and forces `Secure` on response session cookies in production. Deploy production behind HTTPS. Refresh/provider failures emit only the stable `auth_session_resolution_failed` telemetry event, without provider details, tokens, or cookie values. CSP, output encoding, dependency hygiene, and XSS prevention remain required defenses.

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for production sign-in. They are public browser configuration, not service-role credentials; never expose access tokens, refresh tokens, JWT secrets, or `SUPABASE_SERVICE_ROLE_KEY`.

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
