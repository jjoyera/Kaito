# Onboarding Persistence Specification

## Purpose

Provide owner-scoped API and JSONB persistence that round-trips the reduced onboarding contract and exact sparse availability without introducing a new storage shape or compatibility behavior.

## Requirements

### Requirement: Current owner JSONB snapshot

At most one JSONB onboarding snapshot per verified owner MUST be current. A save MUST create or replace that owner's canonical snapshot, equivalent retries MUST yield the same state, and the capability MUST NOT create snapshot history. JSONB storage MUST preserve the nested `profile.availability.minutes_by_day` object with its exact sparse weekday keys and integer values; it MUST NOT add, round, normalize, or derive a base-duration field.

#### Scenario: Exact nested availability round-trips

- GIVEN an authenticated owner saves availability containing Monday at 45, Wednesday at 75, and Saturday at 120 minutes
- WHEN the owner's stored JSONB snapshot is read back
- THEN the same three nested keys and exact integer values are returned
- AND no unavailable weekday, null placeholder, habitual duration, category, or range is present.

#### Scenario: Existing owner updates one current snapshot

- GIVEN an authenticated owner already has a snapshot
- WHEN a valid revised snapshot is saved and retried
- THEN one current record exists for that owner with the latest canonical value.

### Requirement: Protected owner-derived read and write API

Onboarding read and save operations MUST require verified `UserContext` and MUST derive ownership only from `UserContext.user_id`. The API MUST NOT accept client-supplied owner or storage identifiers. Save MUST validate the full supplied snapshot before writing it, and read MUST validate the stored snapshot before returning it. The read response MUST be sufficient to hydrate the exact selected weekdays and minute values that were last successfully saved.

#### Scenario: Save then read preserves exact availability

- GIVEN a valid authenticated save contains a sparse exact availability map
- WHEN the same owner performs the onboarding read operation
- THEN the API returns the same exact map
- AND the client can hydrate it without consulting any presentation-only base state.

#### Scenario: Client-supplied ownership is rejected

- GIVEN an authenticated request includes an owner identifier controlled by the client
- WHEN it invokes onboarding read or save
- THEN the request is rejected or the client field is excluded from the accepted contract
- AND another owner's data is not read or changed.

### Requirement: Canonical validation and clean-state reduction

Persistence MUST support contract version `"1"` unless an explicit future translator exists. It MUST preserve structurally valid sparse drafts, enforce completion through `onboarding-contract`, demote invalid completed edits to `incomplete`, and clear hidden conditional answers. It MUST use the reduced clean-state contract that excludes `training_years`, `completed_race_count_range`, `practiced_modalities`, `practiced_terrain`, and `goal.technicality`.

The persistence boundary MUST NOT implement a migration, compatibility parser, legacy translator, payload sanitizer, or preservation behavior for those removed fields. A structurally invalid save MUST leave the current snapshot unchanged. A stored snapshot that violates the clean-state premise MUST produce a safe failure rather than being silently rewritten.

#### Scenario: Reduced contract saves without removed fields

- GIVEN a valid onboarding snapshot omits all five removed fields
- WHEN the authenticated owner saves it
- THEN the snapshot is accepted without removed-field diagnostics
- AND the persisted JSONB does not contain those fields.

#### Scenario: Invalid save is atomic

- GIVEN an owner has a valid current snapshot
- WHEN a save contains a structurally invalid availability value or a noncanonical removed field
- THEN the save is rejected
- AND the previously stored snapshot remains unchanged
- AND no compatibility or sanitization branch rewrites the request.

#### Scenario: Stale stored shape fails safely

- GIVEN a stored snapshot unexpectedly contains a removed field
- WHEN the API reads it under the clean-state contract
- THEN the API returns a sanitized failure
- AND it does not translate, strip, migrate, or return the stale shape as canonical data.

### Requirement: Owner-scoped data access and RLS

Every repository read, create, update, and delete MUST be scoped to the verified owner. Database row-level security MUST independently enforce owner-only select, insert, update, and delete for authenticated non-privileged identities. Exact nested availability data MUST be visible only to its owner.

#### Scenario: Owner accesses exact nested availability

- GIVEN an authenticated owner has a JSONB snapshot with mixed exact daily values
- WHEN that owner reads the row through the protected database path
- THEN the owner's complete exact availability map is returned.

#### Scenario: Foreign owner cannot access or mutate availability

- GIVEN two authenticated non-privileged owners each have a snapshot
- WHEN either identity attempts to select, insert for, update, or delete the other owner's row
- THEN the operation is denied or affects no row
- AND no foreign nested availability value is disclosed or changed.

### Requirement: Schema authority and no migration for this change

Supabase CLI migrations MUST remain the sole authority for schema, constraints, indexes, and RLS, while FastAPI and SQLAlchemy MUST remain runtime CRUD consumers. This change MUST NOT add a database migration, column, table, index, JSONB transformation, or Alembic behavior because exact availability already fits the current snapshot JSONB and removed-field records are assumed deleted operationally.

#### Scenario: Persistence shape remains unchanged

- GIVEN the Step 4 and reduced-contract behavior is delivered
- WHEN database artifacts are reviewed
- THEN onboarding still uses the existing owner-scoped JSONB snapshot shape and policies
- AND no migration or base-duration storage is introduced.

### Requirement: Sanitized failures and diagnostics

API responses, logs, diagnostics, test output, and observability events MUST NOT expose raw onboarding snapshots, exact schedule contents, owner identifiers, bearer credentials, or storage internals. Expected validation and persistence failures MUST use bounded, actionable error classifications that allow the UI to retain answers and retry without disclosing sensitive data.

#### Scenario: Persistence failure is sanitized

- GIVEN an authenticated save encounters an unexpected persistence failure
- WHEN the API and observability boundaries report it
- THEN they identify the safe failure class
- AND they contain no payload values, exact availability, raw owner identity, credentials, or storage details.

### Requirement: Persistence and isolation verification

Automated verification MUST prove API save/read hydration of exact sparse availability, JSONB nested-value round-trip, atomic rejection of invalid writes, reduced-contract behavior, and owner isolation. The RLS proof MUST run against local Supabase with at least two authenticated non-privileged identities and MUST cover own-row and cross-owner select, insert, update, and delete behavior. Mock-only browser or repository tests MUST NOT be treated as sufficient evidence for JSONB or RLS behavior.

#### Scenario: Focused persistence suite runs

- GIVEN the API and local Supabase verification environments
- WHEN the focused automated suite runs
- THEN exact mixed daily values survive API and JSONB round trips
- AND invalid writes preserve the previous row
- AND every cross-owner operation is denied or affects no row
- AND the reduced clean-state contract is exercised without compatibility behavior.

### Requirement: Persistence documentation consistency

Directly affected data-model, architecture, functional-requirement, root README, web README, and OpenSpec documentation MUST identify the existing owner-scoped JSONB snapshot and protected read/write API as persistence authority. The documentation MUST describe exact sparse availability, owner RLS, the absence of a base-duration storage field, and the absence of schema migration or removed-field compatibility behavior for this change. It MUST NOT name Alembic as the implemented onboarding schema authority.

#### Scenario: Persistence documentation matches runtime authority

- GIVEN the delivered persistence behavior
- WHEN directly affected documentation is reviewed
- THEN API, JSONB, RLS, schema authority, exact-value round-trip, clean-state, and no-migration claims match the executable capability.
