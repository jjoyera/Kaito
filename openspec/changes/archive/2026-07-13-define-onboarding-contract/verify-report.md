```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:1ba6cebc48ed942b727442910bc2aa47fce1411ffdd9e2feb119812245018817
verdict: pass
blockers: 0
critical_findings: 0
requirements: 9/9
scenarios: 19/19
test_command: git diff --check -- openspec/changes/archive/2026-07-13-define-onboarding-contract openspec/specs/onboarding-contract
test_exit_code: 0
test_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
build_command: python3 -c 'from pathlib import Path; import re; root=Path("openspec/changes/archive/2026-07-13-define-onboarding-contract"); files=[root/"proposal.md",root/"specs/onboarding-contract/spec.md",root/"design.md",root/"tasks.md",root/"explore.md",root/"README.md",root/"artifacts.md"]; texts=dict((p,p.read_bytes().decode("utf-8")) for p in files); assert all(not re.search(r"(?m)[ \t]+$", text) for text in texts.values()); spec=texts[root/"specs/onboarding-contract/spec.md"]; requirements=len(re.findall(r"^### Requirement:",spec,re.M)); scenarios=len(re.findall(r"^#### Scenario:",spec,re.M)); tasks=re.findall(r"^- \[([ xX])\] \d+\.\d+ ",texts[root/"tasks.md"],re.M); completed=sum(mark.lower()=="x" for mark in tasks); links=[]; [links.extend(re.findall(r"\[[^\]]+\]\(([^)]+)\)",texts[p])) for p in (root/"README.md",root/"artifacts.md")]; assert all((root/link).exists() for link in links); assert (requirements,scenarios,len(tasks),completed)==(9,19,6,6); lines=sum(len(text.splitlines()) for text in texts.values()); print("source_markdown_files=%d requirements=%d scenarios=%d tasks=%d/%d pending=%d candidate_lines=%d utf8=pass trailing_whitespace=pass relative_links=pass" % (len(files),requirements,scenarios,completed,len(tasks),len(tasks)-completed,lines))'
build_exit_code: 0
build_output_hash: sha256:f46319dd2010f50a3785f00428eed30459fff4c7effe1524d7986489c6d53404
```

## Verification Report

**Change**: `define-onboarding-contract`

**Version**: Initial supported `contract_version` is exactly `"1"`

**Mode**: Strict TDD — documentation-only exception

**Artifact store**: OpenSpec

**Final verdict**: **PASS WITH ONE DEFERRED FOLLOW-UP**

The change is documentation-only and defines no executable runtime boundary. Runtime tests, coverage, and runtime harness execution are therefore not applicable. Native status reported verification as ready, all six tasks complete, and no blockers. Review lineage `review-9e146f1009276394` was treated as the approved bounded review supplied to this phase; no additional review was started.

### Evidence Identity

The evidence revision hashes the exact bytes of the seven source Markdown artifacts, excluding this generated report, using the following canonical preimage in listed order: `relative-path`, NUL, file bytes, NUL.

1. `proposal.md`
2. `specs/onboarding-contract/spec.md`
3. `design.md`
4. `tasks.md`
5. `explore.md`
6. `README.md`
7. `artifacts.md`

### Completeness

| Metric | Value |
|---|---:|
| Requirements | 9 |
| Scenarios | 19 |
| Tasks total | 6 |
| Tasks complete | 6 |
| Tasks incomplete | 0 |
| Source documentation files | 7 |
| Source candidate lines | 577 |

All task checkboxes are complete. The task evidence records the documentation-only Strict TDD exception, focused whitespace check, runtime-harness N/A rationale, and rollback boundary.

### Build and Test Execution

#### Focused verification command

