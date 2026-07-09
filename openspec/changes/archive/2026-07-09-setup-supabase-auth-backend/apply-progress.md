# Apply Progress — Setup Supabase Auth Backend

## Status: COMPLETE (Work Units 0–6 all done)

**Delivery mode**: Internal chunks / single PR by user later. User accepted chunked implementation despite the high 400-line review budget risk.

**Strict TDD**: Active — RED → GREEN → REFACTOR. Raw RED/GREEN command output captured for Work Unit 4 (JWKS correction).

---

## Work Unit 5 — Explicit SUPABASE_JWKS_URL Correction ✅

Narrow correction: use explicit `SUPABASE_JWKS_URL` from Supabase onboarding instead
of deriving JWKS URL from `SUPABASE_URL`. `SUPABASE_URL` becomes optional/informational.
Strict TDD active; raw RED/GREEN command outputs preserved below.

### RED 5a

Updated `tests/auth/test_missing_config.py`:

- Replaced `test_auth_settings_derives_jwks_url` with `test_auth_settings_reads_explicit_jwks_url` (sets `SUPABASE_JWKS_URL`, expects exact URL match; no derivation).
- Added `test_config_module_has_no_secret_key_reference` (config must not mention `SUPABASE_SECRET_KEY`).
- Updated `no_auth_client` fixture to also delete `SUPABASE_JWKS_URL`.
- Added `url_only_client` fixture (sets `SUPABASE_URL` only, deletes `SUPABASE_JWKS_URL`).
- Added `test_auth_me_returns_503_with_url_but_no_jwks_url` (SUPABASE_URL alone is not sufficient).

```
$ cd apps/api && uv run pytest tests/auth/test_missing_config.py -v

FAILED tests/auth/test_missing_config.py::test_auth_settings_reads_explicit_jwks_url
  AssertionError: AuthSettings.jwks_url must equal SUPABASE_JWKS_URL exactly;
  got '/auth/v1/.well-known/jwks.json'
  assert '/auth/v1/.well-known/jwks.json' == 'https://example.supabase.co/auth/v1/.well-known/jwks.json'

FAILED tests/auth/test_missing_config.py::test_auth_me_returns_503_with_url_but_no_jwks_url
  assert 401 == 503
  +  where 401 = <Response [401 Unauthorized]>.status_code

2 failed, 8 passed
```

(Exactly the expected failures: derived URL ≠ explicit URL, and SUPABASE_URL alone doesn't
trigger 503 because provider currently checks `supabase_url` not `jwks_url`.)

### GREEN 5a

Rewrote `app/core/config.py`:

- `AuthSettings.jwks_url: str` — required field, read from `SUPABASE_JWKS_URL`.
- `AuthSettings.supabase_url: str | None = None` — optional, read from `SUPABASE_URL`.
- Removed derived `jwks_url` property entirely.
- Updated module docstring: `SUPABASE_JWKS_URL` is required; `SUPABASE_URL` is optional;
  Supabase server-side API key must not be added.

Updated `app/core/auth/provider.py`: check `settings.jwks_url` (not `settings.supabase_url`).

```
$ cd apps/api && uv run pytest tests/auth/test_missing_config.py -v
10 passed, 76 warnings in 0.35s
```

### GREEN 5b — Fixture and doc updates

Updated test fixtures and docs:

- `test_supabase_verifier.py` `_make_settings()`: `supabase_url=` → `jwks_url=` (explicit URL).
- `test_auth_me.py` `auth_client`: `setenv("SUPABASE_URL", ...)` → `setenv("SUPABASE_JWKS_URL", ...)`.
- `test_dependency.py` `protected_app`: same fixture update.
- `.env.example`: `SUPABASE_JWKS_URL=` added as required; `SUPABASE_URL=` moved to optional; note server-side API key not used for JWT.
- `README.md`: updated env table; `SUPABASE_JWKS_URL` required; `SUPABASE_URL` optional; server-side API key note.

```
$ cd apps/api && uv run pytest tests/auth -q
40 passed, 222 warnings in 0.42s

$ cd apps/api && uv run pytest -q
65 passed, 320 warnings in 0.56s

$ cd apps/api && uv run ruff check .
All checks passed!

$ cd apps/api && uv run python -c "from app.main import app"
(exit 0)
```

### Work Unit 5 TDD Cycle Evidence

