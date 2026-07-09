# Exploration Notes: `setup-sentry-backend`

## 1. Technical Context & Scope

This change sets up Sentry backend error tracking for the backend Python runtime in `apps/api`. It acts as a foundation task before the Auth block begins, ensuring later PRs have robust observability, exception tracking, validation, and safety infrastructure available from day one. The architectural integration boundary is framework-agnostic backend Python code; FastAPI is only the current host/adapter where startup and the diagnostic route are mounted.

### Backend Overview

- **Location**: `apps/api`
- **Backend Boundary**: framework-agnostic Python runtime
- **Current Host/Adapter**: FastAPI (v0.115.6)
- **Dependency Management**: `uv` (`pyproject.toml` and `uv.lock`)
- **CI Environment**: Runs `uv run ruff check .` and smoke tests calling `from app.main import app`.

## 2. Key Requirements & Architectural Decisions

### A. Non-Disruptive Local Development (No-DSN Gating)

- **Problem**: Local development, CI builds, and test runs must run seamlessly without real secrets or background network tracking.
- **Solution**: Follow the same design pattern as the frontend Sentry integration documented in `apps/web/README.md`. If `SENTRY_DSN` is empty or unset, Sentry initialization is completely bypassed.
- **Implementation Choice**: Create an optional, framework-agnostic Python Sentry initialization helper that reads from `os.getenv("SENTRY_DSN")` and can be wired into the current host startup.

### B. Environment Variables & Safe Parsing

The backend will support the following standard environment variables:

1. `SENTRY_DSN` (string, default unset): the core connection string. Bypasses initialization if missing/empty.
2. `SENTRY_ENVIRONMENT` (string, default `"development"`): labels backend issues in the Sentry UI.
3. `SENTRY_TRACES_SAMPLE_RATE` (float, default `0.0`): controls performance/trace capture. Must be safely parsed with exception fallback.
4. `SENTRY_PROFILES_SAMPLE_RATE` (float, default `0.0`): controls backend CPU profiling sample rate. Must be safely parsed with exception fallback.

Safe float conversion is required. If an invalid value is provided (for example `SENTRY_TRACES_SAMPLE_RATE=invalid`), the app must not crash on startup; it should warn or gracefully default to `0.0`.

### C. Dependency Integration

- **Library**: `sentry-sdk` installed via `uv`.
- Use the Python `sentry-sdk` as the framework-agnostic backend runtime dependency. Any FastAPI/Starlette wiring should remain a current-host adapter detail rather than the core integration boundary.
- Add `sentry-sdk` to `dependencies` in `apps/api/pyproject.toml` and regenerate `uv.lock` via `uv sync`.

### D. Self-Diagnostics / Debug Endpoint

To verify correct ingestion and routing, expose a `/debug-sentry` endpoint through the current host adapter that triggers a standard exception, such as `ZeroDivisionError`. This matches Sentry setup guidance and helps validate configuration after staging/production deploys, while keeping the core Sentry bootstrap framework-agnostic.

### E. Configuration Discovery & Ignored Files

- **Environment Documentation**: create `apps/api/.env.example` with placeholder Sentry fields.
- **Git Ignore**: add `/apps/api/.env` to the root `.gitignore` to prevent accidental commits of local backend secrets, matching `/apps/web/.env`.
- **README Updates**: document configuration fields, debugging, and execution instructions in `apps/api/README.md` in Spanish per the project documentation convention. Root README updates remain out of scope for the first slice unless explicitly requested later.

## 3. Verification & Testing Strategy

- Ensure `/health` remains responsive and returns `{ "status": "ok" }` with and without Sentry initialized.
- Keep Ruff compliance for new Python code.
- Add backend smoke tests covering `/health` and the diagnostic error route behavior through the current host adapter.
- Ensure `uv run python -c "from app.main import app"` continues to succeed with Sentry imported and optional variables missing.

## 4. Next Phase Recommendations

- Maintain conventional `SENTRY_*` configuration keys.
- Include explicit safety guards against malformed sample-rate values.
- Keep the first delivery boundary reviewable independently before Auth implementation.

## Phase Envelope

```json
{
  "status": "success",
  "executive_summary": "Explored backend Sentry tracking for Kaito's Python backend runtime. The planned shape keeps local development safe when SENTRY_DSN is unset, uses resilient environment parsing, provides a diagnostic error route through the current host adapter, and documents backend environment variables.",
  "artifacts": [
    {
      "topic_key": "sdd/setup-sentry-backend/explore",
      "type": "architecture",
      "store": "engram",
      "observation_id": 353
    },
    {
      "path": "openspec/changes/setup-sentry-backend/explore.md",
      "type": "architecture",
      "store": "openspec"
    }
  ],
  "next_recommended": "sdd/setup-sentry-backend/proposal",
  "risks": [
    {
      "category": "environment-validation",
      "severity": "low",
      "details": "Malformed float variables could crash the server if raw casting is used without safe fallback logic."
    }
  ],
  "skill_resolution": "none"
}
```
