# Apply Progress: setup-sentry-backend

## Status

`complete` — all 6 tasks implemented and verified. Review findings addressed in correction pass. Ready for `sdd-verify`.

## Consumed Structured Status

- `changeName`: setup-sentry-backend
- `artifactStore`: openspec
- `applyState`: ready (authoritative)
- `actionContext.mode`: repo-local
- `allowedEditRoots`: `/home/jjdelarubia/Workspace/BIGschool/Kaito`
- **Warnings consumed**:
  - Review workload forecast is 450–700 changed lines, above the 400-line review budget.
  - Tasks record a single-PR size exception for this session (delivery decision: `size:exception / exception-ok`).

## Completed Tasks

- [x] **WU1 RED** — Add failing backend observability tests for DSN gating, sample-rate
  defaults, invalid numeric warning/fallback, bootstrap framework boundary, `/health`,
  and `/debug-sentry`.
  - Created `apps/api/tests/__init__.py`
  - Created `apps/api/tests/test_sentry_bootstrap.py` (9 tests — confirmed RED before bootstrap existed)
  - Created `apps/api/tests/test_main.py` (5 tests — confirmed RED before `/debug-sentry` existed)
  - Added `pytest==8.3.5` to `[dependency-groups] dev` in `apps/api/pyproject.toml`
  - Ran `uv sync` to regenerate `uv.lock`

- [x] **WU2 GREEN** — Add framework-agnostic Sentry bootstrap module, runtime dependency,
  and lockfile update.
  - Created `apps/api/app/observability/__init__.py`
  - Created `apps/api/app/observability/sentry.py` — exposes `init_sentry() -> bool` and
    private `_parse_sample_rate(var_name, raw, default=0.0) -> float`; no FastAPI/Starlette
    imports; uses `os.getenv` at call time; stdlib `logging` for invalid-value warnings.
  - Added `sentry-sdk==2.64.0` to `[project] dependencies` in `apps/api/pyproject.toml`
  - Ran `uv sync` to regenerate `uv.lock`
  - Verified: `uv run pytest tests/test_sentry_bootstrap.py` → **9 passed**

- [x] **WU3 GREEN** — Wire FastAPI host adapter; add `/debug-sentry`.
  - Edited `apps/api/app/main.py`: import and call `init_sentry()` at module level (before
    `app = FastAPI(...)`); added `GET /debug-sentry` raising `ZeroDivisionError`.
  - Verified: `uv run pytest tests/test_main.py` → **5 passed**
  - Verified CI smoke: import smoke + `/health` contract both pass.

- [x] **WU4 TRIANGULATE** — Backend env config and documentation.
  - Created `apps/api/.env.example` with Sentry placeholder vars and guidance comments.
  - Created `apps/api/README.md` (Spanish) documenting local dev, optional Sentry setup,
    env var table, quick-start steps, and `/debug-sentry` verification note.
  - Edited `.gitignore`: added `/apps/api/.env` mirroring `/apps/web/.env` (line 18).

- [x] **WU5 REFACTOR** — Keep slice small and boundary-clean.
  - Fixed all ruff E501 line-length violations in test files (wrapped long function
    signatures to multi-line form; refactored long assertions into named variables).
  - Confirmed bootstrap module has no FastAPI/Starlette imports (test + manual inspection).
  - Public API of `app/observability/sentry.py` remains `init_sentry()` plus testable
    private helper `_parse_sample_rate`.
  - `uv run ruff check .` → **All checks passed!**

- [x] **WU6 Final Verification** — Run all backend verification commands and surface
  review budget.

## Files Changed

| File | Change |
| --- | --- |
| `apps/api/pyproject.toml` | Added `sentry-sdk==2.64.0` (runtime) and `pytest==8.3.5` (dev) |
| `apps/api/uv.lock` | Regenerated via `uv sync` |
| `apps/api/app/main.py` | Added `init_sentry()` call and `GET /debug-sentry` route |
| `apps/api/app/observability/__init__.py` | New (empty package init) |
| `apps/api/app/observability/sentry.py` | New — framework-agnostic bootstrap module |
| `apps/api/tests/__init__.py` | New (empty test package init) |
| `apps/api/tests/test_sentry_bootstrap.py` | New — 9 unit tests for bootstrap |
| `apps/api/tests/test_main.py` | New — 5 host-adapter integration tests |
| `pyrightconfig.json` | New — root Pyright config for API source/import resolution |
| `apps/api/.env.example` | New — Sentry env var placeholder/guidance |
| `apps/api/README.md` | New — Spanish backend README with Sentry docs |
| `.gitignore` | Added `/apps/api/.env` line |

## Verification Evidence

### TDD Cycle Evidence