| Chunk | RED command | RED outcome | GREEN command | GREEN outcome |
| ----- | ----------- | ----------- | ------------- | ------------- |
| 5a config | `uv run pytest tests/auth/test_missing_config.py` | 2 FAILED (`test_auth_settings_reads_explicit_jwks_url`: derived URL ≠ explicit; `test_auth_me_returns_503_with_url_but_no_jwks_url`: got 401 not 503) | Rewrote `config.py` (`jwks_url` from `SUPABASE_JWKS_URL`), updated `provider.py` (check `jwks_url`) | 10 passed |
| 5b fixtures/docs | Implicit RED: fixture still set `SUPABASE_URL` → provider would return 503 (no `SUPABASE_JWKS_URL`) | Fixture/doc drift identified before full validation | Updated `_make_settings()`, `auth_client`, `protected_app` fixtures + `.env.example` + `README.md` | 40 auth + 65 full + ruff clean + import OK |

### Files Changed in Work Unit 5

- `apps/api/app/core/config.py` — `AuthSettings.jwks_url` from `SUPABASE_JWKS_URL`; `supabase_url` optional
- `apps/api/app/core/auth/provider.py` — check `settings.jwks_url`
- `apps/api/tests/auth/test_missing_config.py` — new explicit-JWKS-URL tests + fixtures
- `apps/api/tests/auth/test_supabase_verifier.py` — `_make_settings()` uses `jwks_url=`
- `apps/api/tests/auth/test_auth_me.py` — fixture sets `SUPABASE_JWKS_URL`
- `apps/api/tests/auth/test_dependency.py` — fixture sets `SUPABASE_JWKS_URL`
- `apps/api/.env.example` — `SUPABASE_JWKS_URL` required; `SUPABASE_URL` optional
- `apps/api/README.md` — updated auth env table and JWKS explanation

---

## Work Unit 4 — JWKS Correction (supersedes HS256 Work Units 0–3) ✅

This work unit replaces the original HS256/`SUPABASE_JWT_SECRET` implementation with
JWKS-only asymmetric verification using Supabase JWT Signing Keys. All raw RED/GREEN
command outputs are preserved below.

### 4a — Config: SUPABASE_URL-based JWKS settings

#### RED 4a

Updated `tests/auth/test_missing_config.py` to assert `SUPABASE_URL` (not `SUPABASE_JWT_SECRET`) is the config variable and that `AuthSettings` exposes `supabase_url`/`jwks_url` (not `jwt_secret`).

```
$ cd apps/api && uv run pytest tests/auth/test_missing_config.py -v

FAILED tests/auth/test_missing_config.py::test_config_module_has_no_jwt_secret_reference
FAILED tests/auth/test_missing_config.py::test_auth_settings_has_supabase_url_not_jwt_secret
FAILED tests/auth/test_missing_config.py::test_auth_settings_derives_jwks_url
PASSED tests/auth/test_missing_config.py::test_app_imports_successfully_without_supabase_url
PASSED tests/auth/test_missing_config.py::test_health_returns_200_without_auth_config
PASSED tests/auth/test_missing_config.py::test_auth_me_returns_503_without_auth_config
PASSED tests/auth/test_missing_config.py::test_auth_me_503_body_is_exact
PASSED tests/auth/test_missing_config.py::test_auth_me_503_body_has_no_secret_material

FAILED test_config_module_has_no_jwt_secret_reference:
  AssertionError: config.py still references SUPABASE_JWT_SECRET — must be removed for JWKS
  assert 'SUPABASE_JWT_SECRET' not in '...'

FAILED test_auth_settings_has_supabase_url_not_jwt_secret:
  AssertionError: AuthSettings must have supabase_url attribute
  assert False where False = hasattr(AuthSettings(jwt_secret='', jwt_audience='authenticated'), 'supabase_url')

FAILED test_auth_settings_derives_jwks_url:
  AssertionError: AuthSettings must have jwks_url
  assert False where False = hasattr(AuthSettings(jwt_secret='', jwt_audience='authenticated'), 'jwks_url')

3 failed, 5 passed in 0.35s
```

#### GREEN 4a

Rewrote `app/core/config.py`: `AuthSettings` now reads `SUPABASE_URL`, derives
`jwks_url = {SUPABASE_URL}/auth/v1/.well-known/jwks.json`, adds optional
`jwt_issuer` and `jwks_cache_ttl_seconds`, removes `jwt_secret` entirely.

