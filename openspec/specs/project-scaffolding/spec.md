# Project Scaffolding Specification

## Purpose

Define the verifiable behavior of Kaito's initial monorepo scaffold. This
specification turns the repository from documentation-only into a clearly bounded
monorepo foundation where contributors can identify boundaries, run the web and
API apps locally, and pass a basic CI check — without introducing product
features, databases, auth, or deployment concerns.

Scope is limited to structure, runnable boundaries, local convenience, basic CI,
and living-document README requirements. Product/domain implementation is out of
scope and covered by later changes.

## Requirements

### Requirement: Monorepo boundaries and top-level structure

The repository SHALL be organized as a modular monorepo whose top-level
structure makes application and package boundaries identifiable at a glance,
aligned with `docs/08-architecture.md`.

The top-level layout SHALL include at minimum:

- `apps/web/` — frontend application boundary.
- `apps/api/` — backend application boundary.
- `packages/api-client/` — reserved shared package boundary.
- `docker/` — local development container assets.
- `.github/workflows/` — CI configuration.
- Existing `docs/` and `openspec/` directories SHALL remain unchanged in purpose.

The scaffold SHALL NOT introduce application or package boundaries beyond those
listed above.

#### Scenario: Contributor identifies boundaries

- GIVEN a contributor clones the repository at the scaffold state
- WHEN they inspect the top-level directory tree
- THEN they SHALL see `apps/web`, `apps/api`, `packages/api-client`, `docker/`,
  and `.github/workflows/`
- AND each boundary's role SHALL be discoverable from the root `README.md`

#### Scenario: No out-of-scope boundaries added

- GIVEN the scaffold change is applied
- WHEN the top-level structure is reviewed
- THEN no directories implying database, auth, AI, or deployment infrastructure
  SHALL be present

### Requirement: pnpm workspace configuration

The repository SHALL define a `pnpm` workspace that registers the JavaScript/
TypeScript workspace members `apps/web` and `packages/api-client`.

A root workspace manifest SHALL declare the workspace package globs, and a
`pnpm-workspace.yaml` (or equivalent supported configuration) SHALL enumerate the
member paths. The Python-based `apps/api` is not a `pnpm` workspace member.

#### Scenario: Workspace members resolve

- GIVEN a contributor runs `pnpm install` at the repository root
- WHEN installation completes
- THEN `apps/web` and `packages/api-client` SHALL be recognized as workspace
  members
- AND no runtime product dependencies beyond the minimal scaffold SHALL be
  required to install

### Requirement: apps/web minimal runnable Next.js boundary

`apps/web` SHALL contain a minimal, runnable Next.js application that starts
locally through a documented command and serves at least one page.

The app SHALL NOT implement onboarding, dashboard, training, auth, or any product
feature. It SHALL exist only to prove the frontend boundary is runnable.

#### Scenario: Web app starts locally

- GIVEN dependencies are installed
- WHEN the contributor runs the documented web dev command
- THEN the Next.js dev server SHALL start without errors
- AND at least one page SHALL render successfully in a browser

### Requirement: apps/api minimal runnable FastAPI boundary with health endpoint

`apps/api` SHALL contain a minimal, runnable FastAPI application that starts
locally through a documented command and exposes a `GET /health` endpoint.

The `/health` endpoint SHALL return a successful HTTP `200` response indicating
service liveness. The app SHALL NOT implement domain modules, persistence, auth,
or AI logic.

#### Scenario: API health endpoint responds

- GIVEN the FastAPI app is running locally through the documented command
- WHEN a `GET /health` request is sent
- THEN the response status SHALL be `200`
- AND the response body SHALL indicate a healthy/ok status

#### Scenario: API has no domain logic

- GIVEN the scaffold API is reviewed
- WHEN its routes are enumerated
- THEN only the health endpoint (and framework defaults such as docs) SHALL be
  present
- AND no persistence, auth, or AI code SHALL be wired in

### Requirement: packages/api-client reserved placeholder boundary

`packages/api-client` SHALL exist as a reserved shared-package boundary with
placeholder metadata and documentation only. It SHALL NOT export a real API
contract, generated client, or runtime consumer surface.

Its documentation SHALL clearly state that the package is reserved and not yet a
committed contract, to prevent it from being mistaken for an implemented client.

#### Scenario: Placeholder is clearly reserved

- GIVEN a contributor opens `packages/api-client`
- WHEN they read its metadata and documentation
- THEN it SHALL be described as a reserved future shared package
- AND it SHALL NOT expose any real API contract or generated client code

### Requirement: Docker local convenience for web and api only

The repository SHALL provide `docker/` assets and a root compose file that allow
running `web` and `api` locally as a developer convenience.

Compose SHALL define services for `web` and `api` only. It SHALL NOT define a
database, cache, message broker, or any deployment/CD-oriented service, and it
SHALL NOT imply production/deployment readiness.

#### Scenario: Compose runs web and api

- GIVEN Docker is available locally
- WHEN the contributor runs the documented compose command
- THEN only `web` and `api` services SHALL start
- AND no database or other backing service SHALL be defined or started

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

### Requirement: Spanish root README as living document

The root `README.md` SHALL be written in Spanish and SHALL serve as the living
entry point for the repository. It SHALL document, at minimum:

- overview (visión general del proyecto),
- stack (tecnologías principales),
- install (instalación de dependencias),
- run (cómo ejecutar web y API localmente),
- structure (estructura del monorepo),
- current functionalities (funcionalidades disponibles actualmente), and
- an explicit future-update rule.

The future-update rule SHALL state that any later change which modifies the
scaffolded structure, commands, or available functionality MUST update the
Spanish root `README.md` accordingly.

#### Scenario: README documents the scaffold in Spanish

- GIVEN the scaffold change is applied
- WHEN a contributor reads the root `README.md`
- THEN it SHALL be in Spanish
- AND it SHALL contain overview, stack, install, run, structure, and current
  functionalities sections
- AND it SHALL state the rule that future scaffold-affecting changes must update
  the README

#### Scenario: Commands in README are runnable

- GIVEN a contributor follows the install and run instructions in `README.md`
- WHEN they execute the documented commands verbatim
- THEN the web app and API SHALL start as described
- AND the `/health` endpoint SHALL respond successfully

### Requirement: Explicit scope exclusions

The scaffold SHALL NOT introduce any of the following, which are deferred to later
changes: Supabase (Auth or PostgreSQL), local database wiring, SQLAlchemy,
Alembic, authentication, Strava integration, AI/RAG, onboarding, domain workflows,
training-plan logic, and real deployment/hosting/CD.

#### Scenario: Excluded concerns are absent

- GIVEN the scaffold change is applied
- WHEN the repository is reviewed for the excluded concerns
- THEN no Supabase, database, SQLAlchemy, Alembic, auth, Strava, AI/RAG,
  onboarding, training-plan, or deployment/CD code or configuration SHALL be
  present
