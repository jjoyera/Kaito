# Project Scaffolding Specification Delta

## MODIFIED Requirements

### Requirement: Basic CI validation only

The repository SHALL include `.github/workflows/ci.yml` that performs basic
validation only: dependency install, lint/build-level checks, a Playwright
Chromium homepage smoke check, and cheap scaffold smoke checks for the API.

CI SHALL NOT run real product test suites beyond the homepage browser smoke
check, and SHALL NOT perform deployment, publishing, or continuous delivery
steps.

#### Scenario: CI validates the scaffold with Playwright

- GIVEN a pull request that changes scaffold files
- WHEN the CI workflow runs
- THEN it SHALL install dependencies and run lint/build-level validation plus
  the Playwright Chromium homepage smoke check and cheap API scaffold checks
- AND it SHALL NOT execute deploy, publish, or CD steps
