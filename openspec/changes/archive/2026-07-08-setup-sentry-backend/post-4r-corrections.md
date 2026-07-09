# Post-4R Corrections — setup-sentry-backend

**Date:** 2026-07-09  
**Status:** Applied post-archive, pre-PR  
**Trigger:** 4R (four-eyes review) findings raised before PR creation.

This document records corrections made after the SDD change was archived and
verified but before the PR was opened. The archived `apply-progress.md`,
`verify-report.md`, and historical spec are preserved as-is; this note
supplements the audit trail with the changes made in response to review
findings.

---

## Findings and Resolutions

### Finding 1 — Gate `/debug-sentry` behind `ENABLE_DEBUG_SENTRY=true`

**Problem:** The `/debug-sentry` route was always registered, regardless of
environment. Any caller could trigger an intentional 500 without opting in.

**Resolution:**

- `apps/api/app/main.py`: wrapped route registration in
  `if os.getenv("ENABLE_DEBUG_SENTRY", "").strip().lower() == "true":`.
  The route is registered only when the flag is explicitly set.
- `apps/api/tests/test_main.py`: updated debug-sentry tests to expect 404
  when flag absent/false, added tests for both disabled (`false`) and
  enabled (`true`) paths.
- `apps/api/.env.example`: added `ENABLE_DEBUG_SENTRY=false` with guidance.
- `apps/api/README.md`: documented the flag and usage instructions.
- `openspec/specs/backend-observability/spec.md`: added gate requirement and
  corresponding scenarios.

### Finding 2 — Handle malformed non-empty `SENTRY_DSN` gracefully

**Problem:** A non-empty but invalid DSN string would cause `sentry_sdk.init`
to raise, crashing the application on import/startup.

**Resolution:**

- `apps/api/app/observability/sentry.py`: wrapped `sentry_sdk.init()` in
  `try/except Exception`; on failure, logs an ERROR and returns `False` so
  startup continues with Sentry disabled.
- `apps/api/tests/test_sentry_bootstrap.py`: added three regression tests
  (`test_init_sentry_returns_false_for_malformed_dsn`,
  `test_init_sentry_logs_error_for_malformed_dsn`,
  `test_init_sentry_returns_false_when_sdk_init_raises`) covering the
  graceful-degradation path without real network calls.
- `apps/api/tests/test_main.py`: added
  `test_app_starts_and_health_ok_with_malformed_dsn` to verify `/health`
  remains responsive even with a malformed DSN.
- `openspec/specs/backend-observability/spec.md`: added
  "Requirement: Graceful degradation on malformed DSN" with scenario.

### Finding 3 — Fix README `.env` mismatch

**Problem:** README instructed users to copy `.env.example` to `.env` and
restart, implying the file would be auto-loaded. The server only reads
process-environment variables; copying `.env` without exporting or using
`--env-file` has no effect.

**Resolution:**

- `apps/api/README.md`: replaced the misleading "copy and restart" step with
  two explicit options:
  - **Option A** — export vars in the shell.
  - **Option B** — pass `--env-file .env` to uvicorn (supported since
    uvicorn ≥ 0.19; this project pins 0.34.0).
  Added a prominent note that `.env` is not loaded automatically.
- `openspec/specs/backend-observability/spec.md`: updated the documentation
  requirement to mention `--env-file` / export and the no-auto-load caveat.

### Finding 4 — Strengthen framework-boundary test with AST inspection

**Problem:** The existing boundary test walked module globals for
`ModuleType` attributes but would not catch `from fastapi import FastAPI`
style imports that are used as local names rather than module references.

**Resolution:**

- `apps/api/tests/test_sentry_bootstrap.py`: replaced the globals-walk
  approach with AST-level source inspection (`ast.parse` + `ast.walk`)
  that examines every `ast.Import` and `ast.ImportFrom` node in the source
  file. Any `fastapi` or `starlette` root package name in any import form
  causes an assertion failure with an informative message.

### Finding 5 — Reduce duplicated SENTRY env/test app reload setup

**Problem:** Both test files defined the same `_clear_sentry_env` helper,
and `test_main.py` repeated the `import importlib; reload(main_module);
TestClient(...)` idiom four times inline.

**Resolution:**

- `apps/api/tests/conftest.py` (new): introduced `clear_sentry_env()` and
  `reload_main()` shared helpers importable by both test modules.
- `apps/api/tests/test_sentry_bootstrap.py`: removed local `_clear_sentry_env`,
  imports shared helper.
- `apps/api/tests/test_main.py`: removed inline duplication; uses
  `clear_sentry_env` + `reload_main` from conftest, with two fixtures
  (`client_no_sentry`, `client_debug_sentry_enabled`) covering the two
  main app states.

---

## Files Changed

| File | Change type |
| ------ | ------------- |
| `apps/api/app/observability/sentry.py` | Modified — graceful DSN error handling |
| `apps/api/app/main.py` | Modified — ENABLE_DEBUG_SENTRY gate |
| `apps/api/tests/conftest.py` | New — shared helpers |
| `apps/api/tests/test_sentry_bootstrap.py` | Modified — AST boundary test, malformed DSN tests, shared helper |
| `apps/api/tests/test_main.py` | Modified — gate tests, malformed DSN test, reduced duplication |
| `apps/api/README.md` | Modified — env-file docs, ENABLE_DEBUG_SENTRY, malformed DSN note |
| `apps/api/.env.example` | Modified — added ENABLE_DEBUG_SENTRY |
| `openspec/specs/backend-observability/spec.md` | Modified — gate requirement, malformed DSN requirement, docs requirement |

---

## Verification Evidence

```
cd apps/api && uv sync --frozen          # ✓ 28 packages checked, no changes
cd apps/api && uv run ruff check .       # ✓ All checks passed
cd apps/api && uv run pytest tests/ -v   # ✓ 25/25 passed
import smoke: from app.main import app   # ✓ Kaito API
/health smoke                            # ✓ {"status": "ok"}
no-DSN init_sentry()                     # ✓ False
```

Total test count increased from 19 (post-apply) to **25** (post-4R corrections).

---

## Risks Remaining

- The `importlib.reload` pattern in `test_main.py` is sensitive to Python's
  module-level evaluation order. Should FastAPI's route registration move to
  a factory function in a future refactor, tests will need updating — this is
  tracked as a known tech debt item, not a blocker.
- `ENABLE_DEBUG_SENTRY=true` remains a runtime flag with no server-side
  rate-limiting or auth. It is intentional that this is a developer-only
  feature; the README explicitly warns against enabling it in production.
- Starlette/asyncio deprecation warnings from Python 3.14 (`asyncio.iscoroutinefunction`)
  are upstream library issues; they do not affect functionality or CI gate.
