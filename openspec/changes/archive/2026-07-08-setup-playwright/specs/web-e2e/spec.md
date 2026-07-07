# Web E2E Specification Delta

## ADDED Requirements

### Requirement: Playwright tooling and configuration for the web app

`apps/web` SHALL declare Playwright as a development dependency and SHALL provide
a Playwright configuration file that runs browser tests against the default local
Next.js application.

The configuration SHALL:

- Target Chromium only and SHALL NOT enable Firefox, WebKit, or additional browser projects.
- Define one test directory for E2E specs scoped to `apps/web`.
- Start the Next.js app for test runs and reuse an existing local server when available.
- Start a fresh server in CI.

The configuration SHALL NOT introduce fixtures, auth/session handling,
backend/API dependencies, seeded data, page objects, or helper frameworks.

#### Scenario: Playwright config targets Chromium against the local app

- GIVEN `apps/web` with Playwright installed
- WHEN a contributor inspects the Playwright configuration
- THEN exactly one Chromium browser project SHALL be configured
- AND local server startup/reuse and CI startup behavior SHALL be defined
- AND no fixtures, auth, or backend dependencies SHALL be configured

### Requirement: Homepage smoke E2E test

`apps/web` SHALL include exactly one Playwright smoke test that validates the
default homepage.

The test SHALL:

- Navigate to `/`.
- Assert the homepage loads successfully.
- Assert the stable scaffold heading text `Project scaffold is running.` is visible.

The suite SHALL remain limited to this single smoke spec and SHALL NOT include
visual/screenshot assertions, auth flows, backend checks, or multi-flow coverage.

#### Scenario: Homepage smoke test passes against the running app

- GIVEN the local Next.js app is available to Playwright
- WHEN the homepage smoke test runs in Chromium
- THEN the homepage SHALL load
- AND the scaffold heading SHALL be asserted as visible
- AND the test SHALL pass

### Requirement: Local developer command for browser smoke checks

The repository SHALL expose a documented command to run the Playwright homepage
smoke test locally with one invocation, reachable from both `apps/web` scripts and
root workspace scripts.

Local setup SHALL document how to install the Chromium browser binary.

#### Scenario: Contributor runs the smoke check locally

- GIVEN dependencies and Chromium are installed
- WHEN the contributor runs the documented command
- THEN Playwright SHALL run the homepage smoke check in Chromium
- AND the command SHALL be discoverable from the root workspace scripts

### Requirement: Mandatory Playwright validation in PR CI

`.github/workflows/ci.yml` SHALL run the Playwright Chromium homepage smoke check
on every pull request as required validation.

CI validation SHALL:

- Install dependencies and the Chromium browser binary explicitly before running tests.
- Execute the homepage smoke test and fail when it fails.
- Avoid deploy/publish/CD steps.

#### Scenario: PR CI runs Playwright smoke check

- GIVEN a pull request that changes web files
- WHEN CI runs
- THEN dependencies and Chromium SHALL be installed
- AND the homepage smoke check SHALL run in Chromium
- AND the workflow SHALL fail if the smoke check fails

### Requirement: Single browser-smoke path

The repository SHALL maintain a single browser-level homepage smoke path.
Overlapping custom Node smoke artifacts and scripts SHALL be removed so the same
homepage browser behavior is not validated by duplicate mechanisms.

#### Scenario: No duplicated browser smoke path remains

- GIVEN repository smoke scripts and CI steps are reviewed
- WHEN Playwright is the configured browser smoke runner
- THEN overlapping custom Node homepage smoke checks SHALL NOT remain

### Requirement: Documented browser-testing guidance

Contributor documentation SHALL describe Playwright as the standard browser testing
path, including Chromium install, local run command, and PR CI behavior.

Documentation SHALL also state that backend/API E2E and real auth flows remain
deferred.

#### Scenario: Docs describe browser testing and deferred scope

- GIVEN a contributor reads updated documentation
- WHEN they look for browser testing guidance
- THEN they SHALL find Chromium install and local Playwright run commands
- AND they SHALL find PR CI coverage notes
- AND they SHALL find that backend/API E2E and real auth are deferred