| Task | Cycle | Evidence |
| --- | --- | --- |
| WU1 | RED | `uv run pytest tests/` → 9 bootstrap tests fail (`ModuleNotFoundError`), 1 main test fails (404 on `/debug-sentry`) |
| WU2 | GREEN | `uv run pytest tests/test_sentry_bootstrap.py` → 9 passed |
| WU3 | GREEN | `uv run pytest tests/test_main.py` → 5 passed |
| WU5 | REFACTOR | `uv run ruff check .` → All checks passed |
| WU6 | Verify | Full suite 14/14 passed; smoke checks OK |

### Final Command Run Results

```
uv sync --frozen                          → Checked 28 packages (clean)
uv run ruff check .                       → All checks passed!
uv run python -c "from app.main import app; print(app.title)"
                                          → Kaito API
uv run python -c "TestClient /health"    → health contract: OK
uv run pytest tests/ -v                  → 14 passed, 58 warnings
lsp_diagnostics on new API Python files   → No diagnostics found
uv run python -c "from app.observability.sentry import init_sentry; assert init_sentry() is False"
                                          → OK (no DSN → False)
git diff --stat                           → 4 tracked files, 90+, 2−
```

### Review Budget

| Metric | Value |
| --- | --- |
| Tracked file changed lines (`git diff --stat`) | 92 |
| New untracked file lines (observability + tests + docs + pyrightconfig) | 475 |
| **Total** | **~567** |
| Forecast from tasks | 450–700 |
| Budget | 400 |
| Delivery decision | **single-PR size exception — approved** |

> ⚠️ **Review burden surface**: the PR will be ~567 changed/added lines. The bulk
> is `uv.lock` (+68 lines), test files (~280 lines), and the Spanish README (~97 lines).
> The core logic files (`sentry.py` 76 lines, `main.py` +15 lines) are small and
> reviewable. Recommend opening the PR with the work-unit commit split so reviewers
> can reason about each unit independently.

## Deviations from Design

| Item | Design | Applied | Reason |
| --- | --- | --- | --- |
| Bootstrap path | `app/observability/sentry.py` or `app/sentry.py` | `app/observability/sentry.py` | Preferred concrete path chosen |
| `init_sentry()` call timing | Module import time or lifespan hook (both acceptable) | Module import time (before `app = FastAPI(...)`) | Simplest; design explicitly allows this |
| Test framework | `pytest` optional | `pytest==8.3.5` added as dev dep | Structured tests preferred; deterministic isolation with monkeypatch |

## Review Findings Correction Pass (2026-07-09)

### Blockers addressed

| Finding | Resolution |
| --- | --- |
| **DSN-present deterministic tests** — no test verified `sentry_sdk.init` was called with correct args | Added `test_init_sentry_returns_true_and_calls_sdk_init_when_dsn_present` and `test_init_sentry_uses_defaults_when_optional_vars_absent` to `test_sentry_bootstrap.py`; both patch `sentry_sdk.init` to prevent real network; assert exact `dsn`, `environment`, `traces_sample_rate`, `profiles_sample_rate` kwargs |
| **Host-adapter test with DSN present (mocked)** — no `test_main.py` test covered the DSN-present code path | Added `test_health_with_dsn_present_and_sdk_mocked` to `test_main.py`; patches `sentry_sdk.init`, reloads `app.main` with `SENTRY_DSN` set, asserts `/health` → 200 and `mock_init.assert_called_once()` with correct `dsn`/`environment` |

### Non-blocking reliability hardening addressed

| Finding | Resolution |
| --- | --- |
| **Sample-rate range/finiteness validation** — `_parse_sample_rate` only caught non-numeric strings, not out-of-range floats or non-finite values | Added `import math`; extended `_parse_sample_rate` to check `math.isfinite(value)` and `0.0 <= value <= 1.0`; logs WARNING + falls back to `0.0` on violation |
| **Tests for range/finiteness** | Added `test_parse_sample_rate_warns_and_falls_back_for_out_of_range` (tests `1.5`, `-0.1`) and `test_parse_sample_rate_warns_and_falls_back_for_non_finite` (tests `"inf"`, `"nan"`) |

### Tracked risk resolved by post-4R correction

> ✅ **`/debug-sentry` is now gated** — the original apply pass left the route
> unconditionally registered, but the post-4R correction changed host wiring so
> `/debug-sentry` is registered only when `ENABLE_DEBUG_SENTRY=true` is present
> at application startup. When the flag is absent or any other value, the route
> returns the normal FastAPI 404.

### Correction-pass verification commands

```
uv run ruff check .           → All checks passed!
uv run pytest tests/ -q       → 19 passed, 68 warnings (was 14)
bootstrap import smoke        → OK (init_sentry() is False with no DSN)
health smoke (TestClient)     → OK (200 {"status": "ok"})
```

### New test count

| File | Before | After |
| --- | --- | --- |
| `tests/test_sentry_bootstrap.py` | 9 | 13 (+2 DSN-present, +2 range/finite) |
| `tests/test_main.py` | 5 | 6 (+1 health with DSN mocked) |
| **Total** | **14** | **19** |

