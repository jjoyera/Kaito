# Onboarding Persistence Specification

## Purpose

Provide owner-scoped snapshots that preserve the canonical contract.

## Requirements

### Requirement: Current owner snapshot

At most one JSONB snapshot per owner MUST be current. Existing saves update it; equivalent retries yield the same state. The capability MUST NOT create history. Availability is stored only as the exact sparse `profile.availability.minutes_by_day` JSONB object; no base duration or category is stored.

#### Scenario: Create, update, and retry a snapshot

- GIVEN an authenticated runner has no snapshot
- WHEN the runner saves a valid draft and later saves it again
- THEN one current record exists with the latest canonical snapshot.

### Requirement: Schema and runtime authority

Supabase CLI migrations MUST solely govern schema, constraints, indexes, and RLS. The system MUST NOT introduce Alembic. FastAPI MUST use SQLAlchemy only for runtime CRUD.

#### Scenario: Schema authority remains singular

- GIVEN the persistence capability is deployed
- WHEN schema or RLS changes are reviewed
- THEN they are represented by Supabase CLI migrations and not Alembic.

### Requirement: Protected owner-derived API

Save and read operations MUST require `UserContext`. The system MUST derive ownership only from verified identity, MUST NOT accept client owner or storage fields, and MUST return only the caller's snapshot and domain result.

#### Scenario: Client owner is rejected

- GIVEN an authenticated request includes an owner identifier
- WHEN it invokes a persistence operation
- THEN the request is rejected without changing another owner's data.

### Requirement: Canonical lifecycle preservation

The system MUST support version `"1"`. It MUST validate before writes and after reads against `onboarding-contract`: sparse typed drafts persist, completed snapshots are valid, invalid completed edits demote to `incomplete`, and hidden answers clear. Removed contract fields are rejected rather than translated, sanitized, migrated, or preserved.

#### Scenario: Completed edit demotes safely

- GIVEN a completed snapshot with a conditional answer
- WHEN an edit makes completion invalid or hides that answer
- THEN the stored and returned snapshot is incomplete, retains typed correctable answers, and clears the hidden answer.

#### Scenario: Malformed or unknown input is not persisted

- GIVEN a save with an unknown version or structurally invalid answer
- WHEN validation runs
- THEN the save is rejected and the current snapshot remains unchanged.

### Requirement: Owner-scoped data access

Every repository read, create, update, and delete MUST be scoped to the verified owner. Database RLS MUST independently enforce owner-only select, insert, update, and delete for authenticated identities.

#### Scenario: Foreign records are inaccessible

- GIVEN two authenticated owners each have a snapshot
- WHEN either repository or database access targets the other owner's record
- THEN it returns no accessible record or is denied, and foreign data is unchanged.

### Requirement: Executable RLS isolation proof

Development and CI MUST run local Docker-backed Supabase tests using two non-privileged identities. They MUST prove own creation/access and denial of select, insert-for, update, and delete against the other, including exact nested availability values. Privileged connections are outside this RLS proof and MUST NOT satisfy it.

#### Scenario: Two-user policy matrix

- GIVEN local Supabase and two authenticated non-privileged identities
- WHEN each performs select, insert, update, and delete attempts for both owners
- THEN own-row operations succeed and every cross-owner operation is denied or affects no row.

### Requirement: Safe failure and observability

The API MUST return safe errors without snapshot contents or owner identifiers. Logs, tests, and diagnostics MUST NOT expose payloads or identities.

#### Scenario: Persistence failure is sanitized

- GIVEN a protected save encounters an unexpected persistence failure
- WHEN the API reports the failure
- THEN the response and log do not contain payload values or an owner identifier.

### Requirement: Rollback and scope boundaries

Rollback MUST disable API composition before destructive removal. A forward CLI migration MUST preserve snapshots unless disposal is authorized. This capability MUST NOT add UI, plan generation, audit history, or architecture-document reconciliation.

#### Scenario: Rollback preserves data by default

- GIVEN persistence must be withdrawn
- WHEN the rollback is applied without disposal authorization
- THEN API access is disabled and stored snapshots remain preserved.
