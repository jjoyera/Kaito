# Archive Report — setup-supabase-auth-backend

## Status

**PASS.** The change met archive preconditions and was moved to the dated archive path.

## Artifacts read

- `openspec/config.yaml`
- `openspec/changes/setup-supabase-auth-backend/proposal.md`
- `openspec/changes/setup-supabase-auth-backend/spec.md`
- `openspec/changes/setup-supabase-auth-backend/specs/backend-auth/spec.md`
- `openspec/changes/setup-supabase-auth-backend/design.md`
- `openspec/changes/setup-supabase-auth-backend/tasks.md`
- `openspec/changes/setup-supabase-auth-backend/apply-progress.md`
- `openspec/changes/setup-supabase-auth-backend/verify-report.md`
- `openspec/changes/setup-supabase-auth-backend/sync-report.md`
- `openspec/changes/setup-supabase-auth-backend/artifacts.md`
- `openspec/specs/backend-auth/spec.md`
- Active change inventory under `openspec/changes/setup-supabase-auth-backend/`
- Global status contract `~/.pi/agent/gentle-ai/support/sdd-status-contract.md`

## Archive readiness

- Verify report: **PASS**
- Sync report: **synced**
- Canonical sync check: `openspec/specs/backend-auth/spec.md` matches `openspec/changes/setup-supabase-auth-backend/specs/backend-auth/spec.md`
- Final task completion gate: **passed**
- Unchecked implementation task lines: **none**
- Required artifacts: **present**

## Structured status and actionContext findings

```yaml
schemaName: spec-driven
changeName: setup-supabase-auth-backend
artifactStore: both
planningHome:
  root: <repo-root>
  changesDir: openspec/changes
changeRoot: openspec/changes/setup-supabase-auth-backend
artifactPaths:
  proposal:
    - openspec/changes/setup-supabase-auth-backend/proposal.md
  specs:
    - openspec/changes/setup-supabase-auth-backend/spec.md
    - openspec/changes/setup-supabase-auth-backend/specs/backend-auth/spec.md
    - openspec/specs/backend-auth/spec.md
  design:
    - openspec/changes/setup-supabase-auth-backend/design.md
  tasks:
    - openspec/changes/setup-supabase-auth-backend/tasks.md
  applyProgress:
    - openspec/changes/setup-supabase-auth-backend/apply-progress.md
  verifyReport:
    - openspec/changes/setup-supabase-auth-backend/verify-report.md
  syncReport:
    - openspec/changes/setup-supabase-auth-backend/sync-report.md
contextFiles:
  proposal:
    - openspec/changes/setup-supabase-auth-backend/proposal.md
  specs:
    - openspec/changes/setup-supabase-auth-backend/spec.md
    - openspec/changes/setup-supabase-auth-backend/specs/backend-auth/spec.md
    - openspec/specs/backend-auth/spec.md
  design:
    - openspec/changes/setup-supabase-auth-backend/design.md
  tasks:
    - openspec/changes/setup-supabase-auth-backend/tasks.md
  applyProgress:
    - openspec/changes/setup-supabase-auth-backend/apply-progress.md
  verifyReport:
    - openspec/changes/setup-supabase-auth-backend/verify-report.md
  syncReport:
    - openspec/changes/setup-supabase-auth-backend/sync-report.md
artifacts:
  proposal: done
  specs: done
  design: done
  tasks: done
  applyProgress: done
  verifyReport: done
  syncReport: done
taskProgress:
  total: 42
  complete: 42
  remaining: 0
  unchecked: []
applyState: all_done
dependencies:
  apply: all_done
  verify: all_done
  sync: all_done
  archive: ready
actionContext:
  mode: repo-local
  workspaceRoot: <repo-root>
  allowedEditRoots:
    - <repo-root>
  warnings: []
nextRecommended: archive-complete
isNonAuthoritative: false
```

## Domains synced

- `backend-auth`

## Requirement sync summary

### ADDED

- Provider-agnostic auth verification boundary
- Canonical UserContext identity model
- Valid token without email is accepted
- Supabase adapter as first isolated implementation
- JWKS asymmetric signing-key verification
- Protected GET /auth/me returns canonical identity only
- Reject missing, invalid, or malformed bearer tokens
- Minimal consistent 401 response contract
- Startup tolerance with clear protected-route failure when auth config is missing
- Default auth dependency pattern for future protected APIs
- Discoverable backend auth configuration and documentation
- Test coverage for the auth boundary slice

### MODIFIED

- None

### REMOVED

- None

## Same-domain active change warnings

- None

## Destructive merge approvals or blockers

- None. No destructive sync was performed, and no explicit destructive approval was required.

## Exceptions / reconciliations

- Non-critical partial archive approval: none needed
- Stale-checkbox reconciliation: none performed

## Archive target

- Archived path: `openspec/changes/archive/2026-07-09-setup-supabase-auth-backend/`

## Memory observation IDs

- Proposal: `sdd/setup-supabase-auth-backend/proposal` → obs `387`
- Spec: `sdd/setup-supabase-auth-backend/spec` → obs `389`
- Design: `sdd/setup-supabase-auth-backend/design` → obs `391`
- Tasks: `sdd/setup-supabase-auth-backend/tasks` → obs `394`
- Apply: `sdd/setup-supabase-auth-backend/apply` → obs `397`
- Verify: `sdd/setup-supabase-auth-backend/verify` → obs `401`
- Sync report: `sdd/setup-supabase-auth-backend/sync-report` → obs `404`
- Archive report: `sdd/setup-supabase-auth-backend/archive-report` → obs `417`
- Archive alias: `sdd/setup-supabase-auth-backend/archive` → obs `418`
