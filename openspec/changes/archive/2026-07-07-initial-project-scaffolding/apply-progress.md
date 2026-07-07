# Apply Progress — Initial project scaffolding

## Status

Applied.

## Files created or updated

- Root configuration:
  - `.nvmrc`
  - `.python-version`
  - `package.json`
  - `pnpm-workspace.yaml`
  - `tsconfig.json`
  - `.gitignore`
  - `.dockerignore`
- Web scaffold: `apps/web/` minimal Next.js app.
- API scaffold: `apps/api/` minimal FastAPI app with `GET /health`.
- Shared placeholder: `packages/api-client/`.
- Docker:
  - `docker/web.Dockerfile`
  - `docker/api.Dockerfile`
  - `compose.yaml`
- CI: `.github/workflows/ci.yml`.
- Documentation: Spanish root `README.md`.
- Dependency locks:
  - `pnpm-lock.yaml`
  - `apps/api/uv.lock`

## Verification evidence

- `pnpm install`: passed.
  - Local warning: this machine currently runs Node `v22.22.2` while the project
    targets Node `24.18`.
- `pnpm lint:web`: passed with the same local engine warning.
- `pnpm build:web`: passed with the same local engine warning.
- `pnpm dev:web`: served the minimal page and returned the expected scaffold
  text locally.
- `uv sync --frozen` from `apps/api`: passed.
- `uv run ruff check .` from `apps/api`: passed.
- FastAPI import smoke check passed:

  ```bash
  uv run python -c "from app.main import app; print(app.title)"
  ```

- Health contract smoke check passed:

  ```bash
  uv run python - <<'PY'
  from fastapi.testclient import TestClient
  from app.main import app

  response = TestClient(app).get('/health')
  assert response.status_code == 200
  assert response.json() == {'status': 'ok'}
  print(response.json())
  PY
  ```

- Local Uvicorn check: `GET /health` returned `{"status":"ok"}`.
- `docker compose config`: passed.
- `docker compose build`: passed for `web` and `api` using lockfiles.
- `docker compose up -d`: started only `web` and `api`.
- Docker API check: `/health` returned `{"status":"ok"}`.
- Docker web check: the scaffold page responded with the expected text.
- Docker services were stopped with `docker compose down`.

## Review fixes applied during apply

Fresh reliability/resilience review found two blocking issues, both fixed:

- CI now validates the `/health` HTTP contract using FastAPI `TestClient`.
- Docker builds now copy and enforce committed lockfiles:
  - web uses `pnpm-lock.yaml` and `pnpm install --frozen-lockfile`;
  - API uses `apps/api/uv.lock` and `uv sync --frozen`.

Additional hardening:

- Dockerfiles now switch to non-root users for runtime.
- GitHub Actions are pinned to full commit SHAs.
- `checkout` uses `persist-credentials: false`.
- Generated local artifacts are ignored.

## Notes

The local machine does not currently use Node 24.18, so direct pnpm commands emit
engine warnings. Docker and CI are configured for Node 24.18/pnpm 11, and the
web checks passed locally despite the warning.

No Supabase, database, SQLAlchemy/Alembic, auth, Strava, AI/RAG, onboarding,
training-plan logic, deployment, or CD was added.
