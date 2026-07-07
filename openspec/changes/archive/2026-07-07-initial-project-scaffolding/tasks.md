# Tasks — Initial project scaffolding

Implementation checklist for `initial-project-scaffolding`.

Scope is initial scaffolding only:

- runnable monorepo boundaries;
- local developer tooling;
- basic CI validation;
- Spanish root README updates.

Do not add product/domain implementation.

## Review workload forecast

- Estimated changed lines: about 500–600 hand-authored lines, plus lockfiles if
  generated.
- Configured review budget: 600 changed lines.
- Chained PRs recommended: no.
- Suggested split: single PR.
- Fallback split if scope grows: PR 1 foundation, then PR 2 tooling/docs.
- Delivery strategy: `single-pr`.
- Chain strategy: `size-exception`.

Decision needed before apply: no.

Review workload note: current plan is a single PR under the configured 600-line
review budget. Pause and reconsider a split before implementation continues if
apply expands beyond this scaffold or makes the diff likely to exceed 600
changed lines.

## Work units

### 1. Root monorepo configuration

- [x] Add `.nvmrc` with Node `24.18`.
- [x] Add `.python-version` with Python `3.12`.
- [x] Add root `package.json` with:
  - [x] `private: true`.
  - [x] `packageManager` pinned to pnpm 11.
  - [x] `engines.node` set to `>=24.18 <25`.
  - [x] workspace declaration for `apps/web` and `packages/api-client` only.
  - [x] scripts: `dev:web`, `build:web`, and `lint:web`.
- [x] Add `pnpm-workspace.yaml` with only `apps/web` and
  `packages/api-client` members.
- [x] Verify the Python API is not configured as a pnpm workspace member.

### 2. Minimal Next.js web app in `apps/web`

- [x] Create `apps/web/package.json` with private package metadata and minimal
  Next.js scripts: `dev`, `build`, and `lint`.
- [x] Add minimal Next.js App Router files under `apps/web/`:
  - [x] `apps/web/app/layout.tsx`.
  - [x] `apps/web/app/page.tsx` with a simple scaffold-running message only.
  - [x] `apps/web/next.config.*` if required by the chosen Next.js version.
  - [x] `apps/web/tsconfig.json`.
  - [x] `apps/web/eslint.config.*` or equivalent supported lint config.
- [x] Keep `apps/web` free of auth, onboarding, dashboards, training flows,
  API calls, UI libraries, and domain logic.
- [x] Verification: after install, `pnpm dev:web` starts the app and the
  default page renders.
- [x] Verification: `pnpm lint:web` and `pnpm build:web` complete
  successfully.

### 3. Minimal FastAPI API in `apps/api`

- [x] Create `apps/api/pyproject.toml` with Python `>=3.12`, dependencies for
  FastAPI/Uvicorn, and ruff configuration.
- [x] Generate or update `apps/api/uv.lock` through `uv sync` during apply.
- [x] Create `apps/api/app/main.py` with a minimal FastAPI app and only
  `GET /health` returning exactly `{"status":"ok"}`.
- [x] Add `apps/api/app/__init__.py` if needed for package import/load checks.
- [x] Keep `apps/api` free of persistence, SQLAlchemy, Alembic, auth, JWT,
  Strava, AI/RAG, onboarding, domain workflows, and training-plan logic.
- [x] Verification: from `apps/api`, `uv sync` completes.
- [x] Verification: from `apps/api`, `uv run ruff check .` completes.
- [x] Verification: from `apps/api`, the FastAPI app imports successfully:

  ```bash
  uv run python -c "from app.main import app; print(app.title)"
  ```

- [x] Verification: from `apps/api`, Uvicorn starts locally and `GET /health`
  returns HTTP 200 with `{"status":"ok"}`.

### 4. Reserved `packages/api-client` placeholder

- [x] Create `packages/api-client/package.json` with private scoped metadata,
  for example `@kaito/api-client`.
- [x] Create `packages/api-client/README.md` stating that the package is
  reserved for a future generated API client and currently exports nothing.
- [x] Do not add runtime exports, generated clients, OpenAPI artifacts, source
  files, or product contracts.
- [x] Verification: `pnpm install` recognizes `packages/api-client` as a
  workspace member without adding product dependencies.

### 5. Local-only Docker assets

- [x] Create `docker/web.Dockerfile` for local development of `apps/web` with
  Node 24.18/pnpm 11 assumptions.
- [x] Create `docker/api.Dockerfile` for local development of `apps/api` with
  Python 3.12/uv assumptions.
- [x] Create root `compose.yaml` with a header comment that it is local-only
  developer convenience, not deployment/CD.
- [x] Configure compose services for `web` and `api` only, with local ports
  documented in README.
- [x] Do not define database, cache, broker, persistent volumes, deployment
  targets, image publishing, or CD concerns.
- [x] Verification: if Docker is available, `docker compose up --build` starts
  only `web` and `api`; `/health` responds from the API service.

### 6. Basic CI validation only

- [x] Create `.github/workflows/ci.yml` triggered on pull requests and pushes.
- [x] Add a `web` job that uses Node 24.18 and pnpm 11, then runs:
  - [x] `pnpm install`.
  - [x] `pnpm lint:web`.
  - [x] `pnpm build:web`.
- [x] Add an `api` job that uses Python 3.12 and uv, then runs from `apps/api`:
  - [x] `uv sync`.
  - [x] `uv run ruff check .`.
  - [x] `uv run python -c "from app.main import app; print(app.title)"`.
  - [x] FastAPI TestClient check asserting `/health` returns HTTP 200 and
    `{"status":"ok"}`.
- [x] Keep CI free of deployment, publishing, Docker image push, release
  automation, and real product test suites.
- [x] Verification: workflow syntax is reviewable and commands match local
  README commands.

### 7. Spanish root `README.md` living document

- [x] Update root `README.md` in Spanish.
- [x] Include required sections:
  - [x] `Visión general`.
  - [x] `Stack tecnológico`.
  - [x] `Instalación`.
  - [x] `Ejecución`.
  - [x] `Estructura del proyecto`.
  - [x] `Funcionalidades actuales`.
  - [x] `Regla de actualización`.
- [x] Document exact local commands for root install, web run, API dependency
  install, API run, health check, and optional Docker Compose.
- [x] State that later changes modifying scaffolded structure, commands, or
  available functionality must update the Spanish root `README.md` in the same
  change.
- [x] Clearly state current functionality is limited to a minimal web page and
  API `/health` endpoint.
- [x] Keep out-of-scope features explicit: no Supabase, DB/PostgreSQL,
  SQLAlchemy/Alembic, auth, Strava, AI/RAG, onboarding, training plans, or
  deployment/CD.

### 8. Final validation checklist

- [x] Run `pnpm install` from the repository root.
- [x] Run `pnpm lint:web` from the repository root.
- [x] Run `pnpm build:web` from the repository root.
- [x] Run `pnpm dev:web` and load the minimal web page.
- [x] From `apps/api`, run `uv sync`.
- [x] From `apps/api`, run `uv run ruff check .`.
- [x] From `apps/api`, run:

  ```bash
  uv run python -c "from app.main import app; print(app.title)"
  ```

- [x] From `apps/api`, run the FastAPI TestClient health contract check.
- [x] From `apps/api`, run Uvicorn and confirm `/health` returns
  `{"status":"ok"}`.
- [x] If practical, run `docker compose up --build` and confirm only `web` and
  `api` start.
- [x] Review changed files for excluded scope before opening PR.
- [x] Check `git diff --stat`; pause and ask before continuing if the
  implementation approaches or exceeds 600 changed lines.
