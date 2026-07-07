# Design — Initial project scaffolding

This design turns the approved scaffold proposal/spec into concrete
implementation choices. It fixes tooling versions, minimal app shapes, the
`/health` contract, Docker/CI intent, and the Spanish README model so the tasks
phase can proceed without re-deciding fundamentals.

Product/domain concerns stay out of scope.

## Quick path

1. Root monorepo: `pnpm` workspace for JS/TS members, `uv` for the Python API.
2. `apps/web`: minimal Next.js App Router app with one page.
3. `apps/api`: minimal FastAPI app exposing `GET /health`.
4. `packages/api-client`: metadata and README only.
5. `docker/` plus root `compose.yaml`: `web` and `api` services only.
6. `.github/workflows/ci.yml`: install plus lint/build/smoke-script/smoke validation.
7. Spanish root `README.md` as living document with a future-update rule.

## Tooling decisions

- Node version: Node 24.18 LTS, pinned via `.nvmrc` and root
  `engines.node: ">=24.18 <25"`.
  - Rationale: current LTS requested by the project and predictable across
    contributors and CI.
- Package manager: `pnpm` 11, pinned via the root `package.json`
  `packageManager` field.
  - Rationale: current workspace tooling requested by the project.
- Workspace members: `apps/web` and `packages/api-client` only.
  - Rationale: `apps/api` is Python and stays outside the pnpm graph.
- Python version: Python 3.12, pinned via `.python-version` and
  `requires-python = ">=3.12"`.
  - Rationale: modern stable Python with strong FastAPI/Pydantic v2 support.
- Python environment and dependencies: `uv` inside `apps/api`, using
  `pyproject.toml` and `uv.lock`.
  - Rationale: fast, reproducible, and isolated from JS/TS tooling.
- Frontend lint: Next.js built-in ESLint integration.
  - Rationale: minimal extra configuration for the first slice.
- Python lint/format: `ruff` as the only Python quality tool.
  - Rationale: one fast tool; no test runner is introduced yet.

The split model keeps the first polyglot scaffold simple and honest: pnpm owns
JS/TS packages, while `uv` owns the Python API.

## Web app: `apps/web`

Decisions:

- Framework: Next.js App Router with TypeScript.
- Shape: minimal app without extra `src/` structure.
- Page: one static page that states the Kaito scaffold is running.
- Dependencies: only `next`, `react`, `react-dom`, and required types.
- Dev path: `pnpm --filter web dev` plus root alias `pnpm dev:web`.
- CI validation: `pnpm --filter web build`.
- Exclusions: auth, onboarding, dashboard, training flows, API calls, and UI
  libraries.

## API app: `apps/api`

Decisions:

- Framework: FastAPI plus Uvicorn.
- Shape: minimal single app module at `apps/api/app/main.py`.
- Endpoint: `GET /health` only, plus framework defaults such as `/docs`.
- Response: HTTP `200` with JSON body `{"status": "ok"}`.
- Dev path: `uv run uvicorn app.main:app --reload` from `apps/api`.
- Exclusions: domain modules, persistence, SQLAlchemy, auth, AI, JWT, and
  Pydantic domain models.

Frozen `/health` contract for this slice:

```http
GET /health -> 200
Content-Type: application/json
{"status": "ok"}
```

Later slices may extend the body additively, for example with `version`, but must
not remove the `status` field.

## Reserved package: `packages/api-client`

Decisions:

- Contents: private `package.json` and `README.md` only.
- Name: private scoped package, for example `@kaito/api-client`.
- Status: explicitly documented as reserved, not a committed API contract.
- Code: no generated client, no OpenAPI output, and no runtime exports.

The package README must state that the package will later hold a generated client
from the API OpenAPI schema, but currently exports nothing.

## Root scripts strategy

Provide a thin root `package.json` script layer so contributors have one obvious
entry point. Do not introduce Turborepo, Make, or another task runner yet.

Root scripts:

- `pnpm dev:web`: start the Next.js dev server.
- `pnpm build:web`: build the web app for CI validation.
- `pnpm lint:web`: run the web lint check.

