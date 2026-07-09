# Design: setup-sentry-backend

## Context

This slice introduces baseline Sentry error tracking for the Kaito backend
Python runtime in `apps/api`, as a pre-Auth observability foundation. The
current backend is minimal:

- `apps/api/app/main.py` builds a `FastAPI(title="Kaito API")` instance and
  exposes a single `GET /health` returning `{"status": "ok"}`.
- Dependencies are managed with `uv` (`apps/api/pyproject.toml` + `uv.lock`);
  runtime deps today are `fastapi==0.115.6` and `uvicorn[standard]==0.34.0`,
  dev deps `httpx==0.28.1` and `ruff==0.8.4`.
- CI (`.github/workflows/ci.yml`) runs `uv sync --frozen`, `ruff check .`, an
  import smoke (`from app.main import app`), and a `/health` contract check via
  `fastapi.testclient.TestClient`.
- There is no `apps/api/README.md` and no `apps/api/.env.example` yet.
- The frontend already established the DSN-gated pattern (`apps/web/README.md`):
  when the DSN is unset/empty, Sentry init is skipped and no ingestion requests
  are made.

### Architectural framing (normative for this design)

The integration boundary is **framework-agnostic backend Python**, mirroring
how the web side is TypeScript-first rather than framework-first. Kaito is
moving toward a modular-monolith shape; the durable boundary is Python backend
code. FastAPI is only the **current host/adapter** where the Sentry bootstrap is
invoked at startup and where the diagnostic route is mounted. The design must
keep the Sentry bootstrap and config parsing free of FastAPI/Starlette coupling,
so the same bootstrap can be reused if the host adapter changes.

## Goals / Non-goals

### Goals

- Optional, DSN-gated Sentry initialization implemented as reusable, framework-
  agnostic backend Python.
- No network calls and no behavior change when `SENTRY_DSN` is absent/empty.
- Safe parsing of `SENTRY_TRACES_SAMPLE_RATE` / `SENTRY_PROFILES_SAMPLE_RATE`
  with warning + fallback to `0.0`.
- Errors-only default posture; traces/profiles opt-in.
- Diagnostic error route wired via the current FastAPI host adapter.
- Backend-facing docs (`apps/api/README.md`) and discoverable config
  (`apps/api/.env.example`), plus gitignoring `apps/api/.env`.

### Non-goals

- Frontend / `apps/web` observability.
- Root README, deployment/platform docs, dashboards, alerting, on-call routing.
- Auth work and performance/profiling rollout beyond opt-in config support.

## Decisions

### D1 — Separate framework-agnostic bootstrap module from host wiring

Introduce a dedicated backend module (e.g. `apps/api/app/observability/sentry.py`
or `apps/api/app/sentry.py`) that owns:

- reading `SENTRY_*` environment variables via `os.getenv`,
- safe numeric parsing,
- deciding whether to initialize, and calling `sentry_sdk.init(...)`.

This module MUST NOT import FastAPI/Starlette. It exposes a single public entry
point, conceptually `init_sentry() -> bool` (returns whether init ran), so any
host can call it during boot. Rationale: keeps the architectural boundary in
pure Python; host adapters remain thin.

> Naming/placement is a design recommendation; the exact module path is settled
> in the tasks/apply phase, but the framework-agnostic separation is normative.

### D2 — DSN gating happens before any SDK activity

`init_sentry()` reads `SENTRY_DSN`, strips it, and treats empty/unset as
"disabled". When disabled it returns immediately **before** calling
`sentry_sdk.init`, guaranteeing no client is constructed and no ingestion
transport is created. This satisfies the "no network calls without DSN"
requirement structurally rather than by relying on SDK internals.

### D3 — Safe numeric parsing helper with warning + fallback

A small private helper parses a float env var:

```
def _parse_sample_rate(var_name, raw, default=0.0) -> float:
    if raw is None or raw.strip() == "":
        return default
    try:
        return float(raw)
    except (TypeError, ValueError):
        logger.warning("Invalid %s=%r; falling back to %s", var_name, raw, default)
        return default
```

- Uses the stdlib `logging` module (`logger = logging.getLogger(__name__)`) for
  the warning — no new dependency, suitable for developer troubleshooting.
- Applies to both `SENTRY_TRACES_SAMPLE_RATE` and `SENTRY_PROFILES_SAMPLE_RATE`.
- Out-of-range but numeric values (e.g. `1.5`) are out of scope for validation
  in this slice; only parse-failure fallback is required by the spec. (Optional:
  clamp to `[0.0, 1.0]` — noted as a possible hardening, not required.)