```text
git diff --check -- openspec/changes/define-onboarding-contract
exit code: 0
exact output: <empty>
output SHA-256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

This command and its active change path are preserved as historical source-phase evidence. Correction verification inspected the archived files directly and did not rewrite the original command path.

#### Read-only structural command

```text
exit code: 0
exact output:
source_markdown_files=7 requirements=9 scenarios=19 tasks=6/6 pending=0 candidate_lines=577 utf8=pass trailing_whitespace=pass relative_links=pass
output SHA-256: f46319dd2010f50a3785f00428eed30459fff4c7effe1524d7986489c6d53404
```

**Runtime tests**: N/A — no production code, endpoint, persistence, UI, migration, or runtime behavior is part of this change.

**Runtime harness**: N/A — documentation-only contract.

**Coverage**: N/A — no executable changed files.

**Build/type-check**: N/A — replaced by the successful read-only structural contract check above.

### Runtime Applicability

| Check | Result | Evidence |
|---|---|---|
| Executable production behavior introduced | N/A | All seven candidate files are Markdown under the OpenSpec change. |
| Runtime boundary available to test | N/A | Proposal lines 42–52 and design lines 71–73 defer implementation. |
| Runtime tests required for this phase | N/A | The launch instruction explicitly identifies the change as documentation-only; tasks lines 50–71 record the same exception. |
| Future runtime test strategy defined | Yes | Design lines 59–65 specify unit and contract tests for later implementation. |

### Spec Compliance Matrix

Because there is no executable implementation, results below establish static contract coverage rather than runtime compliance.

| # | Requirement | Scenario | Static evidence | Result |
|---:|---|---|---|---|
| 1 | Versioned profile-and-goal payload | Payload is presentation-independent | Spec lines 9–17; design lines 42–57 | Documented; initial version and translation boundary explicit |
| 2 | Canonical field catalog and answer types | Race-count ranges are stable | Spec lines 19–70 | Documented |
| 3 | Canonical field catalog and answer types | New runner can explicitly report no practiced modalities | Spec lines 72–76 | Documented |
| 4 | Canonical field catalog and answer types | Training history uses whole and half-years | Spec lines 78–82 | Documented |
| 5 | Canonical field catalog and answer types | Baseline training uses whole and half-hours | Spec lines 84–88 | Documented |
| 6 | Canonical field catalog and answer types | No practiced terrain uses an empty array | Spec lines 90–94 | Documented |
| 7 | Canonical field catalog and answer types | Trail technicality is route-based | Spec lines 50–56 and 96–100 | Documented |
| 8 | Canonical field catalog and answer types | OCR obstacle difficulty is event-based | Spec lines 58–64 and 102–106 | Documented |
| 9 | Canonical field catalog and answer types | Backyard inputs are limited | Spec lines 46–48 and 108–112 | Documented |
| 10 | Resumable lifecycle and authoritative completion | Incomplete draft is resumed | Spec lines 114–122 | Documented |
| 11 | Resumable lifecycle and authoritative completion | Typed but completion-invalid draft answer is preserved | Spec lines 124–128 | Documented |
| 12 | Resumable lifecycle and authoritative completion | Structurally invalid draft answer is rejected | Spec lines 130–134 | Documented |
| 13 | Resumable lifecycle and authoritative completion | Completed data is edited | Spec lines 136–140 | Documented |
| 14 | Deterministic conditional clearing | Restriction detail is cleared | Spec lines 142–150 | Documented |
| 15 | Objective history and separate four-week baseline | History and baseline remain separate | Spec lines 152–160 | Documented |
| 16 | Availability threshold | Availability is insufficient | Spec lines 162–170 | Documented |
| 17 | Restrictions are bounded self-reported context | Restriction text is not semantically rejected | Spec lines 172–180 | Documented |
| 18 | Dates, modality goals, and outcomes | Date and modality validation is testable | Spec lines 182–190 | Documented |
| 19 | Scope exclusions | Planning receives contract data | Spec lines 192–200 | Documented |

**Static compliance summary**: 19/19 scenarios are represented in the normative specification. Runtime status is N/A, not inferred from source inspection.

### Correctness

| Requirement | Status | Notes |
|---|---|---|
| Versioned profile-and-goal payload | Documented | Shape, ownership, separation, initial version `"1"`, and unknown-version handling are explicit. |
| Canonical field catalog and answer types | Documented | Stable identifiers, types, units, requiredness, and modality rules are explicit. |
| Resumable lifecycle and authoritative completion | Documented | Typed drafts, malformed input, completion validation, and automatic demotion are distinguished. |
| Deterministic conditional clearing | Documented | Restriction and modality-controlled stale values are cleared. |
| Objective history and separate baseline | Documented | Observable history and four-week baseline remain independently addressable and do not select an approach. |
| Availability threshold | Documented | Sparse weekday keys, omitted unavailable days, invalid null/unknown keys, and weekly completion thresholds are explicit. |
| Restrictions boundary | Documented | Validation is structural; medical-risk wording is accepted and any safety notice is separate. |
| Dates, modality goals, and outcomes | Documented | Date-only semantics use an explicit runner-facing local validation date rather than server timezone; modality rules, stable diagnostics, and warning/error separation are explicit. |
| Scope exclusions | Documented | Persistence, UI, endpoints, planning decisions, and canonical-document reconciliation remain deferred. |

### Scope Exclusions

| Excluded area | Verification result |
|---|---|
| Persistence, database schema, migrations, repositories, RLS | Preserved |
| UI screens, sequencing, copy, routes, session flow | Preserved |
| API endpoints, handlers, and application implementation | Preserved |
| Plan generation, approach selection, eligibility, feasibility decisions | Preserved |
| Backyard rest-margin strategy | Preserved |
| Medical diagnosis, injury assessment, treatment advice | Preserved |
| Canonical documentation reconciliation | Deferred explicitly to a separately approved follow-up |

### Design Coherence

| Decision | Followed? | Notes |
|---|---|---|
| Separate permissive draft from strict completed projection | Yes | Matches lifecycle and completion requirements. |
| Separate parsing, normalization, completion validation, and lifecycle resolution | Yes | Matches malformed-versus-correctable draft semantics. |
| Exact contract version with unknown-version rejection | Yes | Initial version is exactly `"1"`; unknown versions are rejected or translated explicitly before validation. |
| Decimal quantities and integral counts/minutes | Yes | Consistent with the field catalog and numeric invariants. |
| Ownership outside payload | Yes | Consistent across proposal, spec, and design. |
| Stable diagnostics with non-blocking warning seams | Yes | Consistent with date and restriction safety semantics. |
| Deferred persistence, transport adapters, UI, and planning behavior | Yes | No implementation files or canonical docs are in the candidate. |

### TDD Compliance

| Check | Result | Details |
|---|---|---|
| TDD evidence reported | N/A exception documented | Tasks lines 40–61 provide documentation-review evidence. |
| RED/GREEN cycle | N/A | No executable behavior or testable runtime boundary exists. |
| Runtime test files | N/A | No production or test files changed. |
| Triangulation | N/A | Static scenario traceability covers all 19 scenarios. |
| Safety net | N/A | No executable existing file was modified. |
| Assertion quality audit | N/A | No test files exist for this documentation-only change. |

Strict TDD remains applicable to future implementation work. It does not require invented runtime tests for this contract-only phase.

### Test Layer Distribution

| Layer | Tests | Files | Applicability |
|---|---:|---:|---|
| Unit | 0 | 0 | Deferred to implementation |
| Contract | 0 | 0 | Deferred to implementation |
| Integration/E2E | 0 | 0 | Explicitly out of scope |
| **Total** | **0** | **0** | Documentation-only |

### Changed File Coverage

Coverage analysis is N/A because the candidate contains no executable files.

### Assertion Quality

Assertion quality audit is N/A because the candidate contains no test files.

### Quality Metrics

**Markdown structural check**: Passed

**Trailing whitespace**: None found by direct file inspection

**Relative links in phase indexes**: All targets exist

**Linter**: N/A — no configured Markdown linter was required

**Type checker**: N/A — no typed source files changed

### Correction Assessment

| Observation | Classification | Evidence and rationale |
|---|---|---|
| Archived phase status and scope guard | **Corrected** | README and artifacts now record approved spec, completed design/tasks, verification, archive, canonical spec sync, and the preserved Issue #20 exclusions. |
| Task forecast says 20–80 lines while the candidate was 560 lines | **Corrected by historical annotation** | Tasks preserves the original forecast and commands, records the actual 560-line outcome, explains the variance, and marks the realized 400-line risk high. The corrected seven-file evidence set is now 577 lines. |
| Logical transport names and draft containers | **Corrected** | Design uses normative `contract_version`, `state`, `profile`, and `goal`; top-level containers remain present while draft answers may be partial or absent, and only completion-valid data reaches `CompletedOnboarding`. |
| Initial `contract_version` value and unknown versions | **Corrected** | Both byte-identical specs define exactly `"1"`; unknown versions are rejected or translated explicitly before validation. |
| Sparse availability representation | **Corrected** | Both specs allow only weekday keys, treat present keys as available, require integer 15–300 values, omit unavailable days, reject null/unknown keys, and preserve the 3-day/150-minute completion minimum. |
| Runner-local target-date validation | **Corrected** | Both specs and design require an explicit runner-facing local validation date, date-only comparison, and no server-timezone derivation. |
| Decimal JSON representation and scale | **Deferred follow-up** | API and persistence implementation must choose JSON number-versus-string encoding and decimal scale/serialization policy. This contract does not invent that policy. |
| “Non-diagnostic” restriction detail conflicts with accepting medical wording | **Resolved / not an issue** | Proposal line 76 defines non-diagnostic interpretation, not lexical rejection. Spec lines 172–180 prohibit semantic rejection and design line 55 keeps safety notices non-blocking. |

### Issues Found

**CRITICAL**: None.

**WARNING / FOLLOW-UP**:

1. JSON number-versus-string encoding and decimal scale/serialization policy remain deferred to API and persistence implementation.

**SUGGESTION**: None.

### Verdict

**PASS WITH ONE DEFERRED FOLLOW-UP**

No requirements/runtime failure blocks archive. The contract's nine requirements and nineteen scenarios are present, all six tasks are complete, scope exclusions are preserved, the archived and canonical specifications are byte-identical, and read-only checks pass. The corrected findings are closed; decimal representation and scale remain an explicit API/persistence follow-up.
