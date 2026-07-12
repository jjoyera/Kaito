# Project Context — Kaito

Kaito is an AI coach web application for ultradistance runners, backed by a
modular monorepo architecture.

## Current state

- Repository now includes implementation scaffolding:
  - `apps/web`: Next.js 16 + React 19 + TypeScript.
  - `apps/api`: FastAPI + Python 3.12 with `uv` and `ruff`.
- Root workspace tooling uses `pnpm` workspaces for web-related scripts.
- CI exists at `.github/workflows/ci.yml` with scaffold validation for web and
  API.
- Product and TFM documentation remains primarily in Spanish under `docs/`.
- Technical SDD/OpenSpec artifacts should be written in English unless extending
  existing Spanish documentation.

## Frontend architecture convention

- `apps/web/app/` is Next.js routing/orchestration only; product logic belongs to `apps/web/features/<capability>/`.
- Auth uses `_components/`, `_adapters/`, `_use-cases/`, optional justified `_domain/`, and `_infrastructure/` for provider plumbing. Containers are optional only for genuine multi-concern orchestration.
- `shared/` promotion requires two distinct real feature consumers; multiple auth runtime callers still count as one feature. No speculative shared abstractions, generic utils/helpers, or empty future-feature folders.
- Current ownership keeps Supabase clients in `features/auth/_infrastructure/supabase/` and authenticated fetch in `features/auth/_adapters/`. The behavior-preserving underscore ownership refactor is complete; PR 2 is unstarted.

## SDD preferences

- Execution mode: interactive.
- Artifact store: both OpenSpec files and Engram memory.
- Chained PR strategy: ask always.
- Session review budget (current preflight): 400 changed lines.
- Strict TDD: enabled at config level (`strict_tdd: true`) for implementation
  changes with available runners.
- SDD sync must review the root `README.md` and update it when a completed
  flow changes project capabilities, setup/environment variables,
  architecture/runtime behavior, or developer verification commands. Keep root
  README updates concise and link to package-specific docs for details.

## OpenSpec state

- Active change: `protect-private-routes-user-session-flow`; PR 1A/1B primitives and the underscore ownership correction are complete in the worktree. This final-review fix batch keeps live successful-login handoff at `/`; PR 2 remains unstarted and requires separate authorization.
- Archived changes exist:
  - `2026-07-07-initial-project-scaffolding`
  - `2026-07-08-setup-playwright`
  - `2026-07-09-setup-supabase-auth-backend`
- Active specs directory exists at `openspec/specs/`.
- `setup-supabase-auth-backend` is archived at
  `openspec/changes/archive/2026-07-09-setup-supabase-auth-backend/`; no active
  change skeleton exists for it.
- New change skeleton initialization is expected to happen under
  `openspec/changes/<change-name>/`.