API instructions stay documented as direct `uv` invocations from `apps/api`:

- `uv sync`: install API dependencies.
- `uv run uvicorn app.main:app --reload`: run the API locally.
- `uv run ruff check .`: run Python lint validation.

Rationale: keep the first slice small, explicit, and understandable.

## Docker design: local convenience only

Files:

- `docker/web.Dockerfile`
- `docker/api.Dockerfile`
- root `compose.yaml`

Decisions:

- Compose services: `web` and `api` only.
- No backing services: no Postgres, Redis, broker, or data volumes.
- Purpose: local developer convenience, machine portability, and environment
  documentation.
- Not in scope: production deployment, CD, image publishing, or hardening.
- Web container: runs the Next.js dev server on a mapped local port.
- API container: runs Uvicorn and exposes `/health` on a mapped local port.
- Marker: compose file includes a header comment stating it is local-only.

## CI design: basic validation only

Create one `.github/workflows/ci.yml`, triggered on pull requests and pushes.

Jobs:

- `web`: set up Node 24.18 and pnpm 11, run `pnpm install`, `pnpm lint:web`,
  `pnpm build:web`, `pnpm test:web-smoke-script`, and `pnpm smoke:web`.
- `api`: set up Python 3.12 and `uv`, run `uv sync`, `uv run ruff check .`, and
  a smoke import/load check for the FastAPI app.

Explicitly excluded:

- real product test suites;
- deployment;
- publishing;
- Docker image push;
- release automation;
- continuous delivery.

CI proves that the scaffold installs and the minimal applications build or load.

## Spanish README content model

The root `README.md` is Spanish and is the living entry point.

Required sections:

- `Visión general`: what Kaito is and the current scaffold state.
- `Stack tecnológico`: Next.js, FastAPI, pnpm, uv, and local Docker.
- `Instalación`: `pnpm install` and `uv sync` in `apps/api`.
- `Ejecución`: how to run web, API, and Docker Compose locally.
- `Estructura del proyecto`: monorepo tree and the role of each boundary.
- `Funcionalidades actuales`: minimal page and API `/health` endpoint.
- `Regla de actualización`: future changes that alter structure, execution
  instructions, or available functionality must update the README in the same
  change.

## Review workload and chained PR plan

Target: keep implementation reviewable against the 600 changed-line budget.
Approximate hand-authored footprint, excluding lockfiles:

- Root workspace config and scripts: about 40 lines.
- Minimal `apps/web`: about 80 lines.
- Minimal `apps/api`: about 60 lines.
- `packages/api-client` placeholder: about 30 lines.
- Docker assets: about 70 lines.
- CI workflow: about 60 lines.
- Spanish README: about 120 lines.

The all-in estimate is about 460 hand-authored lines plus generated lockfiles,
so a single PR is acceptable under the updated 600-line review budget.
Optional chained split if review load grows during tasks:

1. PR 1 — foundation: root workspace config, `apps/web`, `apps/api` `/health`,
   and `packages/api-client` placeholder.
2. PR 2 — tooling and docs: Docker, CI workflow, and Spanish README living
   document.

Rationale: PR 1 delivers runnable boundaries reviewers can verify locally. PR 2
adds convenience, validation, and documentation. This split is no longer required
by the current estimate, but remains available if tasks reveal extra scope.

## Decisions summary for tasks phase

- Node 24.18 LTS and pnpm 11.
- Python 3.12 and uv.
- Web: Next.js App Router, one static page.
- API: FastAPI `/health` returns `{"status": "ok"}`.
- `api-client`: metadata and README only.
- Docker/compose: web and API only, local-only.
- CI: install plus lint/build/smoke-script/smoke/load, no product tests, no CD.
- README: Spanish, with mandatory future-update rule.
- Single PR is acceptable under the 600-line budget; split only if tasks reveal
  extra scope.

## Next step

Proceed to the tasks phase after user approval. The tasks phase should break
these decisions into ordered implementation tasks and confirm the chained-PR
split before any apply work.
