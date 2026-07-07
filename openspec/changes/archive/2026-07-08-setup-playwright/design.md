# Design — Setup Playwright

## 1. Context and constraints

This design turns the approved `setup-playwright` proposal and spec into concrete
technical decisions. It establishes Playwright as the single browser-level smoke
path for `apps/web`, retires the custom Node smoke script, and wires the check
into PR CI.

Observed repository reality (design inputs, not implemented here):

- Root `package.json`: pnpm 11 workspaces (`apps/web`, `packages/api-client`),
  Node `>=24.18 <25`. Web scripts follow two shapes: `<task>:web`
  (`dev:web`, `build:web`, `lint:web`, `smoke:web`) and `test:web-smoke-script`.
- `apps/web/package.json` scripts: `dev`, `build`, `lint` (`eslint . --max-warnings=0`),
  `smoke`, `test:smoke-script`. Dependencies: Next 16.2.10, React 19.
- Homepage (`apps/web/app/page.tsx`) renders the stable heading
  `Project scaffold is running.` inside `<h1 id="scaffold-title">`.
- Custom smoke path: `apps/web/scripts/smoke-root.mjs` (~150 lines) plus
  `apps/web/scripts/smoke-root.test.mjs` (~180 lines). It spawns `next dev`, polls
  the homepage, and asserts the same heading text Playwright will now own.
- `.github/workflows/ci.yml` has a `web` job (checkout → setup Node 24.18 → setup
  pnpm 11 → `pnpm install` → `lint:web` → `build:web` → `test:web-smoke-script` →
  `smoke:web`) and a separate `api` job.
- Root `README.md` is in Spanish (per `documentation_language: es`), documents
  `pnpm smoke:web`, and includes a future-update rule requiring README updates
  whenever scaffold commands change.
- Canonical spec `openspec/specs/project-scaffolding/spec.md` → requirement
  **Basic CI validation only** explicitly references "smoke-script lifecycle checks".

Technical artifacts are authored in English (`technical_artifact_language: en`);
the Spanish README is the one exception that stays in Spanish.

## 2. Decisions

### D1 — CI shape: extend the existing `web` job (not a dedicated job)

**Decision:** Add the Playwright steps to the existing `web` job rather than
create a separate `e2e` job.

**Rationale:** The proposal/spec prefer a dedicated E2E job "when that stays
low-overhead". Here it does not: a dedicated job would duplicate checkout, Node
setup, pnpm setup, and `pnpm install` (~30 extra YAML lines and a second cold
install + build), while the `web` job already installs deps and builds the app —
exactly what the Playwright `webServer` needs. Extending the job is the simpler,
review-safe, lower-overhead option and still satisfies the spec's low-overhead
condition. The proposal's "preferably dedicated" is honored in spirit: the E2E
check remains a first-class, required step.

**Resulting `web` job step order:**

1. Checkout
2. Set up Node 24.18
3. Set up pnpm 11
4. `pnpm install`
5. `pnpm lint:web`
6. `pnpm build:web`
7. **New:** `pnpm --filter web exec playwright install --with-deps chromium`
8. **New:** `pnpm test:web-e2e`
9. **Removed:** `pnpm test:web-smoke-script`
10. **Removed:** `pnpm smoke:web`

`--with-deps` installs the Chromium binary plus required OS libraries on the
`ubuntu-latest` runner. No browser caching is added in this slice (keeps the diff
small and avoids cache-invalidation subtlety); caching can be a later
optimization if CI time becomes a concern.

**Alternative (rejected for now):** dedicated `e2e` job. Documented here so a
future change can split it out once E2E grows beyond one spec.

### D2 — App startup: Playwright `webServer`, env-conditional command

**Decision:** Use Playwright's built-in `webServer` with a single
environment-conditional configuration:

- Local: `command: 'pnpm dev'`, `reuseExistingServer: true` — Playwright reuses a
  dev server if one is already running, otherwise starts one.
- CI: `command: 'pnpm start'` (production `next start` against the artifact from
  step 6 `build:web`), `reuseExistingServer: false`.
- `url: 'http://127.0.0.1:3000'`, with a startup timeout (e.g. 120s).

Implemented as `command: process.env.CI ? 'pnpm start' : 'pnpm dev'` and
`reuseExistingServer: !process.env.CI`.

**Rationale:** `webServer` keeps startup/teardown inside Playwright (no manual
spawn/kill lifecycle to maintain — this is precisely what the old script did by
hand). In CI, testing the built app (`next start`) mirrors production behavior and
is deterministic; the build already exists from step 6, so `next start` is cheap.
Locally, `pnpm dev` + `reuseExistingServer` gives fast iteration and satisfies the
spec requirement to "reuse an already running server locally when available".

