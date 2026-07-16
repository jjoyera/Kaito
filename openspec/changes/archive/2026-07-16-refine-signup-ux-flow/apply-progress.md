# Apply Progress: Refine Signup UX Flow

## Structured status consumed/produced

```yaml
schemaName: spec-driven
changeName: refine-signup-ux-flow
artifactStore: both
planningHome:
  root: <repo-root>
  changesDir: openspec/changes
changeRoot: openspec/changes/refine-signup-ux-flow
artifactPaths:
  proposal: [openspec/changes/refine-signup-ux-flow/proposal.md]
  specs: [openspec/changes/refine-signup-ux-flow/specs/signup-registration-ux/spec.md]
  design: [openspec/changes/refine-signup-ux-flow/design.md]
  tasks: [openspec/changes/refine-signup-ux-flow/tasks.md]
  applyProgress: [openspec/changes/refine-signup-ux-flow/apply-progress.md]
  verifyReport: [openspec/changes/refine-signup-ux-flow/verify-report.md]
  syncReport: [openspec/changes/refine-signup-ux-flow/sync-report.md]
artifacts:
  proposal: done
  specs: done
  design: done
  tasks: done
  applyProgress: done
  verifyReport: done
  syncReport: done
taskProgress:
  total: 36
  complete: 36
  remaining: 0
deferredParentActions:
  total: 5
  complete: 1
  remaining: 4
taskArtifactErrors: []
applyState: ready
dependencies:
  apply: ready
  verify: ready
  sync: ready
  archive: blocked
actionContext:
  mode: repo-local
  workspaceRoot: <repo-root>
  allowedEditRoots: [<repo-root>]
  warnings: []
nextRecommended: parent-lifecycle
isNonAuthoritative: false
```

The active change was selected explicitly by the parent. The OpenSpec store exists, so disk status is authoritative. The user supplied an approved single-PR size exception with a 3,000 changed-line budget; its parent-owned task is now checked.

## Completed implementation work

The persisted task artifact visibly marks all 36 implementation-owned rows complete:

- Work unit 1: provider-safe signup normalization, closed outcomes, retry normalization, reducer, absolute cooldown rules, and deterministic unit coverage.
- Work unit 2: one-time 30-second nonce bridge, strict nonce parsing, login banner, URL cleanup, replay/direct/malformed protections, and focused login coverage.
- Work unit 3: auth-owned portal overlay, native/shared dialog removal, reducer-driven registration orchestration, automatic login/onboarding handoffs, focused inline outcomes, deterministic call counters, and persisted cooldown behavior.
- Work unit 4: all four automated web gates, generated-diff cleanup, scope/privacy audit, stable Spanish documentation and README reconciliation, real confirmation-required Supabase smoke evidence, and changed-line accounting.

## Files changed

- `apps/web/app/(auth)/login/page.tsx`
- `apps/web/app/styles.css`
- `apps/web/e2e/login.spec.ts`
- `apps/web/e2e/register.spec.ts`
- `apps/web/features/auth/_adapters/supabase-sign-up.test.ts`
- `apps/web/features/auth/_adapters/supabase-sign-up.ts`
- `apps/web/features/auth/_components/post-signup-confirmation-banner.tsx`
- `apps/web/features/auth/_components/processing-overlay.tsx`
- `apps/web/features/auth/_components/register-form.tsx`
- `apps/web/features/auth/_domain/register-flow.test.ts`
- `apps/web/features/auth/_domain/register-flow.ts`
- `apps/web/features/auth/_use-cases/post-signup-confirmation.test.ts`
- `apps/web/features/auth/_use-cases/post-signup-confirmation.ts`
- `apps/web/features/auth/_use-cases/register-client.test.ts`
- `apps/web/features/auth/_use-cases/register-client.ts`
- `apps/web/e2e/login.spec.ts`
- `README.md`
- `docs/02-user-journeys.md`
- `docs/04-functional-requirements.md`
- `docs/08-architecture.md`
- OpenSpec proposal, domain spec, design, tasks, verification/sync reports, and this cumulative progress artifact.

The exploratory `apps/web/proxy.ts`/`proxy.test.ts` changes and generated `apps/web/next-env.d.ts` diff were reverted because the approved design requires no proxy change and generated output is unrelated.

## TDD Cycle Evidence

