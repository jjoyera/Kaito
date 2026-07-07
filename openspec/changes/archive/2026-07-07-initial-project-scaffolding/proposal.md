# Proposal — Initial project scaffolding

Define the first runnable monorepo scaffold for Kaito.

The goal is that contributors can understand repo boundaries, start the web and
API locally, and verify a basic CI path without introducing product features or
infrastructure that belongs to later slices.

## Quick path

1. Establish the root monorepo structure and workspace/tooling conventions.
2. Add minimal runnable boundaries for `apps/web` (Next.js) and `apps/api`
   (FastAPI `/health`).
3. Add baseline local-dev support (`docker/`, root compose) and basic CI
   validation.
4. Update the Spanish root `README.md` as part of the definition of done.

## Assumption summary from proposal questions

- Day-one success is, in order: clear repo boundaries, easy local execution for
  web/API, then basic CI.
- CI should stay at install/lint/build-level validation only; no real tests yet.
- `packages/api-client` should exist only as a reserved shared boundary with
  minimal placeholder metadata.
- Docker is for local developer convenience, portability, documentation, and
  future packaging, not deployment/CD.
- Future slices that change scaffolded areas must update the Spanish root
  `README.md` when structure, commands, or available functionality change.

## Intent

Create the smallest useful implementation-oriented scaffold that turns the
repository from documentation-only into a clearly structured monorepo foundation
aligned with the planned Next.js + FastAPI architecture.

## Scope

### In scope

- Root monorepo conventions, directory structure, and `pnpm` workspace planning.
- `apps/web` as the frontend boundary with a minimal runnable Next.js app.
- `apps/api` as the backend boundary with a minimal runnable FastAPI app exposing
  `/health`.
- `packages/api-client` as a reserved future shared package with placeholder
  metadata/docs only.
- `docker/` assets plus a root compose file for `web` and `api` only.
- `.github/workflows/ci.yml` with basic validation only.
- Spanish root `README.md` updates documenting structure, commands, and current
  capabilities.

### Out of scope

- Supabase Auth.
- PostgreSQL, local DB wiring, SQLAlchemy, Alembic.
- Strava, AI/RAG, onboarding, domain workflows, or training-plan logic.
- Real deployment, hosting, or CD flows.
- A real shared API contract inside `packages/api-client`.
- Production-grade observability, security hardening, or scaling concerns.

## Affected areas

- Repository root: introduce monorepo conventions and contributor guidance.
- `apps/web`: add a minimal runnable Next.js frontend boundary.
- `apps/api`: add a minimal runnable FastAPI boundary with `/health`.
- `packages/api-client`: reserve a shared package boundary without an API
  contract.
- Docker: provide local container orchestration for `web` and `api` only.
- CI: run only basic setup and validation checks for the first slice.
- Documentation: make the Spanish root `README.md` the living entry point.

## Current-state gap

The repository currently describes the target architecture but does not yet
provide source boundaries, local startup paths, or CI structure. This makes the
intended monorepo shape hard to validate and increases ambiguity for future
implementation slices.

## Risks

- Tooling setup may overfit future needs if too much convention is introduced in
  the first slice.
- Creating Docker and CI too early could add maintenance burden if they exceed
  the minimal local-validation goal.
- A placeholder `packages/api-client` could be mistaken for a committed contract
  unless clearly documented as reserved only.
- README drift remains a risk unless future slices consistently treat
  documentation updates as required work.

## Rollback

- Remove the initial scaffold directories and workflow if the chosen structure
  proves wrong before feature development starts.
- Keep architectural intent in OpenSpec/docs while reverting runnable code and
  tooling assets.
- Preserve README guidance only if it still reflects the remaining repository
  state; otherwise revert those updates too.

## Success criteria

- Contributors can identify the intended monorepo boundaries at a glance.
- Contributors can run the minimal web and API apps locally through documented
  commands.
- The API exposes a working `/health` endpoint.
- Basic CI validates the scaffold without requiring real tests.
- Docker assets support local convenience for `web` and `api` without implying
  deployment readiness.
- The Spanish root `README.md` accurately documents structure, commands, and the
  rule that future scaffold changes must update it.

## Review notes

- Review this proposal first for scope discipline: it should establish
  boundaries and runnable basics only.
- Treat database/auth/domain features as explicitly deferred.
- Keep the eventual implementation slice small enough to respect the 600
  changed-line review budget; split only if scope grows during tasks/apply.

## Next step

Wait for proposal approval before starting spec and/or design work for the
scaffold change.
