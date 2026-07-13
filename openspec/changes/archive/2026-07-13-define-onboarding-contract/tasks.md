# Tasks: Define the Onboarding Contract

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 20–80 documentation-only lines |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single documentation-only PR |
| Delivery strategy | auto-forecast |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Complete contract-artifact review and only approved local corrections | PR 1 | `git diff --check -- openspec/changes/define-onboarding-contract` | N/A — documentation-only contract | Revert changes under `openspec/changes/define-onboarding-contract/` |

## Phase 1: Contract Traceability Review

- [x] 1.1 Review `proposal.md` against `specs/onboarding-contract/spec.md`; confirm versioning, ownership, lifecycle, field catalog, modalities, and scope exclusions are represented.
- [x] 1.2 Review `design.md` against the delta spec; confirm draft parsing, conditional clearing, completion projection, diagnostics, and deferred seams do not introduce UI, storage, or planning behavior.

## Phase 2: Scenario and Boundary Verification

- [x] 2.1 Verify the spec scenarios cover typed-invalid draft preservation, malformed draft rejection, completed-state demotion, restriction clearing, availability failure, and non-blocking warnings.
- [x] 2.2 Verify `specs/onboarding-contract/spec.md` excludes client owner identity, plan approaches, Backyard hours/cycle/rest margin, persistence, endpoints, UI sequencing, and plan generation.

## Phase 3: Documentation Closure

- [x] 3.1 Apply only approved corrections to `proposal.md`, `specs/onboarding-contract/spec.md`, or `design.md` when review finds a contract contradiction; preserve all approved scope boundaries.
- [x] 3.2 Run `git diff --check -- openspec/changes/define-onboarding-contract` and inspect the diff; leave `docs/05-data-model.md` and other canonical documentation as a separately approved follow-up.

## Apply Progress Evidence

**Mode**: Strict TDD — documentation-only exception. No executable production behavior or runtime boundary exists, and no runtime tests were created.

### TDD Cycle Evidence

| Task | Layer | RED | GREEN | REFACTOR |
|---|---|---|---|---|
| 1.1 | Documentation traceability | N/A — review precedes correction | Proposal reviewed against spec | None needed |
| 1.2 | Documentation traceability | N/A — review precedes correction | Design reviewed against spec | None needed |
| 2.1 | Documentation scenario review | N/A — no executable behavior | Required scenarios confirmed | None needed |
| 2.2 | Documentation boundary review | N/A — no executable behavior | Scope exclusions confirmed | None needed |
| 3.1 | Documentation correction | N/A — correction constrained by approved spec | Proposal wording aligned | None needed |
| 3.2 | Documentation verification | N/A — no executable behavior | `git diff --check -- openspec/changes/define-onboarding-contract` exited 0 | None needed |

### Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `git diff --check -- openspec/changes/define-onboarding-contract` — exit 0, no output. |
| Runtime harness command/scenario and exact result | N/A — documentation-only contract; no runtime boundary exists. |
| Rollback boundary | Revert only `openspec/changes/define-onboarding-contract/proposal.md` wording and task-progress/evidence updates in this file. |