**Supporting change:** ensure `apps/web/package.json` exposes the existing
`"start": "next start"` script required for the CI `webServer` command.

### D3 — Scripts and naming

`apps/web/package.json` (add):

- `"start": "next start"`
- `"test:e2e": "playwright test"`
- `"test:e2e:install": "playwright install chromium"` (local convenience;
  documented for contributors)

`apps/web/package.json` (remove): `"smoke"`, `"test:smoke-script"`.

Root `package.json` (add): `"test:web-e2e": "pnpm --filter web test:e2e"`.

Root `package.json` (remove): `"smoke:web"`, `"test:web-smoke-script"`.

**Rationale:** `test:web-e2e` mirrors the existing `test:web-smoke-script`
naming pattern it conceptually replaces, and remains discoverable from the root as
required by the spec. Local Chromium install is exposed as
`apps/web` `test:e2e:install` and documented as
`pnpm --filter web exec playwright install chromium` from the root.

### D4 — Chromium-only browser install strategy

- **Config:** one `projects` entry using `devices['Desktop Chrome']`; no Firefox,
  WebKit, or mobile projects.
- **Local:** contributors run `pnpm --filter web exec playwright install chromium`
  (or `pnpm --filter web test:e2e:install`) once. Documented in README.
- **CI:** `pnpm --filter web exec playwright install --with-deps chromium` before
  running tests (installs binary + OS deps on the runner). Chromium only.

`@playwright/test` is added as a `devDependency` of `apps/web`. The Playwright
version pin will be a fixed version (consistent with the repo's exact-version
pinning style, e.g. `next: "16.2.10"`).

### D5 — Retire the custom Node smoke path (no duplication)

Delete outright (nothing in them is a distinct non-browser check worth retaining —
they assert the same homepage heading Playwright now owns):

- `apps/web/scripts/smoke-root.mjs`
- `apps/web/scripts/smoke-root.test.mjs`
- (remove the now-empty `apps/web/scripts/` directory)

Remove the corresponding scripts (D3) and the two CI steps (D1). After this change
Playwright is the single browser-smoke mechanism; no two mechanisms assert the
same homepage behavior, satisfying the "single browser-smoke path" requirement and
the "CI does not duplicate browser smoke paths" scenario.

### D6 — Structured OpenSpec deltas for clean archival

**Problem:** The current flat `changes/setup-playwright/spec.md` cannot be
auto-applied by archive tooling, and it modifies the canonical
`project-scaffolding` **Basic CI validation only** requirement (which references
"smoke-script lifecycle checks").

**Decision:** Author two structured delta files during the tasks/apply phase so
`openspec archive` applies cleanly:

1. `openspec/changes/setup-playwright/specs/web-e2e/spec.md` — a new capability
   with `## ADDED Requirements` mirroring the flat spec's `web-e2e` requirements
   (Playwright config, homepage smoke test, local command, mandatory PR CI
   validation, single browser-smoke path, documented guidance) with their
   scenarios. This creates `openspec/specs/web-e2e/spec.md` on archive.
2. `openspec/changes/setup-playwright/specs/project-scaffolding/spec.md` — a
   `## MODIFIED Requirements` delta for **Basic CI validation only**, replacing
   "smoke-script lifecycle checks" with "a Playwright Chromium homepage smoke
   check" (text already drafted in the flat spec's "Modified Canonical Behavior"
   section), including the updated scenario.

The flat `spec.md` remains the human-readable narrative; the structured deltas are
the machine-applicable source of truth for archival. This keeps the canonical
`project-scaffolding` spec correct after archive without manual editing.

## 3. Data flow / control flow

CI (PR): `pnpm install` → `lint:web` → `build:web` (produces `.next`) →
`playwright install --with-deps chromium` → `test:web-e2e` → Playwright starts
`next start` on 127.0.0.1:3000 → Chromium loads `/` → asserts `#scaffold-title`
text → server torn down by Playwright → job passes/fails accordingly.

Local: contributor runs `pnpm --filter web test:e2e:install` once, then
`pnpm test:web-e2e` → Playwright reuses running `pnpm dev` or starts one → same
assertion.

## 4. File changes (planned, not implemented in this phase)

Added:

- `apps/web/playwright.config.ts` — Chromium-only, `testDir: './e2e'`,
  env-conditional `webServer`, base URL `http://127.0.0.1:3000`.
- `apps/web/e2e/homepage.spec.ts` — single smoke spec: navigate `/`, assert the
  `Project scaffold is running.` heading (target `#scaffold-title`) is visible.
