# Project Context — Kaito

Kaito is an AI coach web application for ultradistance runners, backed by a
modular monorepo architecture.

## Current state

- Repository now includes implementation scaffolding:
  - `apps/web`: Next.js 16 + React 19 + TypeScript.
  - `apps/api`: FastAPI + Python 3.12 with `uv` and `ruff`.
- Root workspace tooling uses `pnpm` workspaces for web-related scripts.
- CI exists at `.github/workflows/ci.yml` with web contract/E2E validation, API
  tests, and a local Supabase RLS integration proof.
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
- Chained PR strategy: single PR by default.
- Session review budget (current preflight): 2,500 changed lines.
- Current Issue #21 PR 2 is one maintainer-approved PR capped at 2,500 authored
  changed lines. Historical PR 1 retains its former 400-line evidence only.
- Strict TDD: enabled at config level (`strict_tdd: true`) for implementation
  changes with available runners.
- SDD sync must review the root `README.md` and update it when a completed
  flow changes project capabilities, setup/environment variables,
  architecture/runtime behavior, or developer verification commands. Keep root
  README updates concise and link to package-specific docs for details.

## OpenSpec state

- Active change: `implement-onboarding-persistence-rls` for Issue #21.
- The active change already contains proposal, exploration, delta spec, design,
  tasks, and apply-progress artifacts; initialization must not overwrite them.
- Archived changes remain under `openspec/changes/archive/` as the audit trail.
- Active specs directory exists at `openspec/specs/`.
- New change skeleton initialization is expected to happen under
  `openspec/changes/<change-name>/`.

## Testing capabilities

- Unit/contract: Node.js test runner through `tsx` for web contracts and
  `pytest` for API/domain behavior.
- Integration: FastAPI `TestClient`, SQLAlchemy/database tests, and a local
  Supabase-backed onboarding RLS proof.
- E2E: Playwright Chromium against both development and production Next.js
  servers.
- Quality: ESLint, Ruff, Next.js build/type checking, and Pyright configuration;
  no standalone Python type-check command or formatter is configured.
- Coverage: no reporter, command, or threshold is configured.
- Local preflight: `uv 0.9.24` is available; pnpm 11 is available through
  Corepack, but the active Node.js `v22.22.2` does not satisfy the repository's
  declared `>=24.18 <25` range, so web verification requires switching Node.
