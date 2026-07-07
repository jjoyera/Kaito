# Web E2E (Browser Testing) Specification — setup-playwright

## Purpose

Establish Playwright as the standard browser-level end-to-end (E2E) testing
foundation for the Kaito web app (`apps/web`). This change delivers one Chromium
homepage smoke test, a documented local developer command, and mandatory PR CI
validation, while retiring the overlapping custom Node smoke script so the
repository has a single clear browser-test path.

This first slice is intentionally narrow: it proves the browser-automation
foundation works against the default local Next.js app and prepares the base for
future product-level E2E flows, without building a broader framework.

> Convention note: this artifact is written as the flat
> `openspec/changes/setup-playwright/spec.md` per the delegated task. Two logical
> domains are affected — a new `web-e2e` capability (full new requirements) and a
> modification to the existing canonical `project-scaffolding` capability (CI
> validation). See the "Modified Canonical Behavior" section and Risks for the
> archive implication.

## Requirements

### Requirement: Playwright tooling and configuration for the web app

`apps/web` SHALL declare Playwright as a development dependency and SHALL provide
a Playwright configuration file that runs browser tests against the default local
Next.js application.

The configuration SHALL:

- Target Chromium only; it SHALL NOT enable Firefox, WebKit, or additional
  browser projects.
- Define a single test directory for E2E specs scoped to `apps/web`.
- Start the Next.js app for the test run (via Playwright's `webServer` or an
  equivalent documented mechanism) against a local URL, reusing an already
  running server locally when available and starting a fresh server in CI.

The configuration SHALL NOT introduce seeded data, fixtures, feature flags,
authentication, backend/API dependencies, or a page-object/helper abstraction
layer.

#### Scenario: Playwright config targets Chromium against the local app

- GIVEN `apps/web` with Playwright installed
- WHEN a contributor inspects the Playwright configuration
- THEN exactly one Chromium browser project SHALL be configured
- AND the configuration SHALL define how the local Next.js app is started/served
  for the test run
- AND no additional browsers, fixtures, auth, or backend dependencies SHALL be
  configured

### Requirement: Homepage smoke E2E test

`apps/web` SHALL include exactly one Playwright smoke test that validates the
default homepage of the local Next.js app.

The test SHALL:

- Navigate to the homepage route (`/`).
- Assert the page loads successfully.
- Assert the stable scaffold text is rendered (the homepage heading
  "Project scaffold is running.").

The suite SHALL remain limited to this single smoke spec. It SHALL NOT add
product-flow coverage, protected-route coverage, multi-page navigation suites, or
visual/screenshot comparison assertions.

#### Scenario: Homepage smoke test passes against the running app

- GIVEN the local Next.js app is available to Playwright
- WHEN the homepage smoke test runs in Chromium
- THEN the homepage SHALL load successfully
- AND the test SHALL assert the stable scaffold heading text is visible
- AND the test SHALL pass

#### Scenario: Smoke test fails when the homepage regresses

- GIVEN the homepage no longer renders or no longer shows the stable scaffold text
- WHEN the homepage smoke test runs in Chromium
- THEN the test SHALL fail with a clear assertion error

#### Scenario: Suite stays scoped to a single smoke spec

- GIVEN the E2E test directory is reviewed
- WHEN its specs are enumerated
- THEN only the single homepage smoke spec SHALL be present
- AND no visual, auth, backend, or multi-flow specs SHALL exist

### Requirement: Local developer command for the browser smoke check

The repository SHALL expose a documented command that lets a contributor run the
Playwright homepage smoke check locally with a single invocation.

The command SHALL be reachable both from `apps/web` and through a root workspace
script, consistent with the existing `pnpm <task>:web` script convention. Local
setup SHALL document how to install the required Chromium browser binary (for
example, a `playwright install chromium` step).

#### Scenario: Contributor runs the smoke check locally

- GIVEN dependencies and the Chromium browser binary are installed
- WHEN the contributor runs the documented Playwright smoke command
- THEN Playwright SHALL start/serve the local app, run the homepage smoke test in
  Chromium, and report pass/fail
- AND the command SHALL be discoverable from the root workspace scripts

### Requirement: Mandatory Playwright validation in PR CI

`.github/workflows/ci.yml` SHALL run the Playwright homepage smoke check on every
pull request as a required validation step, preferably as a dedicated E2E job when
that stays low-overhead.

The CI validation SHALL:

- Install dependencies and the Chromium browser binary explicitly before running.
- Build or start the Next.js app as needed and execute the homepage smoke test.
- Fail the PR check when the smoke test fails.