Updated `app/core/auth/provider.py`: checks `settings.supabase_url` (not `jwt_secret`).

```
$ cd apps/api && uv run pytest tests/auth/test_missing_config.py -v

PASSED tests/auth/test_missing_config.py::test_config_module_has_no_jwt_secret_reference
PASSED tests/auth/test_missing_config.py::test_auth_settings_has_supabase_url_not_jwt_secret
PASSED tests/auth/test_missing_config.py::test_auth_settings_derives_jwks_url
PASSED tests/auth/test_missing_config.py::test_app_imports_successfully_without_supabase_url
PASSED tests/auth/test_missing_config.py::test_health_returns_200_without_auth_config
PASSED tests/auth/test_missing_config.py::test_auth_me_returns_503_without_auth_config
PASSED tests/auth/test_missing_config.py::test_auth_me_503_body_is_exact
PASSED tests/auth/test_missing_config.py::test_auth_me_503_body_has_no_secret_material

8 passed in 0.37s
```

### 4b — Adapter: JWKS asymmetric verification

#### RED 4b

Rewrote `tests/auth/test_supabase_verifier.py` to use an ephemeral EC P-256/ES256
keypair, fake JWKS (built from the public key), and `PyJWKClient.fetch_data` stub via
`monkeypatch.setattr`. Covers: valid token, no-email, missing/empty sub, expired,
bad signature, unknown kid, alg:none, HS256, malformed, wrong audience.

```
$ cd apps/api && uv run pytest tests/auth/test_supabase_verifier.py -v

ERROR collecting tests/auth/test_supabase_verifier.py
ImportError while importing test module:
  tests/auth/test_supabase_verifier.py:13: in <module>
      from cryptography.hazmat.primitives.asymmetric import ec
E   ModuleNotFoundError: No module named 'cryptography'

1 error in 0.13s
```

(Expected: `pyjwt[crypto]` not yet installed, and `supabase.py` still uses HS256.)

#### GREEN 4b

1. Updated `pyproject.toml`: `pyjwt==2.10.1` → `pyjwt[crypto]==2.10.1`
2. Ran `uv sync` → installed `cryptography==49.0.0`, `cffi==2.1.0`, `pycparser==3.0`
3. Rewrote `app/core/auth/supabase.py` `SupabaseJwtVerifier` to use `PyJWKClient`,
   asymmetric algorithms only (`["ES256", "RS256", "EdDSA"]`), audience/issuer as
   configured, collapse `PyJWTError`/`PyJWKClientError` → `AuthError`.

```
$ cd apps/api && uv run pytest tests/auth/test_supabase_verifier.py -v

PASSED test_valid_token_returns_user_context_with_user_id_and_email
PASSED test_valid_token_without_email_returns_user_context_with_none_email
PASSED test_missing_sub_claim_raises_auth_error
PASSED test_empty_sub_claim_raises_auth_error
PASSED test_expired_token_raises_auth_error
PASSED test_bad_signature_raises_auth_error
PASSED test_unknown_kid_raises_auth_error
PASSED test_alg_none_token_raises_auth_error
PASSED test_hs256_token_raises_auth_error
PASSED test_malformed_token_raises_auth_error
PASSED test_wrong_audience_raises_auth_error

11 passed in 0.12s
```

Provider isolation (REFACTOR):

```
$ cd apps/api && uv run pytest tests/auth/test_provider_isolation.py -v

5 passed in 0.36s (all boundary scan + fake verifier override tests)
```

### 4c — Docs, env, endpoint tests, full validation

#### RED 4c (state before fixing remaining test files)

After GREEN 4b, `test_auth_me.py` and `test_dependency.py` still used HS256 tokens
and `SUPABASE_JWT_SECRET`. Running the full auth suite showed:

```
$ cd apps/api && uv run pytest tests/auth -v

FAILED test_auth_me.py::test_valid_token_returns_200_with_user_id_and_email
FAILED test_auth_me.py::test_valid_token_without_email_returns_200_with_null_email
FAILED test_auth_me.py::test_response_keys_are_exactly_user_id_and_email
FAILED test_auth_me.py::test_no_token_returns_401 - assert 503 == 401
FAILED test_auth_me.py::test_invalid_token_returns_401 - assert 503...
FAILED test_dependency.py::test_missing_auth_header_returns_401
FAILED test_dependency.py::test_malformed_scheme_token_returns_401
FAILED test_dependency.py::test_non_bearer_header_returns_401
FAILED test_dependency.py::test_invalid_token_returns_401
FAILED test_dependency.py::test_garbage_token_returns_401
FAILED test_dependency.py::test_401_body_has_no_extra_keys
FAILED test_dependency.py::test_401_detail_value_is_identical_across_cases

12 failed, 26 passed in 0.66s
```