- `openspec/changes/setup-playwright/specs/web-e2e/spec.md` — ADDED delta.
- `openspec/changes/setup-playwright/specs/project-scaffolding/spec.md` — MODIFIED
  delta.

Modified:

- `apps/web/package.json` — add `start`, `test:e2e`, `test:e2e:install`, add
  `@playwright/test` devDependency; remove `smoke`, `test:smoke-script`.
- `package.json` — add `test:web-e2e`; remove `smoke:web`, `test:web-smoke-script`.
- `.github/workflows/ci.yml` — add Chromium install + `test:web-e2e` steps; remove
  the two custom smoke steps.
- `pnpm-lock.yaml` — Playwright dependency additions (mechanical).
- `README.md` (Spanish) — replace `pnpm smoke:web` guidance with the Playwright
  local command + Chromium install step; note PR CI runs Playwright; state that
  backend/API E2E and real auth are deferred; update "Funcionalidades actuales" /
  validation bullet.
- `.gitignore` — add Playwright outputs: `apps/web/playwright-report/`,
  `apps/web/test-results/`, `apps/web/blob-report/`, `apps/web/playwright/.cache/`.

Removed:

- `apps/web/scripts/smoke-root.mjs`
- `apps/web/scripts/smoke-root.test.mjs`

## 5. Contracts

- **Homepage assertion contract:** the smoke test depends on the stable heading
  `Project scaffold is running.` (`#scaffold-title`). If the scaffold homepage
  copy changes, this test must be updated in lockstep.
- **CI contract:** the `web` job fails the PR when the Playwright smoke test fails;
  no deploy/publish/CD steps are added.
- **Scope contract (non-goals):** Chromium-only, one spec, no fixtures/auth/backend/
  visual/multi-browser. Enforced by config + single-spec directory.

## 6. Testing strategy

- The Playwright homepage smoke test is itself the new automated test.
- No unit tests are added; the deleted `smoke-root.test.mjs` unit tests covered the
  now-removed custom lifecycle code and are intentionally dropped.
- Verification during apply: `pnpm test:web-e2e` locally (after Chromium install)
  and the updated CI `web` job green on the PR.
- Lint consideration: `apps/web` lint is `eslint . --max-warnings=0`, so
  `playwright.config.ts` and `e2e/*.ts` will be linted — they must be warning-free
  under `eslint-config-next`. Confirm during apply that the `e2e` directory does not
  break `next build` type-checking (isolate via tsconfig `exclude` only if needed).

## 7. Rollout / rollback

- **Rollout:** single change; CI switches from custom smoke steps to Playwright in
  the same PR so there is never a duplicate browser smoke path in `main`.
- **Rollback:** revert the PR to restore `smoke-root.*`, the `smoke`/`smoke:web`
  scripts, and the prior CI steps; remove Playwright config/dep. Documented in the
  proposal's rollback section.

## 8. Review workload estimate and split recommendation

Rough changed-line estimate (excluding `pnpm-lock.yaml`, which is mechanical):

| Area | Lines |
| --- | --- |
| Delete `smoke-root.mjs` + `smoke-root.test.mjs` | ~330 (deletions) |
| `playwright.config.ts` | ~30 |
| `e2e/homepage.spec.ts` | ~15 |
| `package.json` (root + web) | ~10 |
| CI workflow edits | ~12 |
| README (es) updates | ~15 |
| Structured deltas (2 files) | ~70 |
| `.gitignore` | ~5 |
| **Total** | **~490 changed lines** |

This exceeds the 400-line session review budget, but the overage is dominated by
~330 lines of **mechanical deletions** of a self-contained script and its tests,
which carry low review cost. The `pnpm-lock.yaml` churn is additional but should be
treated as generated.

**Recommendation:** Keep this as a **single change/PR**. Splitting risks a
transient state where both the old smoke script and Playwright run in CI, which the
spec explicitly forbids ("CI SHALL NOT duplicate browser smoke paths"). Ask the
reviewer to acknowledge the deletion-heavy diff against the 400-line budget.

**Fallback split (only if the reviewer requires staying under budget):**

- **PR1 (core, ~410 net incl. deletions):** add Playwright config/test/deps/scripts,
  switch CI to Playwright, and delete the custom smoke script in the same PR (keeps
  the "no duplication" invariant intact).
- **PR2 (~90 lines):** README (es) updates + the two structured OpenSpec deltas.

This split keeps CI consistent at every step and defers only documentation and
spec-delta authoring to a second, small, low-risk PR.

## 9. Open questions for tasks phase

- Confirm exact Playwright version pin at implementation time.
- Confirm whether `next build` type-checking picks up `e2e/*.ts`; add tsconfig
  `exclude` only if it does.