| Task slice | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| Provider adapter/use case | `supabase-sign-up.test.ts`, `register-client.test.ts` | Unit/contract | 82/82 baseline | Failing metadata, normalization, and missing-export cases observed | 93/93 after implementation | Missing, invalid, fractional, unsafe, non-rate, and redaction paths | Helpers consolidated; 99/99 final auth suite |
| Registration state/cooldown | `register-flow.test.ts` | Unit | N/A (new) | Missing module failure observed | Reducer/deadline cases green | Stale IDs, navigation, recovery, storage, deadline boundary, and storage exceptions | Storage/deadline operations centralized |
| Confirmation bridge | `post-signup-confirmation.test.ts` | Unit | N/A (new) | Missing module failure observed | 99/99 auth tests | TTL boundaries, malformed/future/expired/replay/storage failures | URL parsing remains separate from login context |
| Login banner | `e2e/login.spec.ts` | Browser/E2E | Existing login tests green | New banner cases written before page composition | Focused 2/2 green | Plain/direct/random/malformed/repeated/refresh/seeded paths | Fixed development Strict Effects one-time-consumption race; focused and full E2E green |
| Overlay | `e2e/register.spec.ts` | Browser/E2E | Existing auth baseline green | Native dialog failed new `aria-modal`/ordinary-DOM contract | Focused overlay test green | Escape, Tab, Shift+Tab, focus escape, backdrop, synthetic submit, inert/overflow restoration, reduced motion | Shared native component deleted; auth ownership retained |
| Registration outcomes | `e2e/register.spec.ts` | Browser/E2E | Existing registration tests inspected | Old confirmation-on-register behavior failed redirect expectations | Automatic handoffs and inline outcomes green | Invalid/duplicate/system/retry/privacy/no-recovery/focus/call-count paths | Reducer is sole flow-state owner |
| Persisted cooldown | `register-flow.test.ts`, `e2e/register.spec.ts` | Unit + E2E | Reducer tests green | New 60-second, refresh, and short-provider cases preceded orchestration | Focused registration suite green | Absolute expiry, edit lock, persisted refresh guard, automatic re-enable, exact next call | Timers and storage helpers centralized and cleaned up |

### Test summary

- Unit/contract tests: 99 passed.
- Development E2E: 37 passed.
- Production E2E: 1 passed.
- Focused registration E2E: 10 passed after triangulation.
- Focused login confirmation E2E: 2 passed.
- Pure/testable rules added: retry normalization, closed provider mapping, registration reducer/deadlines/storage hydration, and nonce create/consume validation.

## Commands run

- `corepack pnpm test:web-auth` — baseline 82 passed; RED failures captured; final 99 passed.
- `corepack pnpm --filter web exec playwright test e2e/login.spec.ts --grep ...` — focused confirmation tests passed.
- `corepack pnpm --filter web exec playwright test e2e/register.spec.ts` — 10 focused registration tests passed.
- `corepack pnpm lint:web` — passed with zero warnings.
- `corepack pnpm build:web` — passed.
- `corepack pnpm test:web-e2e` — 37 development and 1 production tests passed. An initial full run exposed a development Strict Effects race in banner visibility; the implementation was corrected and the complete command then passed.
- `git diff --check` — passed.
- Scope/privacy `rg` audit — no native dialog implementation or password-recovery artifact; the only recovery-copy match is the E2E absence assertion.

## Manual Supabase evidence and limitations

Verified from user-provided real Supabase evidence:

- account creation succeeded;
- a confirmation email was received;
- confirmation and subsequent login succeeded;
- retrying the same email produced the approved neutral banner and no new email, demonstrating provider-obscured duplicate behavior.

Explicitly not verified:

- a real Supabase immediate-session signup outcome;
- Bitwarden or another password-manager-enabled browser profile.

These unavailable manual checks are retained as parent-owned evidence follow-ups and are not represented as implementation verification. All implementation-owned tasks are complete. Engram was intermittently unavailable during earlier artifact retrieval/persistence attempts; OpenSpec remained authoritative.

## Deferred parent lifecycle actions

The approved single-PR size exception is checked. A real immediate-session smoke, a password-manager profile check, bounded review, and final closure approval remain parent-owned follow-ups.

## Workload / PR boundary

- Delivery path: maintainer-approved single PR with size exception.
- Correction-snapshot `git diff --shortstat`: 9 tracked files changed, 579 insertions, and 233 deletions. This command excludes the untracked implementation and OpenSpec files, so no complete changed-line total or budget conclusion is claimed from it.
- No commit was created.