### Files changed in correction pass

| File | Change |
| --- | --- |
| `apps/api/app/observability/sentry.py` | Added `import math`; extended `_parse_sample_rate` with range/finiteness guard |
| `apps/api/tests/test_sentry_bootstrap.py` | Added 4 new tests (2 DSN-present deterministic, 2 range/finiteness) |
| `apps/api/tests/test_main.py` | Added 1 new test (health with DSN present, SDK mocked) |

## API Folder Validation Follow-up (2026-07-09)

A read-only audit confirmed `apps/api` is correctly configured as the current
FastAPI backend host when commands run with `working-directory: apps/api`. The
framework-agnostic Sentry boundary remains valid because the core bootstrap lives
in `app/observability/sentry.py` and does not import FastAPI/Starlette.

### CI blocker addressed

| Finding | Resolution |
| --- | --- |
| CI did not run backend pytest, so Sentry DSN/config contracts were local-only | Added `Run API tests` to `.github/workflows/ci.yml` with `working-directory: apps/api` and `uv run pytest tests/` |

### Follow-up verification commands

```text
uv sync --frozen            → Checked 28 packages
uv run ruff check .         → All checks passed!
uv run pytest tests/ -q     → 19 passed, 68 warnings
```

## Post-4R Correction Pass (2026-07-09)

A targeted correction pass addressed 8 findings raised during 4R review
before PR creation.  Full detail in
`openspec/changes/archive/2026-07-08-setup-sentry-backend/post-4r-corrections.md`.

| Finding | Resolution summary |
| --- | --- |
| 1 — Gate `/debug-sentry` behind `ENABLE_DEBUG_SENTRY=true` | Route only registered when flag is `true`; 404 otherwise. Tests added for both states. |
| 2 — Graceful malformed DSN handling | `init_sentry()` wraps `sentry_sdk.init` in `try/except`; logs ERROR + returns `False`. Regression tests added. |
| 3 — README `.env` mismatch | Documented `--env-file .env` (uvicorn ≥ 0.19 / pinned 0.34.0) and `export` as two explicit options; added no-auto-load caveat. |
| 4 — Strengthen framework boundary test | Replaced globals-walk with `ast.parse` + `ast.walk` over source; catches any import form including `from fastapi import FastAPI`. |
| 5 — Reduce duplication | `tests/conftest.py` created with `clear_sentry_env` + `reload_main` helpers; both test files now use shared helpers. |
| 6 — Update canonical spec | Added gateway, malformed-DSN, and docs requirements with scenarios. |
| 7 — Update `.env.example` | Added `ENABLE_DEBUG_SENTRY=false` with guidance comment. |
| 8 — Audit trail note | Created `post-4r-corrections.md` in archive; this section updated. |

### Post-4R verification commands

```text
uv sync --frozen            → Checked 28 packages (clean)
uv run ruff check .         → All checks passed!
uv run pytest tests/ -q     → 25 passed, 86 warnings
import smoke                → Kaito API
/health smoke               → 200 {"status": "ok"}
```

**Test count after post-4R pass: 25** (was 19 after previous correction pass).

New files in this pass:

| File | Change |
| --- | --- |
| `apps/api/app/observability/sentry.py` | Wrapped `sentry_sdk.init` in try/except |
| `apps/api/app/main.py` | Added `ENABLE_DEBUG_SENTRY` gate |
| `apps/api/tests/conftest.py` | New — shared helpers |
| `apps/api/tests/test_sentry_bootstrap.py` | AST boundary test, malformed DSN tests, shared helper |
| `apps/api/tests/test_main.py` | Gate tests, malformed DSN startup test, reduced duplication |
| `apps/api/README.md` | env-file docs, `ENABLE_DEBUG_SENTRY`, malformed DSN note |
| `apps/api/.env.example` | Added `ENABLE_DEBUG_SENTRY=false` |
| `openspec/specs/backend-observability/spec.md` | Gate requirement, malformed DSN requirement |
| `openspec/changes/archive/.../post-4r-corrections.md` | New audit trail note |

## Remaining Tasks

None. All 6 tasks are `[x]` in `tasks.md`. All 4R findings fully addressed.

## Workload / PR Boundary

Single PR under recorded `size:exception`. Suggested work-unit commits:

1. `feat(api/observability): add failing sentry backend tests (RED)` — WU1
2. `feat(api/observability): add framework-agnostic sentry bootstrap (GREEN)` — WU2
3. `feat(api/observability): wire fastapi adapter with /debug-sentry (GREEN)` — WU3
4. `docs(api): add sentry env example and spanish readme (TRIANGULATE)` — WU4
5. `refactor(api/observability): clean bootstrap api and fix ruff (REFACTOR)` — WU5
6. `test(api/observability): add deterministic DSN-present and range validation tests` — review correction
7. `fix(api/observability): gate debug-sentry, graceful DSN, strengthen boundary test` — post-4R corrections
