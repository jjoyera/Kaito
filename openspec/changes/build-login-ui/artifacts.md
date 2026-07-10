# Artifacts — build-login-ui

Artifact index and status tracking for the `build-login-ui` OpenSpec change.

## Phase status

| Phase | Status | Artifact |
| --- | --- | --- |
| init | ✅ complete | `README.md`, `artifacts.md` |
| proposal | ✅ complete | `proposal.md` |
| spec | ✅ complete | `specs/web-login-ui/spec.md` |
| design | ✅ complete | `design.md` |
| tasks | ✅ complete | `tasks.md` |
| apply | in progress — PR 1 complete | `apply-progress.md` |
| verify | pending — blocked until chained PRs complete | not created |
| sync | pending | not created |

## Project context read during init

- Project config: `openspec/config.yaml`
- Project context: `openspec/project-context.md`
- Change path verified as absent before creation: `openspec/changes/build-login-ui/`

## Proposal inputs reviewed

- `openspec/project-context.md`
- `docs/00-product-vision.md`
- `docs/08-architecture.md`
- `docs/09-brand-palette.md`
- `apps/web/app/page.tsx`
- `apps/web/app/styles.css`
- `apps/api/README.md`
- `.context/architecture.md`
- `.context/Kaito AI Running Coach.zip` (`Kaito.dc.html` visual reference)
- `openspec/changes/build-login-ui/README.md`

## Relevant current validation commands

- `pnpm lint:web`
- `pnpm build:web`
- `pnpm test:web-auth`
- `pnpm test:web-e2e`
- `cd apps/api && uv run ruff check .`
- `cd apps/api && uv run python -c "from app.main import app"`

## Apply status

- PR 1 — Auth contracts and unit-level tests: ✅ complete.
- PR 1 validation completed: `pnpm test:web-auth`, `pnpm lint:web`, `pnpm build:web`.
- PR 2 — Functional `/login` UI and E2E behavior: pending.
- PR 3 — Visual polish, accessibility, and reduced-motion hardening: pending.
