# Tasks — setup-playwright

## Review Workload Forecast

| Field | Value |
| ------- | ------- |
| Estimated changed lines | ~490 changed lines excluding `pnpm-lock.yaml`; lockfile churn additional/generated |
| 400-line budget risk | High |
| Chained PRs recommended | Yes, unless the reviewer approves a size exception |
| Suggested split | Prefer single PR size exception to preserve the single browser-smoke path; fallback PR 1 core Playwright + CI switch + smoke deletion → PR 2 README + OpenSpec structured deltas |
| Delivery strategy | single PR size exception approved by user |
| Chain strategy | single PR |

Decision needed before apply: Completed — user approved a single PR / size exception.
Chained PRs recommended: Not for this delivery; single PR approved to avoid a transient duplicate browser-smoke path.
Chain strategy: single PR
400-line budget risk: High, accepted by user due deletion-heavy diff.

Review workload note: design estimated ~490 changed lines, above the 400-line session budget, mostly from mechanical deletion of `apps/web/scripts/smoke-root.mjs` and `apps/web/scripts/smoke-root.test.mjs`. The user approved a single PR / size exception before apply.

## Implementation Tasks

- [x] 1. Confirm delivery shape before editing files.
  - Ask the user whether to proceed as a single PR/size exception or use the fallback split.
  - Do not start implementation until this decision is recorded.

- [x] 2. Add Playwright dependency and web scripts.
  - Modify `apps/web/package.json`:
    - add exact-pinned `@playwright/test` under `devDependencies`;
    - add scripts: `start: "next start"`, `test:e2e: "playwright test"`, `test:e2e:install: "playwright install chromium"`;
    - remove scripts: `test:smoke-script`, `smoke`.
  - Modify `package.json`:
    - add root script `test:web-e2e: "pnpm --filter web test:e2e"`;
    - remove root scripts `test:web-smoke-script`, `smoke:web`.
  - Run dependency installation as part of apply so `pnpm-lock.yaml` is updated.

- [x] 3. Add Chromium-only Playwright config for the web app.
  - Add `apps/web/playwright.config.ts`.
  - Configure `testDir: "./e2e"`, one Chromium/Desktop Chrome project only, `baseURL: "http://127.0.0.1:3000"`.
  - Configure `webServer` with `command: process.env.CI ? "pnpm start" : "pnpm dev"`, `reuseExistingServer: !process.env.CI`, `url: "http://127.0.0.1:3000"`, and an explicit startup timeout.
  - Do not add Firefox, WebKit, mobile, fixtures, auth, backend dependencies, page objects, or helper framework.

- [x] 4. Add the single homepage smoke spec.
  - Add `apps/web/e2e/homepage.spec.ts`.
  - Include exactly one Playwright spec that navigates to `/` and asserts `#scaffold-title` / heading text `Project scaffold is running.` is visible.
  - Keep `apps/web/e2e/` limited to this single spec file.

- [x] 5. Retire the custom Node smoke path.
  - Delete `apps/web/scripts/smoke-root.mjs`.
  - Delete `apps/web/scripts/smoke-root.test.mjs`.
  - Remove the now-empty `apps/web/scripts/` directory if no files remain.
  - Verify no remaining scripts or CI steps call `smoke-root`, `test:smoke-script`, `test:web-smoke-script`, or `smoke:web`.

- [x] 6. Switch CI web validation to Playwright.
  - Modify `.github/workflows/ci.yml` in the existing `web` job.
  - Keep install, lint, and build steps.
  - Add Chromium install step after build: `pnpm --filter web exec playwright install --with-deps chromium`.
  - Add Playwright run step: `pnpm test:web-e2e`.
  - Remove `pnpm test:web-smoke-script` and `pnpm smoke:web` steps.
  - Do not add deploy, publish, CD, backend E2E, or auth validation.

- [x] 7. Ignore Playwright-generated outputs.
  - Modify `.gitignore` to add:
    - `/apps/web/playwright-report/`
    - `/apps/web/test-results/`
    - `/apps/web/blob-report/`
    - `/apps/web/playwright/.cache/`

- [x] 8. Update Spanish contributor documentation.
  - Modify `README.md` in Spanish.
  - Replace `pnpm smoke:web` guidance with Playwright browser-smoke guidance.
  - Document one-time Chromium setup, e.g. `pnpm --filter web exec playwright install chromium` or `pnpm --filter web test:e2e:install`.
  - Document local run command `pnpm test:web-e2e`.
  - Note PR CI runs the Playwright Chromium smoke check.
  - Update current-functionality/validation wording to remove the custom smoke script and mention backend/API E2E and real auth remain deferred.

- [x] 9. Add structured OpenSpec delta for the new capability.
  - Add `openspec/changes/setup-playwright/specs/web-e2e/spec.md`.
  - Use `## ADDED Requirements`.
  - Include requirements and scenarios for: Playwright tooling/config, homepage smoke E2E, local developer command, PR CI validation, single browser-smoke path, documented browser-testing guidance.
  - Keep the delta consistent with `openspec/changes/setup-playwright/spec.md` and the Chromium-only/non-goal constraints.

- [x] 10. Add structured OpenSpec delta for modified project scaffolding behavior.
  - Add `openspec/changes/setup-playwright/specs/project-scaffolding/spec.md`.
  - Use `## MODIFIED Requirements`.
  - Modify requirement `Basic CI validation only` so CI validation includes dependency install, lint/build checks, a Playwright Chromium homepage smoke check, and cheap API scaffold smoke checks.
  - Replace references to `smoke-script lifecycle checks` with Playwright wording.
  - Include the updated scenario from the flat spec/design.

- [x] 11. Verify local Playwright install and run.
  - Run `pnpm install`.
  - Run `pnpm --filter web exec playwright install chromium`.
  - Run `pnpm test:web-e2e`.
  - If `next build` or lint includes E2E files unexpectedly, only add a targeted `apps/web/tsconfig.json` exclude if verification proves it is required.

- [x] 12. Run existing web validation that remains relevant.
  - Run `pnpm lint:web`.
  - Run `pnpm build:web`.
  - Confirm removed commands are no longer expected: `pnpm test:web-smoke-script` and `pnpm smoke:web` should not exist after this change.

- [x] 13. Run existing API validation that remains relevant.
  - Run `cd apps/api && uv run ruff check .`.
  - Run `cd apps/api && uv run python -c "from app.main import app; print(app.title)"`.
  - Run `cd apps/api && uv run python -c "from fastapi.testclient import TestClient; from app.main import app; response = TestClient(app).get('/health'); assert response.status_code == 200; assert response.json() == {'status': 'ok'}"`.

- [x] 14. Review final scope constraints.
  - Confirm only one E2E spec exists under `apps/web/e2e/`.
  - Confirm Playwright config has only Chromium/Desktop Chrome.
  - Confirm no fixtures, auth/session handling, backend/API E2E, visual tests, screenshots, page objects, or multi-flow specs were added.
  - Confirm `.github/workflows/ci.yml` has one browser-smoke path and no deployment/publish/CD steps.

- [x] 15. Validate OpenSpec artifacts before requesting review.
  - Review `openspec/changes/setup-playwright/spec.md`, `design.md`, and both structured deltas for consistency.
  - If OpenSpec validation tooling is available in the environment, run the repository's standard validation command for change `setup-playwright` and record the result in the apply summary.
