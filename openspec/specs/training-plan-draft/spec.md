# Training Plan Draft Specification

## Purpose

Persist the runner's explicit eligible approach as the minimal owner-bound input for a later plan-generation capability.

## Requirements

### Requirement: Protected idempotent resource

The API MUST expose `PUT /planning/training-plan-draft` with body `{"plan_approach":"kaio_path|mode_z|kaioken"}`. Authentication MUST derive ownership from verified `UserContext.user_id`; owner identity MUST NOT be accepted in input or returned. A successful response MUST contain only stable `plan_id`, `status=draft`, and canonical `plan_approach` fields.

Malformed bodies, unknown properties, and legacy noncanonical approach values MUST return bounded 422 outcomes.

### Requirement: Independent current eligibility verification

Within the owner transaction, the backend MUST load persisted onboarding, require a valid completed version 1 supported modality, and run the shared `ApproachEligibilityPolicy` using the injected trusted UTC current date. It MUST NOT trust a prior web eligibility result. Unsupported modality, blocked selection, missing onboarding, incomplete onboarding, corrupt data, and persistence failure MUST map to stable bounded outcomes without persistence or owner details.

### Requirement: One mutable draft per runner

The first PUT MUST create one UUID-backed draft. Repeating the same value MUST reuse the same record. Choosing another currently eligible value MUST update that record only while its status is `draft`. An active plan or a no-longer-draft record that prevents mutation MUST return `draft_plan_conflict`.

Database constraints and transaction locking MUST prevent concurrent requests from creating duplicate owner drafts. The schema MUST also enforce at most one active plan per owner.

### Requirement: Minimal persistence

The runtime table MUST persist only `id`, verified `owner_id`, `status`, canonical `plan_approach`, `created_at`, and `updated_at` for this capability. It MUST NOT create sessions, prompts, generated content, duplicated goals, AI states, or generation progress.

RLS MUST restrict select, insert, update, and delete to `auth.uid() = owner_id` following the existing authenticated-role convention.