### D4 — Errors-only defaults

`sentry_sdk.init` is called with:

- `dsn=<dsn>`,
- `environment=os.getenv("SENTRY_ENVIRONMENT", "development")`,
- `traces_sample_rate=<parsed, default 0.0>`,
- `profiles_sample_rate=<parsed, default 0.0>`.

Error capture is on by default in `sentry-sdk` when a DSN is set, so no extra
config is needed to capture unhandled exceptions. Traces/profiles stay at `0.0`
unless explicitly opted in, keeping the slice conservative.

### D5 — Host adapter wiring in `app/main.py`

The current FastAPI host is the adapter. `apps/api/app/main.py` calls
`init_sentry()` **before** creating/returning the `app` (module import time is
acceptable given the current tiny app; a lifespan/startup hook is optional and
not required for this slice). The diagnostic route is registered on the FastAPI
`app`. This wiring is explicitly documented as host-adapter detail, not the
integration boundary.

FastAPI/Starlette auto-instrumentation: `sentry-sdk` auto-enables the ASGI/
Starlette/FastAPI integrations when those packages are importable. That is
acceptable and desirable for request-level error capture, but it remains an SDK
feature triggered by the host, not something this design hard-codes into the
bootstrap module. The bootstrap stays framework-agnostic; the host merely
happens to be FastAPI.

### D6 — Diagnostic route

Add `GET /debug-sentry` on the FastAPI app that raises a `ZeroDivisionError`
(e.g. `1 / 0`). When a DSN is configured, the unhandled exception propagates and
is captured by the SDK's ASGI integration; when no DSN is configured, it raises
without any ingestion attempt (guaranteed by D2). Documented as a verification-
only endpoint.

### D7 — Dependency addition

Add `sentry-sdk` to `[project].dependencies` in `apps/api/pyproject.toml` and
regenerate `uv.lock` via `uv sync`. Pin to an explicit version consistent with
the repo's pinning convention (all current deps are `==` pinned). The version is
selected at apply time; `sentry-sdk` includes FastAPI/Starlette integrations in
its base package, so no extras are required.

### D8 — Config discoverability & secret hygiene

- Create `apps/api/.env.example` listing `SENTRY_DSN`, `SENTRY_ENVIRONMENT`,
  `SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_PROFILES_SAMPLE_RATE` with
  placeholder/default guidance.
- Create `apps/api/README.md` (Spanish, per documentation convention) covering
  optional setup, local-safe behavior when vars are absent, the available
  variables, and how to use `/debug-sentry` for verification.
- Add `/apps/api/.env` to root `.gitignore` (line 18 currently ignores
  `/apps/web/.env`; mirror it).

## Data / control flow

### Startup (host = FastAPI)

```
import app.main
  -> init_sentry()                       # framework-agnostic
       dsn = getenv("SENTRY_DSN").strip()
       if not dsn: return False          # D2: no SDK, no network
       env = getenv("SENTRY_ENVIRONMENT", "development")
       traces = _parse_sample_rate("SENTRY_TRACES_SAMPLE_RATE", getenv(...))
       profiles = _parse_sample_rate("SENTRY_PROFILES_SAMPLE_RATE", getenv(...))
       sentry_sdk.init(dsn=dsn, environment=env,
                       traces_sample_rate=traces,
                       profiles_sample_rate=profiles)
       return True
  -> app = FastAPI(title="Kaito API")
  -> register /health, /debug-sentry
```

### Request (diagnostic)

```
GET /debug-sentry -> raise ZeroDivisionError
   DSN set     -> SDK ASGI integration captures + reports -> 500 to client
   DSN unset   -> propagates -> 500, no ingestion attempted
```

## Target files

| File | Change | Notes |
| --- | --- | --- |
| `apps/api/app/sentry.py` (or `app/observability/sentry.py`) | new | Framework-agnostic bootstrap + safe parsing (D1–D4) |
| `apps/api/app/main.py` | edit | Call `init_sentry()` at boot; add `/debug-sentry` (D5, D6) |
| `apps/api/pyproject.toml` | edit | Add `sentry-sdk` runtime dep (D7) |
| `apps/api/uv.lock` | regen | Via `uv sync` (D7) |
| `apps/api/.env.example` | new | Placeholder Sentry vars (D8) |
| `apps/api/README.md` | new | Spanish backend docs (D8) |
| `.gitignore` | edit | Add `/apps/api/.env` (D8) |
| `apps/api/tests/` (or CI step) | new | Smoke tests (see Test strategy) |

