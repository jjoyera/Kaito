# Verify Report — Frontend Sentry Observability

Change: `frontend-sentry-observability`  
Project: `Kaito`  
Verified: 2026-07-08  
Status: **PASS**

## Executive summary

Verification passed for the completed frontend Sentry observability slice. Follow-up product correction removed the temporary production-visible Next.js Sentry test page/API route; current no-DSN E2E validation uses normal app boot/render only. The OpenSpec artifacts, implementation files, deterministic scrubber tests, lint, and builds are consistent with the approved specification/design/tasks. No unchecked implementation task checkboxes remain.

A diagnostic helper command reported by the parent (`lens_diagnostics`) is not installed in this executor shell, so it could not be rerun here; parent-supplied evidence says it passed after final fixes. All repository-native validation commands required by the tasks/spec were rerun and passed.

## Structured status and actionContext findings

- Active change: `frontend-sentry-observability` — present and unambiguous.
- Artifact store: `both`; OpenSpec directory present and authoritative. Engram artifacts were also found for spec/tasks/apply-progress.
- Action context: interactive verify only; no sync/archive run.
- Allowed output root: `openspec/changes/frontend-sentry-observability/verify-report.md` created/updated.
- Implementation ownership: changed implementation is within `apps/web` frontend boundary plus expected monorepo support files (`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, CI scrubber command, docs/OpenSpec artifacts).
- Strict TDD: inactive (`openspec/config.yaml` has `sdd.strict_tdd: false`). Acceptance-critical privacy/no-DSN evidence exists.

## Spec coverage

| Requirement | Finding |
| --- | --- |
| Full frontend boundary coverage | Covered by `instrumentation-client.ts`, `instrumentation.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, request-error hook, and `app/global-error.tsx`. |
| DSN-gated no-op behavior | Covered. Runtime init/capture paths check trimmed `NEXT_PUBLIC_SENTRY_DSN`; no-DSN build and Playwright normal-boot no-network test passed. |
| Errors and basic performance only | Covered. `sendDefaultPii: false`, low/env-overridable traces sampling, no replay/profiling/analytics/setUser occurrences outside README exclusion text. |
| Centralized privacy scrubbing before send | Covered by shared `beforeSend` / `beforeSendTransaction`, denylist/allowlist behavior, header/cookie/query/user stripping, URL/path/message/span/breadcrumb/free-form scrubbing, and deterministic tests. |
| Conditional source-map build configuration | Covered. `next.config.mjs` wraps with Sentry only when trimmed `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` are all present; otherwise exports plain config. No-credential builds passed. |
| Deterministic scrubber tests and no-DSN network validation | Covered. `pnpm --filter web test:sentry-scrubbing` passed; `env -u NEXT_PUBLIC_SENTRY_DSN pnpm test:web-e2e` passed, including no Sentry ingestion request assertion during normal app boot/render. |

## Task completion status

Unchecked implementation task markers matching `^\s*- \[ \]`: **none found** in `openspec/changes/frontend-sentry-observability/tasks.md`.

All implementation and rollback-boundary checklist items are checked.

## Strict TDD compliance

Strict TDD is not active for this project/change (`strict_tdd: false`). Verification still checked the acceptance-critical evidence:

- `apply-progress.md` contains a `TDD Cycle Evidence` table.
- Reported scrubber and no-DSN test files exist in the codebase.
- Relevant tests were rerun and are GREEN.
- Assertion quality reviewed for changed tests: scrubber tests assert concrete redaction/drop/preservation behavior and no-DSN E2E asserts zero Sentry ingestion requests during normal app boot/render. No production-visible Next.js test API/page route remains.

## Review workload / PR boundary

Tasks forecast chained PRs and medium budget risk; parent/user accepted single-PR delivery for now. Scope stayed within the approved frontend Sentry observability slice. Lockfile churn is large, but hand-written changes remain focused on the documented PR 1/PR 2 boundaries. No scope-creep blocker found.

## Validation commands rerun

- `pnpm --filter web test:sentry-scrubbing` — PASS.
- `pnpm lint:web` — PASS.
- `env -u NEXT_PUBLIC_SENTRY_DSN -u SENTRY_ORG -u SENTRY_PROJECT -u SENTRY_AUTH_TOKEN pnpm build:web` — PASS.
- `NEXT_PUBLIC_SENTRY_DSN=https://public@example.com/1 pnpm build:web` — PASS.
- `env -u NEXT_PUBLIC_SENTRY_DSN pnpm test:web-e2e` — PASS.
- `lens_diagnostics mode=all severity=error` — FAILED to execute in this verifier shell: `/bin/bash: línea 1: lens_diagnostics: orden no encontrada` (exit 127). Not treated as implementation blocker because this tool is not available to the executor and parent supplied final PASS evidence.

Additional checks:

- `grep -R` equivalent for unchecked task boxes — no matches.
- Forbidden telemetry grep for `replayIntegration|profiling|analytics|Sentry\.setUser|setUser|replay|profilesSampleRate|sendDefaultPii` under `apps/web` — only `sendDefaultPii: false` in code and README text documenting excluded replay/profiling/analytics.

## Risks / notes

- Minor generated `apps/web/next-env.d.ts` route-reference churn was observed during verification and reverted by the parent after the report was generated.
- Large `pnpm-lock.yaml` churn increases review load but is expected from adding `@sentry/nextjs` and tooling.

## Exact blockers

None.

---

## Follow-up product correction verification — 2026-07-08

Status: **PASS** for removal of production-visible Next.js Sentry test routes.

- Removed temporary `/sentry-no-dsn-test` page and `/api/sentry-no-dsn-test` route; build route output now lists only `/` and `/_not-found`.
- Removed unused test-route gating helpers and Playwright test-route env flags.
- No-DSN E2E now asserts normal app boot/render creates no Sentry ingestion/envelope/store network requests.
- Required commands rerun and passed:
  - `pnpm --filter web test:sentry-scrubbing` — PASS (4 tests).
  - `pnpm lint:web` — PASS.
  - `env -u NEXT_PUBLIC_SENTRY_DSN -u SENTRY_ORG -u SENTRY_PROJECT -u SENTRY_AUTH_TOKEN pnpm build:web` — PASS.
  - `NEXT_PUBLIC_SENTRY_DSN=https://public@example.com/1 pnpm build:web` — PASS.
  - `env -u NEXT_PUBLIC_SENTRY_DSN pnpm test:web-e2e` — PASS (2 Chromium tests).

---

## Follow-up Docker image validation — 2026-07-08

Status: **PASS** for adding stale-image / missing-copy validation.

- Added `pnpm test:web-docker-build` at the repository root.
- CI web job now runs the Docker validation after `pnpm build:web`.
- The validation rebuilds the Compose `web` image and asserts `apps/web/instrumentation.ts` and `apps/web/instrumentation-client.ts` are present inside the built image.
- No Next.js app/api test routes were reintroduced; backend API remains FastAPI.
- Required follow-up commands run:
  - `pnpm lint:web` — PASS.
  - `pnpm test:web-docker-build` — PASS.

Risk: the CI step assumes Docker Compose is available on `ubuntu-latest` GitHub Actions runners.

---

## Post-archive E2E hardening verification — 2026-07-08

Status: **PASS** for no-DSN E2E hardening after archive.

Corrective hardening was applied after the archive to ensure the no-DSN Playwright validation cannot reuse a developer server that was started with a real Sentry DSN and cannot leak synthetic validation errors to a real Sentry project:

- `apps/web/playwright.config.ts` sets `webServer.reuseExistingServer: false` and forces `NEXT_PUBLIC_SENTRY_DSN: ""` for the Playwright-managed web server.
- `apps/web/e2e/no-sentry-network.spec.ts` intercepts Sentry ingestion/envelope/store URLs, aborts any attempted request, records the URL, and still fails the test if any such request is attempted.
- The test triggers both a browser `ErrorEvent` and an unhandled promise rejection while the DSN is unset, preserving validation of the no-capture path without requiring production-visible test routes.

Validation evidence supplied by the parent after the hardening:

- `env -u NEXT_PUBLIC_SENTRY_DSN pnpm test:web-e2e` — PASS.
- `pnpm lint:web` — PASS.
- `lens_diagnostics mode=all severity=error` — PASS.

No canonical spec requirement change was needed: the existing requirement already states that automated no-DSN validation must confirm no Sentry ingestion/envelope/store request is attempted. This hardening strengthens the implementation validation for that requirement.
