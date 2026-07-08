# Artifacts — frontend-sentry-observability

## Created in init

- `README.md` — change skeleton and scope boundary.
- `artifacts.md` — artifact index for this change.

## Proposal phase

- `proposal.md` — created in proposal phase.

## Design phase

- `design.md` — created in design phase. Sentry frontend integration design for
  `apps/web` (client/server/edge + global error boundary), DSN-gated no-op
  rollout, centralized privacy scrubbing, errors + basic performance only.

## Spec phase

- `spec.md` — created in spec phase. Full new-domain spec for frontend
  observability (Sentry): full frontend-boundary coverage, DSN-gated no-op,
  centralized privacy scrubbing, errors + basic performance only, conditional
  source-map build config, and deterministic scrubber + no-DSN no-network
  validation. Topic key `sdd/frontend-sentry-observability/spec`.

## Tasks phase

- `tasks.md` — created in tasks phase. Concrete implementation checklist for frontend Sentry observability in `apps/web`, including workload forecast, proposed PR split, dependency/config wiring, client/server/edge instrumentation, global error boundary, centralized scrubber, deterministic scrubber test, no-DSN no-network validation, docs/env example, rollback boundaries, and validation commands. Topic key `sdd/frontend-sentry-observability/tasks`.

## Verify phase

- `verify-report.md` — created in verify phase. Verification report showing the implemented frontend Sentry observability slice satisfies proposal/design/spec/tasks, with validation evidence and no exact blockers. Topic key `sdd/frontend-sentry-observability/verify-report`.

## Sync phase

- `sync-report.md` — updated in sync phase. Filesystem canonical sync completed after adding the domain spec layout; `openspec/specs/frontend-observability/spec.md` was created from `openspec/changes/frontend-sentry-observability/specs/frontend-observability/spec.md`. Topic key `sdd/frontend-sentry-observability/sync-report`.
- `../../specs/frontend-observability/spec.md` — canonical frontend observability spec created by sync; the active change remains unarchived.

## Repository context observed during init

- Project: Kaito.
- Frontend app: `apps/web` using Next.js 16, React 19, and TypeScript.
- Package manager: pnpm workspace (`pnpm@11.0.0`).
- Current validation commands include:
  - `pnpm lint:web`
  - `pnpm build:web`
  - `pnpm test:web-e2e`
- SDD config: interactive mode, artifact store `both`, strict TDD currently `false` at config level.
- Session override: review budget is 400 changed lines.

## Domain spec layout

- `specs/frontend-observability/spec.md` — domain-layout copy of the normative spec used by sync/archive tooling.

## Post-archive corrective sync

- `verify-report.md` — appended post-archive no-DSN E2E hardening evidence for `reuseExistingServer: false`, Sentry ingestion route interception/abort behavior, and parent-supplied passing validation.
- `sync-report.md` — appended corrective sync entry confirming the canonical `frontend-observability` spec remains unchanged after validation hardening.
- `archive-report.md` — appended note that the archived path remains authoritative after corrective sync.