CI SHALL NOT run deploy, publish, or continuous-delivery steps, and SHALL NOT add
backend/API E2E or auth validation as part of this change.

#### Scenario: PR CI runs the Playwright smoke check

- GIVEN a pull request that changes web files
- WHEN the CI workflow runs
- THEN it SHALL install dependencies and the Chromium browser binary
- AND it SHALL run the homepage smoke test in Chromium
- AND the workflow SHALL fail if the smoke test fails

#### Scenario: CI does not duplicate browser smoke paths

- GIVEN the CI workflow after this change
- WHEN its web validation steps are reviewed
- THEN the Playwright smoke check SHALL be the single browser-level smoke path
- AND the retired custom Node smoke-script steps SHALL NOT also run

### Requirement: Single browser-smoke path (retire the custom smoke script)

The repository SHALL maintain exactly one browser-level homepage smoke path.
Where practical, the current custom Node smoke script and its lifecycle test
(`apps/web/scripts/smoke-root.mjs`, `apps/web/scripts/smoke-root.test.mjs`, and
the `smoke` / `test:smoke-script` scripts, plus the root `smoke:web` and
`test:web-smoke-script` scripts) SHALL be removed or retired so they do not
duplicate Playwright's role.

If any custom smoke artifact is retained, its retention SHALL be justified (for
example, a distinct non-browser check) and it SHALL NOT re-run the same
homepage-text browser assertion that Playwright now owns.

#### Scenario: Custom homepage smoke script is retired

- GIVEN Playwright provides the homepage browser smoke check
- WHEN the repository's smoke-related scripts and CI steps are reviewed
- THEN the overlapping custom Node homepage smoke path SHALL be removed or retired
- AND no two mechanisms SHALL assert the same homepage browser behavior

### Requirement: Documented browser-testing guidance

Contributor documentation SHALL be updated to describe Playwright as the standard
browser-testing path, including the local command, the Chromium install step, and
the fact that PR CI runs this check.

Documentation SHALL clearly state the deferred scope: backend/API E2E and real
auth flows are not covered yet and are planned for after frontend/backend
integration exists.

#### Scenario: Docs describe the new validation path

- GIVEN a contributor reads the updated documentation
- WHEN they look for how to run browser tests
- THEN they SHALL find the documented Playwright local command and Chromium setup
- AND they SHALL find that PR CI runs the Playwright smoke check
- AND they SHALL find that backend/API E2E and real auth are explicitly deferred

## Modified Canonical Behavior

> The canonical `project-scaffolding` spec's **Basic CI validation only**
> requirement previously referenced "smoke-script lifecycle checks". Retiring the
> custom smoke script changes that canonical behavior. This section records the
> intended modification, and the structured delta at
> `openspec/changes/setup-playwright/specs/project-scaffolding/spec.md` was
> authored so sync/archive can apply it cleanly.

### Modified Requirement: Basic CI validation only (project-scaffolding)

The repository SHALL include `.github/workflows/ci.yml` that performs basic
validation only: dependency install, lint/build-level checks, a Playwright
Chromium homepage smoke check, and cheap scaffold smoke checks for the API.

CI SHALL NOT run real product test suites beyond the homepage browser smoke
check, and SHALL NOT perform deployment, publishing, or continuous delivery steps.

(Previously: CI performed "smoke-script lifecycle checks and cheap scaffold smoke
checks" using the custom Node smoke script; the browser smoke path is now owned by
Playwright.)

#### Scenario: CI validates the scaffold with Playwright

- GIVEN a pull request that changes scaffold files
- WHEN the CI workflow runs
- THEN it SHALL install dependencies and run lint/build-level validation plus the
  Playwright Chromium homepage smoke check and the cheap API scaffold checks
- AND it SHALL NOT execute deploy, publish, or CD steps

## Non-Goals

This change explicitly EXCLUDES the following. Each SHALL be considered out of
scope and SHALL NOT be introduced by this slice:

- Backend or API E2E validation of any kind.
- Real authentication flows, session handling, or protected-route coverage.
- Visual regression, screenshot, or snapshot comparison testing.
- Seed data, fixtures, feature flags, or test-environment orchestration beyond the
  default local Next.js app.
- A reusable E2E helper framework, page-object layer, or multi-spec suite.
- Product-flow coverage that does not already exist in the scaffold.
- Cross-browser coverage (Firefox/WebKit) or mobile emulation projects.

#### Scenario: Non-goals are not introduced

- GIVEN the completed change is reviewed
- WHEN its scope is compared against the non-goals list
- THEN none of the excluded capabilities SHALL be present
- AND the change SHALL remain limited to Chromium-only homepage smoke coverage
