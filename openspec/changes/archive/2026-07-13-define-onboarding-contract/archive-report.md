# Archive Report — Define the Onboarding Contract

## Outcome

Archived on 2026-07-13 after the OpenSpec source-of-truth specification was created from the complete `onboarding-contract` change specification. The change remains documentation-only; no application code was modified.

## Archive Gates

| Gate | Result | Evidence |
| --- | --- | --- |
| Action context | Passed | Repo-local edits remained within `<repo-root>`. |
| Task completion | Passed | `tasks.md` records 6/6 completed implementation tasks and no unchecked tasks. |
| Verification | Passed with one follow-up | `verify-report.md` reports 9/9 requirements, 19/19 scenarios, zero blockers, zero critical findings, and a deferred decimal representation policy. |
| Native review | Allowed | Approved bound lineage `review-9e146f1009276394`; supported post-apply validation returned `allow`. No archive review gate was run because Gentle AI 2.1.0 does not support it. |

## Specification Sync

| Domain | Action | Details |
| --- | --- | --- |
| `onboarding-contract` | Created | No existing main spec was present. The complete change specification was copied to `openspec/specs/onboarding-contract/spec.md` with 9 requirements and 19 scenarios. |

## Preserved Scope Exclusions

The archived specification continues to exclude persistence, migrations, database schema, UI sequencing, endpoints, plan generation, eligibility, approach selection, and Backyard rest-margin strategy. Archive sync created `openspec/specs/onboarding-contract/spec.md`; no other canonical-document reconciliation or application implementation was introduced.

## Remaining Follow-up

The stale phase metadata, realized workload annotation, and initial `contract_version` findings were corrected after archive. JSON number-versus-string encoding and decimal scale/serialization policy remain intentionally deferred to API and persistence implementation; this follow-up does not change the normative numeric ranges or invalidate the contract, task completion, verification evidence, or review gate.

## Archive Contents

- `proposal.md`
- `specs/onboarding-contract/spec.md`
- `design.md`
- `tasks.md`
- `verify-report.md`
- `explore.md`
- `README.md`
- `artifacts.md`
- `state.yaml`
- `archive-report.md`