## Contracts

### Bootstrap contract (framework-agnostic)

- `init_sentry() -> bool`: returns `True` when init ran, `False` when skipped.
- Pure Python; no FastAPI import; reads env at call time; never raises on
  malformed optional numeric input.

### Environment variables

| Var | Type | Default | Behavior |
| --- | --- | --- | --- |
| `SENTRY_DSN` | string | unset | Empty/unset ⇒ init skipped, no network |
| `SENTRY_ENVIRONMENT` | string | `development` | Label in Sentry UI |
| `SENTRY_TRACES_SAMPLE_RATE` | float | `0.0` | Invalid ⇒ warn + `0.0` |
| `SENTRY_PROFILES_SAMPLE_RATE` | float | `0.0` | Invalid ⇒ warn + `0.0` |

### HTTP surface (host adapter)

- `GET /health` → `200 {"status": "ok"}` (unchanged, must stay green with and
  without Sentry).
- `GET /debug-sentry` → raises `ZeroDivisionError` (→ `500`), verification only.

## Test strategy

Use existing backend tooling (`uv`, `fastapi.testclient.TestClient`, `httpx`
dev dep, `ruff`). No new runner framework is required; `pytest` MAY be added as
a dev dependency if the apply phase prefers structured tests, but the minimum
bar can be met with TestClient scripts mirroring the current CI style.

Coverage to add (as executable tests, e.g. under `apps/api/tests/`):

1. **No-DSN import + health**: with all `SENTRY_*` unset, `from app.main import
   app` succeeds and `GET /health` returns `{"status": "ok"}` (spec: no-secret
   local dev; extends current CI smoke).
2. **No-DSN debug route**: `GET /debug-sentry` raises/returns `500` without any
   Sentry client being initialized (assert `init_sentry()` returned `False` or
   that no client is bound). No network assertion needed because D2 prevents
   init entirely.
3. **Safe parsing**: `init_sentry`/`_parse_sample_rate` with
   `SENTRY_TRACES_SAMPLE_RATE=invalid` (and DSN set) does not raise, yields
   `0.0`, and emits a warning (assert via `caplog`/`logging` capture).
4. **Defaults**: with DSN set and no sample-rate vars, parsed traces/profiles
   are `0.0` (errors-only posture). This can be a unit test on the parsing/config
   layer to avoid real network init, or use a dummy/test DSN with the SDK's
   transport disabled.
5. **Ruff**: new Python must pass `uv run ruff check .`.

CI note: the existing `/health` contract step and import smoke remain valid and
should keep passing unchanged. A new CI step (or expanded smoke) may run the
backend tests, but expanding CI is optional for this slice and should stay
within the review budget.

Avoid real ingestion in tests: never configure a real DSN; use unset-DSN paths
or unit-test the pure parsing/config functions so no network transport starts.

## Rollout

- Additive and DSN-gated: merging the change has no runtime effect until a real
  `SENTRY_DSN` is provisioned in an environment.
- Enable per-environment by setting `SENTRY_DSN` (and optionally
  `SENTRY_ENVIRONMENT`); verify via `/debug-sentry` after deploy.
- Sampling stays `0.0` until explicitly opted in.

## Rollback

Low risk due to additive, gated design:

- Remove `init_sentry()` call from `app/main.py` and delete the bootstrap
  module.
- Remove `/debug-sentry`.
- Remove `sentry-sdk` from `pyproject.toml` and regenerate `uv.lock`.
- Remove `.env.example`/README Sentry sections and the `.gitignore` line if
  desired.

Backend returns to its current no-observability behavior.

## Risks & mitigations

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Malformed numeric env crashes startup | low | D3 safe parse + fallback + warning; unit test |
| Accidental FastAPI coupling in bootstrap | medium | D1 module boundary, no FastAPI import; review gate |
| Debug route misuse | low | Documented verification-only; raises intentionally |
| Real ingestion during tests/CI | low | D2 gating; tests never set real DSN |
| Scope creep into frontend/deploy | low | Non-goals enforced; backend-only files |

## Open questions (defer to tasks/apply)

- Exact module path (`app/sentry.py` vs `app/observability/sentry.py`).
- Whether to add `pytest` as a dev dependency vs TestClient scripts.
- Whether to add a dedicated CI step for backend tests within budget.
- `sentry-sdk` pinned version selection.