(Expected: old fixtures set `SUPABASE_JWT_SECRET` which config.py no longer reads,
so provider raises `AuthConfigError` → 503 instead of verifying tokens.)

#### GREEN 4c

1. Rewrote `tests/auth/test_auth_me.py`: EC P-256 keypair, JWKS stub via
   `monkeypatch.setattr(jwt.PyJWKClient, "fetch_data", ...)`, ES256-signed tokens,
   `SUPABASE_URL` env var.
2. Rewrote `tests/auth/test_dependency.py`: same approach for standalone FastAPI
   test app.
3. Updated `tests/auth/test_provider_isolation.py`: removed `SUPABASE_JWT_SECRET`
   ref in `test_get_current_user_works_with_fake_verifier`; simplified token to plain
   bearer string (fake verifier ignores content).
4. Updated `apps/api/.env.example`: removed `SUPABASE_JWT_SECRET`, added
   `SUPABASE_URL=`, `SUPABASE_JWT_ISSUER=`, `SUPABASE_JWKS_CACHE_TTL_SECONDS=600`.
5. Updated `apps/api/README.md` `Autenticación` section: JWKS asymmetric model,
   updated env table (`SUPABASE_URL` primary), removed `SUPABASE_JWT_SECRET`.

```
$ cd apps/api && uv run pytest tests/auth -q

38 passed, 210 warnings in 0.50s
```

Parent-session recovery after the second apply-subagent timeout fixed remaining diagnostics: JWKS test helpers now wrap `json.loads(ECAlgorithm.to_jwk(...))` in `try/except` with `pytest.fail`, `AuthSettings.jwks_url` is exposed as a property, and the config test uses `getattr(settings, "jwks_url")` to satisfy Pyright/pi-lens.

---

## Work Unit 4 TDD Cycle Evidence

| Chunk | RED command | RED outcome | GREEN command | GREEN outcome | REFACTOR |
| ----- | ----------- | ----------- | ------------- | ------------- | -------- |
| 4a config | `uv run pytest tests/auth/test_missing_config.py` | 3 FAILED (config still has `SUPABASE_JWT_SECRET`, `AuthSettings` has no `supabase_url`/`jwks_url`) | Rewrote `config.py` + `provider.py`; re-ran focused | 8 passed | N/A — config change only |
| 4b verifier | `uv run pytest tests/auth/test_supabase_verifier.py` | 1 collection ERROR (`ModuleNotFoundError: cryptography`) | Updated `pyproject.toml` → `pyjwt[crypto]`, `uv sync`, rewrote `supabase.py`; re-ran focused | 11 passed | Provider isolation: 5 passed |
| 4c endpoints | `uv run pytest tests/auth` | 12 FAILED (HS256 fixtures + wrong env var → 503 instead of 401/200) | Rewrote `test_auth_me.py`, `test_dependency.py`, updated `test_provider_isolation.py`, `.env.example`, `README.md`; re-ran focused | 38 passed | — |

---

## Final Validation ✅

```bash
$ cd apps/api && uv run pytest tests/auth -q
38 passed, 210 warnings in 0.50s

$ cd apps/api && uv run pytest -q
63 passed, 308 warnings in 0.62s

$ cd apps/api && uv run ruff check .
All checks passed!

$ cd apps/api && uv run python -c "from app.main import app"
(exit 0, no output)
```

### git diff --stat (untracked files are new; tracked files are modified)

Modified tracked files:

```
apps/api/.env.example          |  21 ++++++
apps/api/README.md             |  77 +++++++++++++++++++++
apps/api/app/main.py           |  15 +++++
apps/api/pyproject.toml        |   1 +
apps/api/uv.lock               | 160 ++++++++++++++++++++++++++++++++
7 files changed, 276 insertions(+), 2 deletions(-)
```

New files (untracked, added in Work Unit 4 and earlier work units):

