# Project Context — Kaito

Kaito is currently a documentation-first repository for an AI coach web
application focused on ultradistance running.

## Current state

- No application source code, package manifest, CI workflow, or test runner is
  present yet.
- Product and TFM documentation is primarily in Spanish under `docs/`.
- Technical SDD/OpenSpec artifacts should be written in English unless they
  extend existing Spanish documentation.
- The target architecture documented in `docs/08-architecture.md` is a modular
  monorepo with `apps/web` (Next.js) and `apps/api` (FastAPI).

## SDD preferences

- Execution mode: interactive.
- Artifact store: both OpenSpec files and Engram memory.
- Chained PR strategy: ask always.
- Review budget: 400 changed lines.
- Strict TDD: disabled only until the scaffolding change introduces concrete
  test runners.

## Change initialized

- Change name: `initial-project-scaffolding`.
- Goal: define initial monorepo project scaffolding, including README-as-living
  document requirements.
- This init phase does not implement scaffolding and does not create proposal,
  spec, design, or tasks content.
