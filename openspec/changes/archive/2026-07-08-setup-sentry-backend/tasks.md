# Tasks: setup-sentry-backend

## Review Workload Forecast

| Field | Value |
| ------- | ------- |
| Estimated changed lines | 450–700 changed lines, mostly from `apps/api/uv.lock` plus backend tests/docs |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: backend dependency + framework-agnostic bootstrap + tests → PR 2: FastAPI host wiring + diagnostic route + tests → PR 3: backend env/docs/gitignore + final verification |
| Delivery strategy | single-pr exception approved for this session |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: size-exception
400-line budget risk: High

## Work Units

### 1. RED — add executable backend observability tests

- [x] Add failing backend observability tests for DSN gating, sample-rate defaults, invalid numeric warning/fallback, bootstrap framework boundary, `/health`, and `/debug-sentry`.

- Start: existing API has only `apps/api/app/main.py`, CI smoke checks, and no structured backend test suite.
- Change targets:
  - `apps/api/pyproject.toml`: add a pinned `pytest` dev dependency if structured tests are chosen.
  - `apps/api/uv.lock`: regenerate with `uv sync` after dependency changes.
  - `apps/api/tests/test_sentry_bootstrap.py`: add failing tests for DSN gating, sample-rate defaults, invalid numeric warning/fallback, and no FastAPI/Starlette imports from the bootstrap module.
  - `apps/api/tests/test_main.py`: add/prepare failing host-adapter tests for `/health` and `/debug-sentry` behavior with `TestClient`.
- Requirements:
  - Tests must not use a real Sentry DSN or make network calls.
  - Tests must assert `SENTRY_DSN` unset/empty skips initialization.
  - Tests must assert invalid `SENTRY_TRACES_SAMPLE_RATE` or `SENTRY_PROFILES_SAMPLE_RATE` logs a warning and falls back to `0.0`.
- Verify RED:
  - `cd apps/api && uv run pytest` fails for missing bootstrap/route behavior.
  - `cd apps/api && uv run ruff check .` remains runnable.
- Rollback: remove the new tests and optional pytest dev dependency/lockfile changes.

### 2. GREEN — add framework-agnostic Sentry bootstrap

- [x] Add the framework-agnostic Python Sentry bootstrap module, runtime dependency, and lockfile update while keeping FastAPI/Starlette out of the bootstrap boundary.

- Start: tests from Work Unit 1 define the expected backend runtime behavior.
- Change targets:
  - `apps/api/app/observability/__init__.py` or `apps/api/app/observability/sentry.py` (preferred concrete path): create the backend Sentry module.
  - Alternative only if chosen during apply: `apps/api/app/sentry.py`.
  - `apps/api/pyproject.toml`: add pinned runtime dependency `sentry-sdk==<selected-version>`.
  - `apps/api/uv.lock`: regenerate with `uv sync`.
- Requirements:
  - Expose `init_sentry() -> bool`.
  - Read `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE`, and `SENTRY_PROFILES_SAMPLE_RATE` with `os.getenv` at call time.
  - Return `False` before calling `sentry_sdk.init` when `SENTRY_DSN` is unset or blank.
  - Call `sentry_sdk.init(...)` only when DSN is non-empty, using `environment`, `traces_sample_rate`, and `profiles_sample_rate`.
  - Default `SENTRY_ENVIRONMENT` to `development`; default both sample rates to `0.0`.
  - Use stdlib `logging` for invalid numeric warnings.
  - Do not import FastAPI, Starlette, or host-adapter code in this module.
- Verify GREEN:
  - `cd apps/api && uv run pytest tests/test_sentry_bootstrap.py` or, from `apps/api`, `uv run pytest tests/test_sentry_bootstrap.py`.
  - `cd apps/api && uv run python -c "from app.observability.sentry import init_sentry; assert init_sentry() is False"` with no Sentry env vars.
- Rollback: remove the bootstrap module and `sentry-sdk` dependency/lockfile changes.

### 3. GREEN — wire current FastAPI host adapter and diagnostic route

- [x] Wire the current FastAPI host adapter to call the bootstrap and expose `/debug-sentry` while preserving `/health` behavior.

- Start: framework-agnostic bootstrap exists and passes unit tests.
- Change targets:
  - `apps/api/app/main.py`: import and call `init_sentry()` during app bootstrap; add `GET /debug-sentry` only when `ENABLE_DEBUG_SENTRY=true` (404 otherwise).
  - `apps/api/tests/test_main.py`: complete host-adapter tests for `/health` and `/debug-sentry`.