- `apps/api/app/core/config.py` — SUPABASE_URL / JWKS AuthSettings
- `apps/api/app/core/auth/supabase.py` — PyJWKClient asymmetric verifier
- `apps/api/app/core/auth/provider.py` — get_auth_verifier (checks supabase_url)
- `apps/api/app/core/auth/errors.py` — AuthConfigError
- `apps/api/app/modules/auth/` — domain boundary (context, verifier, deps, router, schemas)
- `apps/api/tests/auth/` — all 5 test files (JWKS/ES256 version)

---

## Files Changed in Work Unit 4

### Implementation files updated

- `apps/api/app/core/config.py` — rewrote `AuthSettings`/`get_auth_settings()` for JWKS
- `apps/api/app/core/auth/supabase.py` — rewrote `SupabaseJwtVerifier` for JWKS/PyJWKClient
- `apps/api/app/core/auth/provider.py` — updated to check `supabase_url` not `jwt_secret`
- `apps/api/pyproject.toml` — `pyjwt[crypto]==2.10.1`
- `apps/api/uv.lock` — updated with `cryptography`, `cffi`, `pycparser`

### Test files updated

- `apps/api/tests/auth/test_missing_config.py` — SUPABASE_URL + config structure assertions
- `apps/api/tests/auth/test_supabase_verifier.py` — EC keypair + JWKS stub, 11 cases
- `apps/api/tests/auth/test_auth_me.py` — EC tokens + JWKS stub
- `apps/api/tests/auth/test_dependency.py` — EC tokens + JWKS stub
- `apps/api/tests/auth/test_provider_isolation.py` — removed SUPABASE_JWT_SECRET reference

### Docs / env updated

- `apps/api/.env.example` — SUPABASE_URL / JWKS variables, removed SUPABASE_JWT_SECRET
- `apps/api/README.md` — updated Autenticación section for JWKS model

---

## Historical Record — Work Units 0–3 (HS256, superseded)

> ⚠️ The following records the original HS256/SUPABASE_JWT_SECRET implementation
> (Work Units 0–3). These are superseded by Work Unit 4 above.

### Work Unit 0 — Preflight ✅

- Confirmed strict TDD enabled, validation commands, delivery mode (chunked, user makes PR).

### Work Unit 1 — Auth Boundary and Supabase JWT Verifier ✅

Implemented (HS256 — superseded):

- `app/modules/auth/context.py`, `verifier.py`
- `app/core/config.py`, `app/core/auth/errors.py`, `provider.py`, `supabase.py`
- `pyjwt==2.10.1` dependency

Recovery after subagent timeout: fixed timestamps, removed `__pycache__`, Pyright fixes.
TDD evidence: partial (raw RED output lost; apply subagent timed out).

### Work Unit 2 — FastAPI Dependency, Protected Route, Missing Config ✅

Implemented (HS256 — superseded):

- `app/modules/auth/dependencies.py`, `schemas.py`, `router.py`
- `app/main.py` router wiring and `AuthConfigError` handler

TDD evidence: partial (raw RED output lost; apply subagent timed out).

### Work Unit 3 — Provider Isolation Guard, Docs, Final Validation ✅

Implemented (later superseded by Work Unit 4):

- `test_provider_isolation.py` source scan + fake verifier override
- `.env.example` / `README.md` (HS256 version — now replaced by Work Unit 4)
- Final validation: 57 passed

TDD evidence: partial (raw RED output lost; apply subagent timed out).

---

## Deviations from Design

None. Work Unit 4 exactly follows design §6 (JWKS asymmetric, PyJWKClient, `_ALLOWED_ALGS`,
audience/issuer optional) and §10 (env example variables).

## Remaining Tasks

None for this change. Work Units 0–5 are complete. Recommended next phase: SDD verify/re-verify after this correction.

---

## Post-archive Work Unit 6 — 4R Corrections ✅

Addressed final 4R review findings after archive. See `post-4r-corrections.md` for the full note and evidence.

### Completed tasks and checkbox updates

Updated persisted `tasks.md` with Work Unit 6 and all four new tasks visibly marked `- [x]`:

