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

## SDD preferences

- Execution mode: interactive.
- Artifact store: both OpenSpec files and Engram memory.
- Chained PR strategy: ask always.
- Session review budget (current preflight): 400 changed lines.
- Strict TDD: currently disabled at config level (`strict_tdd: false`), but test
  validation hooks already exist and future implementation changes should tighten
  runner-backed test requirements.

## OpenSpec state

- Archived change exists: `2026-07-07-initial-project-scaffolding`.
- Active specs directory exists at `openspec/specs/`.
- New change skeleton initialization is expected to happen under
  `openspec/changes/<change-name>/`.
