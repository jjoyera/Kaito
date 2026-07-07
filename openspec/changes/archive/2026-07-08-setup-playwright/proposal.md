# Proposal — Setup Playwright

Define the first browser-level end-to-end test foundation for the existing Next.js
web scaffold.

The goal is to replace the custom Node-based homepage smoke check with a standard
Playwright-based PR safety net that developers can also run locally, while keeping
this first slice intentionally narrow.

## Quick path

1. Add Playwright tooling and baseline configuration for `apps/web`.
2. Create one smoke test that verifies the default homepage loads and shows stable
   scaffold text.
3. Expose simple local commands for developers to run the browser smoke check.
4. Integrate the Playwright check into CI in a simple way, preferably as a
   dedicated E2E job if that stays low-overhead.
5. Remove or retire overlapping custom smoke-script validation so the repo has one
   clear browser-test path.

## Assumption summary from proposal questions

- The first Playwright test should only verify the homepage and its stable
  scaffold text, with minimal navigation/assertion only if the current app already
  exposes an obvious route worth covering.
- Playwright is required as a PR CI safety net and must also be available through
  a local developer command.
- CI should prefer a dedicated Playwright/E2E job if that remains simple, though
  the exact workflow placement can be finalized in design.
- The environment is the default local Next.js app only, with no seeded state,
  feature flags, real auth, backend dependency, or data infrastructure.
- Scope is limited to one smoke test plus the minimum supporting config; this is
  not the moment to build a broader E2E framework or helper layer.
- This slice does not validate backend/API behavior or real authentication.
  Instead, it prepares the base for future browser-level flows that can exercise
  login, API calls, and UI updates once frontend/backend integration exists.

## Intent

Adopt Playwright as the standard browser-testing foundation for the web app so the
project has a conventional, maintainable E2E path ready for future feature slices.

## Scope

### In scope

- Playwright dependency and config for `apps/web`.
- One browser smoke test against the existing homepage scaffold.
- Local commands to install/run Playwright in a developer-friendly way.
- CI integration for Playwright-based validation.
- Rationalization of the current custom homepage smoke-check path where it would
  otherwise duplicate Playwright's role.
- Minimal documentation updates for the new validation path.

### Out of scope

- Backend or API E2E validation.
- Real auth flows, session handling, or protected-route coverage.
- Seed data, fixtures, feature flags, or test environment orchestration beyond the
  default local Next.js app.
- A reusable E2E helper framework, page-object layer, or multi-spec suite.
- Product-flow coverage that does not already exist in the scaffold.

## Affected areas

- Root workspace scripts: expose a standard Playwright run path.
- `apps/web`: add Playwright config and the initial browser smoke test.
- CI workflow: add or extend a job to run Playwright validation in PRs.
- Existing smoke validation: evaluate removal/replacement of the current custom
  Node-based homepage smoke script.
- Documentation: update contributor guidance for local browser testing.

## Current-state gap

The repository currently validates the frontend through lint/build and a custom
Node smoke script that manually starts Next.js and checks page text. That proves a
basic scaffold works, but it does not establish the standard browser automation
foundation the project wants for future user-facing E2E coverage.

## Risks

- Browser-test setup can increase CI runtime and dependency weight if not kept
  minimal.
- Running Playwright in CI may introduce environment-specific failures if browser
  installation and startup assumptions are not explicit.
- Keeping both the old smoke script and new Playwright path would create duplicate
  maintenance and unclear testing expectations.
- A too-ambitious first slice could exceed the review budget or accidentally imply
  support for backend/auth scenarios that do not exist yet.

## Rollback

- Remove Playwright dependencies, config, scripts, and workflow steps if the setup
  proves unstable or too costly for the current scaffold stage.
- Restore the prior smoke-check path if browser-based validation must be deferred.
- Revert documentation updates that describe Playwright as the default path if the
  rollback returns the repo to its previous validation model.

## Success criteria

- Contributors can run one documented Playwright smoke command locally.
- PR CI executes a Playwright-based browser smoke check against the web app.
- The initial Playwright test verifies the homepage loads and renders the stable
  scaffold text.
- The setup remains limited to one smoke test and minimal supporting
  configuration.
- The proposal and follow-on design clearly state that backend/API E2E and real
  auth are deferred until frontend integration exists.

## Review notes

- Keep this slice focused on establishing the browser-test foundation, not on
  expanding product coverage.
- Prefer convention and simplicity over helper abstractions.
- Treat replacement of the existing custom smoke path as desirable where practical
  so the repo has one clear browser-level safety net.
- Keep implementation small enough to fit the 400-line review budget unless later
  task breakdown recommends splitting work.

## Next step

Wait for proposal approval before starting spec and/or design work for the
Playwright setup change.
