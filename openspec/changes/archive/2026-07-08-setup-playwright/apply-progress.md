# Apply Progress — setup-playwright

## Run metadata

- Date: 2026-07-08
- Phase: apply
- Executor mode: interactive, standard mode (strict TDD disabled in `openspec/config.yaml`)
- Delivery path used: single PR with explicit size exception (approved by parent/user)

## Structured status consumed

```yaml
schemaName: spec-driven
changeName: setup-playwright
artifactStore: both
planningHome:
  root: <repo-root>
  changesDir: openspec/changes
changeRoot: openspec/changes/setup-playwright
artifactPaths:
  proposal:
    - openspec/changes/setup-playwright/proposal.md
    - sdd/setup-playwright/proposal
  specs:
    - openspec/changes/setup-playwright/spec.md
    - openspec/changes/setup-playwright/specs/web-e2e/spec.md
    - openspec/changes/setup-playwright/specs/project-scaffolding/spec.md
    - sdd/setup-playwright/spec
  design:
    - openspec/changes/setup-playwright/design.md
    - sdd/setup-playwright/design
  tasks:
    - openspec/changes/setup-playwright/tasks.md
    - sdd/setup-playwright/tasks
  applyProgress:
    - openspec/changes/setup-playwright/apply-progress.md
    - sdd/setup-playwright/apply-progress
artifacts:
  proposal: done
  specs: done
  design: done
  tasks: done
  applyProgress: done
taskProgress:
  total: 15
  complete: 15
  remaining: 0
  unchecked: []
applyState: ready
dependencies:
  apply: ready
  verify: ready
  sync: blocked
  archive: blocked
actionContext:
  mode: repo-local
  workspaceRoot: <repo-root>
  allowedEditRoots:
    - <repo-root>
  warnings: []
nextRecommended: sdd-verify setup-playwright
isNonAuthoritative: false
```

Notes:

- OpenSpec store is authoritative for this run.
- Engram reads for `sdd/setup-playwright/spec|design|tasks` succeeded.
- Previous OpenSpec `apply-progress.md` did not exist; this file is newly created.

## Completed tasks and persisted checkbox updates

All implementation tasks from `openspec/changes/setup-playwright/tasks.md` are complete and were persisted as checked:

- [x] 1. Confirm delivery shape before editing files.
- [x] 2. Add Playwright dependency and web scripts.
- [x] 3. Add Chromium-only Playwright config for the web app.
- [x] 4. Add the single homepage smoke spec.
- [x] 5. Retire the custom Node smoke path.
- [x] 6. Switch CI web validation to Playwright.
- [x] 7. Ignore Playwright-generated outputs.
- [x] 8. Update Spanish contributor documentation.
- [x] 9. Add structured OpenSpec delta for the new capability.
- [x] 10. Add structured OpenSpec delta for modified project scaffolding behavior.
- [x] 11. Verify local Playwright install and run.
- [x] 12. Run existing web validation that remains relevant.
- [x] 13. Run existing API validation that remains relevant.
- [x] 14. Review final scope constraints.
- [x] 15. Validate OpenSpec artifacts before requesting review.

## Files changed

- `apps/web/package.json`
- `package.json`
- `apps/web/playwright.config.ts` (new)
- `apps/web/e2e/homepage.spec.ts` (new)
- `apps/web/scripts/smoke-root.mjs` (deleted)
- `apps/web/scripts/smoke-root.test.mjs` (deleted)
- `.github/workflows/ci.yml`
- `.gitignore`
- `README.md`
- `openspec/changes/setup-playwright/specs/web-e2e/spec.md` (new)
- `openspec/changes/setup-playwright/specs/project-scaffolding/spec.md` (new)
- `pnpm-lock.yaml`
- `openspec/changes/setup-playwright/tasks.md`
- `openspec/changes/setup-playwright/apply-progress.md` (new)

## Verification evidence

### Playwright / web validation

- `pnpm install` ✅ success
- `pnpm --filter web exec playwright install chromium` ✅ success
  - Environment note: Playwright reported fallback download for `ubuntu20.04-x64` because current OS is not officially supported.
- `pnpm test:web-e2e` ✅ success (1 passed)
- `pnpm lint:web` ✅ success
- `pnpm build:web` ✅ success
- `pnpm run test:web-smoke-script` ✅ expected failure (`Missing script`)
- `pnpm run smoke:web` ✅ expected failure (`Missing script`)

### API validation

- `cd apps/api && uv run ruff check .` ✅ success
- `cd apps/api && uv run python -c "from app.main import app; print(app.title)"` ✅ success (`Kaito API`)
- `cd apps/api && uv run python -c "from fastapi.testclient import TestClient; from app.main import app; response = TestClient(app).get('/health'); assert response.status_code == 200; assert response.json() == {'status': 'ok'}"` ✅ success

### OpenSpec validation

- `pnpm exec openspec validate setup-playwright` ⚠️ blocked/tool unavailable (`Command "openspec" not found`).
- Manual consistency review completed across:
  - `openspec/changes/setup-playwright/spec.md`
  - `openspec/changes/setup-playwright/design.md`
  - `openspec/changes/setup-playwright/specs/web-e2e/spec.md`
  - `openspec/changes/setup-playwright/specs/project-scaffolding/spec.md`

## Scope/constraint checks

- `apps/web/e2e/` contains exactly one file: `homepage.spec.ts`.
- Playwright config defines one project only: Chromium / Desktop Chrome.
- No auth/session handling, backend/API E2E, fixtures, page objects, visual tests, or multi-flow specs added.
- CI now has one browser smoke path (`pnpm test:web-e2e`) and no deploy/publish/CD steps were introduced.

## Deviations from design/tasks

- No functional deviations.
- Documentation/local command references root command `pnpm test:web-e2e` and Chromium install command `pnpm --filter web exec playwright install chromium` (matches task intent).

## Remaining tasks

None in `tasks.md` (0 unchecked lines).

## Workload / PR boundary

- Implemented as one change set under approved size exception.
- Diff remains deletion-heavy due retirement of custom smoke script/test files, consistent with design recommendation.

## Post-review fixes (2026-07-08)

Addressed review follow-ups without changing scope:

- Added CI-focused Playwright guard in `apps/web/playwright.config.ts`:
  - `forbidOnly: !!process.env.CI` to fail CI when focused tests (`test.only`) are committed.
- Updated `apps/web/e2e/homepage.spec.ts` to use semantic locator coverage:
  - Replaced `#scaffold-title` locator assertion with
    `page.getByRole("heading", { name: "Project scaffold is running." })`.
- Updated only the derived testing context in `openspec/config.yaml`:
  - Replaced legacy web smoke script runner/commands with Playwright E2E equivalents.

### Post-review validation evidence

- `pnpm test:web-e2e` ✅ success (1 passed)
- `pnpm lint:web` ✅ success
- `pnpm build:web` ✅ success