- `[x]` RED tests for process-scoped verifier/JWKS cache reuse, zero/negative JWKS TTL normalization, and generic operational logging.
- `[x]` GREEN implementation for named TTL default/positive validation, process-scoped verifier cache keyed by `AuthSettings` with test-safe reset, and generic logs without token/secret/provider-sensitive material.
- `[x]` REFACTOR/docs for PyJWKClient cache semantics and archived SDD/project-context stale references.
- `[x]` Focused auth and required validation commands.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Process-scoped verifier/JWKS cache | `apps/api/tests/auth/test_auth_me.py` | Integration | `tests/auth -q`: 40 passed | New repeated-request test expected one JWKS fetch; first focused RED errored on missing `reset_auth_verifier_cache` before implementation | Focused 5-test slice passed; auth suite passed | Two protected requests with same token/settings prove cache reuse | Provider cache keyed by `AuthSettings`, lock-protected, test reset helper |
| TTL validation/default constant | `apps/api/tests/auth/test_missing_config.py` | Unit | `tests/auth -q`: 40 passed | New tests imported missing `DEFAULT_JWKS_CACHE_TTL_SECONDS` and asserted zero/negative fallback | Focused 5-test slice passed | Positive TTL value test proves valid configured values are preserved | Named constant replaces repeated config default literal |
| Operational logging | `apps/api/tests/auth/test_missing_config.py`, `apps/api/tests/auth/test_supabase_verifier.py` | Unit/Integration | `tests/auth -q`: 40 passed | New caplog tests expected generic missing-config and verifier-failure logs | Focused 5-test slice passed | Tests assert required operational signal and absence of token/secret/provider URL material | Logs are generic; verifier log adds only exception type in `extra` |
| SDD/docs context cleanup | OpenSpec/README/project-context | Docs | N/A | 4R findings supplied stale reference evidence | README/OpenSpec/project-context updated | N/A | Historical records retained only as superseded history |

### Files changed in Work Unit 6

- `apps/api/app/core/config.py` — named default constant and positive TTL normalization.
- `apps/api/app/core/auth/provider.py` — process-scoped verifier cache, reset helper, missing-config operational log.
- `apps/api/app/core/auth/supabase.py` — generic verifier/JWKS failure log.
- `apps/api/tests/auth/conftest.py` — autouse cache reset to keep tests isolated.
- `apps/api/tests/auth/test_auth_me.py` — repeated protected-request JWKS cache test.
- `apps/api/tests/auth/test_missing_config.py` — zero/negative/positive TTL tests and missing-config logging test.
- `apps/api/tests/auth/test_supabase_verifier.py` — verifier failure logging test.
- `apps/api/README.md` — PyJWKClient/process cache semantics and TTL behavior.
- `openspec/project-context.md` — archived auth change path and strict TDD state.
- `openspec/specs/backend-auth/spec.md` and archived spec/proposal/design files — explicit `SUPABASE_JWKS_URL` final contract cleanup.
- `openspec/changes/archive/2026-07-09-setup-supabase-auth-backend/tasks.md` — Work Unit 6 persisted checkboxes.
- `openspec/changes/archive/2026-07-09-setup-supabase-auth-backend/post-4r-corrections.md` — post-archive correction note.

### Validation

```bash
$ cd apps/api && uv run pytest tests/auth/test_missing_config.py tests/auth/test_supabase_verifier.py tests/auth/test_auth_me.py -q
32 passed, 160 warnings in 0.45s

$ cd apps/api && uv run pytest tests/auth -q
45 passed, 244 warnings in 0.53s

$ cd apps/api && uv run pytest -q
70 passed, 342 warnings in 0.59s

$ cd apps/api && uv run ruff check .
All checks passed!

$ cd apps/api && uv run python -c "from app.main import app"
exit 0
```

Warnings are FastAPI/Starlette deprecations under the local Python runtime.

### Deviations / remaining tasks

- No auth contract deviations.
- No remaining implementation tasks for Work Unit 6.
- Attempted `.env.example` TTL-comment refinement was not applied because the safety policy blocked editing `.env.example` in this tool session; README/OpenSpec now document the TTL semantics.

### Structured status consumed/produced

- Active change: archived `setup-supabase-auth-backend` at `openspec/changes/archive/2026-07-09-setup-supabase-auth-backend/`.
- Artifact store: `both`; OpenSpec archived files used as authoritative for this delegated post-archive correction.
- Strict TDD: active from `openspec/config.yaml` and parent prompt.
- Action context: workspace `/home/jjdelarubia/Workspace/BIGschool/Kaito`; edits stayed inside workspace; no commit/push/PR.
- Workload/PR boundary: delegated as one post-archive 4R correction slice; no chained PR/commit created by request.