- Requirements:
  - Keep FastAPI-specific code only in `app/main.py` or host-adapter modules.
  - Preserve `GET /health -> 200 {"status": "ok"}` with Sentry env vars absent.
  - Add `GET /debug-sentry` behind `ENABLE_DEBUG_SENTRY=true` that intentionally raises an unhandled exception such as `ZeroDivisionError`.
  - Ensure no real Sentry ingestion is attempted when DSN is absent.
- Verify GREEN:
  - `cd apps/api && uv run pytest tests/test_main.py` (assert 404 when the flag is absent and 500 only when enabled).
  - `cd apps/api && uv run python -c "from app.main import app; print(app.title)"`.
  - `cd apps/api && uv run python -c "from fastapi.testclient import TestClient; from app.main import app; r = TestClient(app).get('/health'); assert r.status_code == 200; assert r.json() == {'status': 'ok'}"`.
- Rollback: remove the `init_sentry()` call and `/debug-sentry` route.

### 4. TRIANGULATE — document backend env config and secret hygiene

- [x] Add backend Sentry environment example, Spanish API README documentation, and `/apps/api/.env` gitignore hygiene.

- Start: backend behavior is implemented and tested.
- Change targets:
  - `apps/api/.env.example`: add placeholder/default guidance for `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE`, and `SENTRY_PROFILES_SAMPLE_RATE`.
  - `apps/api/README.md`: create Spanish backend README documenting optional Sentry setup, no-secret local behavior, variables, and `/debug-sentry` verification.
  - `.gitignore`: add `/apps/api/.env`, mirroring `/apps/web/.env`.
- Requirements:
  - Keep docs backend-only; do not edit root README, frontend docs, deploy docs, dashboards, alerting, or auth docs.
  - Explain that `/debug-sentry` is a verification-only endpoint that intentionally raises an error.
  - Explain traces/profiles default to `0.0` and are opt-in.
- Verify:
  - Manually inspect Spanish wording in `apps/api/README.md`.
  - Confirm `.gitignore` contains `/apps/api/.env`.
- Rollback: remove the env example, README content/file, and gitignore line.

### 5. REFACTOR — keep the slice small and boundary-clean

- [x] Refactor the implementation and tests to keep the public bootstrap API small, deterministic, and framework-boundary clean.

- Start: code, tests, and docs are present.
- Change targets:
  - `apps/api/app/observability/sentry.py` (or chosen bootstrap path).
  - `apps/api/app/main.py`.
  - `apps/api/tests/test_sentry_bootstrap.py` and `apps/api/tests/test_main.py`.
- Requirements:
  - Remove duplicated env parsing/test setup.
  - Keep bootstrap public API small, ideally only `init_sentry()` plus testable private helpers as needed.
  - Verify the bootstrap module still has no FastAPI/Starlette imports.
  - Keep tests deterministic and isolated from process-wide Sentry/env state.
- Verify:
  - `cd apps/api && uv run ruff check .`.
  - `cd apps/api && uv run pytest` if pytest was added.
- Rollback: revert only refactor changes while keeping previous passing behavior.

### 6. Final verification and review-budget gate

- [x] Run final backend verification commands, inspect diff size, and surface the recorded single-PR size exception before PR creation.

- Start: all implementation work units are complete.
- Commands:
  - `git diff --stat`
  - `cd apps/api && uv sync --frozen`
  - `cd apps/api && uv run ruff check .`
  - `cd apps/api && uv run python -c "from app.main import app; print(app.title)"`
  - `cd apps/api && uv run python -c "from fastapi.testclient import TestClient; from app.main import app; r = TestClient(app).get('/health'); assert r.status_code == 200; assert r.json() == {'status': 'ok'}"`
  - `cd apps/api && uv run pytest` if pytest was added.
- Review gate:
  - If `git diff --stat` indicates the implementation exceeds or is likely to exceed 400 changed lines, proceed under the recorded single-PR size exception for this session, but surface the review burden clearly before PR creation.
  - Prefer work-unit commits matching the task split above; keep tests with the behavior they verify so the single PR remains reviewable.
- Rollback: use work-unit commits to revert the smallest failing behavior slice.
