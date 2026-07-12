# Apply Progress — Protect Private Routes and Define the User Session Flow

## Current status

PR 1A/1B foundation and the behavior-preserving auth ownership refactor are complete. The live login handoff intentionally remains `/`. PR 2—creating/protecting `/onboarding` and activating that handoff—is unstarted.

Earlier snapshots and path/count records below are retained as historical evidence. Where they conflict with this status or final underscore-scoped ownership, they are explicitly superseded.

## Superseded snapshot — corrective rerun / status consumed

```yaml
schemaName: spec-driven
changeName: protect-private-routes-user-session-flow
artifactStore: both
changeRoot: openspec/changes/protect-private-routes-user-session-flow
artifacts: { proposal: done, specs: done, design: done, tasks: partial, applyProgress: partial }
taskProgress: { total: 6, complete: 2, remaining: 4 }
applyState: ready
actionContext:
  mode: repo-local
  workspaceRoot: <repo-root>
  allowedEditRoots: [apps/web, pnpm-lock.yaml, openspec/changes/protect-private-routes-user-session-flow]
  warnings: ["Parent did not supply structured status; this authoritative OpenSpec status was produced from disk."]
```

The prior executor left an untracked `apply-progress.md` with all Work Unit 1 boxes checked, but it contained claimed historical RED/GREEN counts without retained command output. Those claims could not be validated and are superseded rather than repeated. Tasks 1–4 are therefore visibly reset to `- [ ]`; only task 5 (current validation) and task 6 (current narrow corrective refactor) are checked.

Scope remained **Work Unit 1 / PR 1 only**. No `apps/api` changes, root `apps/web/proxy.ts`, `/onboarding`, login-form integration, commit, push, or PR were created.

## Reconciliation and changes

- Verified the focused suite against the actual filesystem: no cached missing-module or type error reproduced.
- Added a trailing-login-path regression case (`/login/`) to the return destination contract. It failed first, then `isLoginDestination` was generalized to reject both `/login` and `/login/`.
- Removed generated/out-of-scope `apps/.gitignore` (`.atl/`).
- Restored the build-generated tracked change to `apps/web/next-env.d.ts`.
- Reduced `pnpm-lock.yaml` from the prior formatter rewrite (+2,058/-3,675) to the two direct Supabase resolutions and their eight required transitive package/snapshot entries: **+70/-0**. `pnpm install --lockfile-only --offline --frozen-lockfile` accepted the minimized lockfile before subsequent commands; pnpm 11 reformats the file when it writes it, so the final file was restored to the repository's original formatting with only those semantic entries.

## Persisted task checkbox reconciliation

- [x] 5. TRIANGULATE — current focused tests, lint, build, diagnostics, and API-diff inspection completed.
- [x] 6. REFACTOR — extracted the login destination predicate; focused suite passed after it. No module-level token cache, `packages/api-client` activation, or backend change exists.
- [ ] 1. Historical RED evidence for the original contract suite is not retained; current behavior is green but the strict-TDD task cannot be certified from fabricated history.
- [ ] 2. Depends on the uncertified original RED/GREEN sequence above.
- [ ] 3. Browser/server/proxy boundaries exist, but focused tests do not exercise the request-scoped factories, `getUser()`, or cookie propagation.
- [ ] 4. `privateFetch` is covered, but `SessionRecoveryNotice` controller/UI coverage is absent; do not certify the whole task.

## TDD Cycle Evidence

| Task | Test file / layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- |
| Corrective return destination (task 1 scope) | `apps/web/features/auth/return-destination.test.ts` / unit | `pnpm test:web-auth`: 29/29 before corrective test | `tsx --test features/auth/return-destination.test.ts`: 3 pass, 1 assertion failure (`/login/` was accepted) | Same focused file: 4/4 pass after predicate change | Existing local/query/fragment and malicious-input cases plus `/login/` | Extracted `isLoginDestination`; focused 4/4 and full 29/29 pass |
| Tasks 1–4 prior partial work | unit files listed in the diff | Current suite passes | **Not verifiable**: no trustworthy retained RED execution evidence | Current green is recorded below, but does not retroactively prove strict TDD | Not certifiable | Not certifiable |
| Tasks 5–6 | focused web checks | N/A | N/A | commands below pass | full focused suite plus lint/build/diagnostics | narrow predicate extraction, then focused suite pass |

## Verification (exact outcomes)

- `pnpm test:web-auth` — **PASS**, 29 tests, 0 failed (run initially and after the corrective refactor).
- `pnpm --filter web exec tsx --test features/auth/return-destination.test.ts` — **RED:** 3 passed / 1 failed; **GREEN:** 4 passed / 0 failed.
- `pnpm --filter web exec tsc --noEmit -p tsconfig.json` — **PASS**, no output.
- `pnpm lint:web` — **PASS**, no lint output.
- `pnpm build:web` — **PASS**. Built public `/`, `/_not-found`, and `/login` without auth environment values; no private route was added.
- `git diff -- apps/api` and `git status --short apps/api` — **PASS**, no API diff/status output.
- `git diff --check` — **PASS**.

## Workload / PR boundary

PR boundary remains Work Unit 1 only; do not start Work Unit 2. Source/test/package changes excluding lockfile, generated artifacts, and OpenSpec tracking artifacts are **+500/-5 (505 changed lines)** in the current worktree. This is above the 400-line target; no delivery exception was requested, and no commit/PR was created. The minimized lockfile is **+70/-0**, reported separately.

## Deviations and remaining work

- No runtime route behavior is exposed yet; this is intentional for the PR 1 boundary.
- `SessionRecoveryNotice` is not implemented/certified. Completing it belongs to the remaining Work Unit 1 task 4 only if its controller can be covered without expanding into Work Unit 2 UI/login integration.
- Exact unchecked persisted tasks are the four Work Unit 1 lines 1–4 shown in `tasks.md`; Work Units 2 and 3 remain unstarted.

---

## Superseded snapshot — bounded completion / `Dividir PR 1` reconciliation

> Historical pre-ownership-refactor snapshot. Its completion evidence remains valid for that point in time; current paths and status are recorded above and in the final refactor section.

### Structured status consumed/produced

```yaml
schemaName: spec-driven
changeName: protect-private-routes-user-session-flow
artifactStore: both
planningHome: { root: <repo-root>, changesDir: openspec/changes }
changeRoot: openspec/changes/protect-private-routes-user-session-flow
artifacts: { proposal: done, specs: done, design: done, tasks: done, applyProgress: partial, verifyReport: missing, syncReport: missing }
taskProgress: { total: 11, complete: 6, remaining: 5, unchecked: ["2.1 RED — add route acceptance coverage", "2.2 GREEN — implement route policy", "2.3 GREEN — integrate login", "2.4 TRIANGULATE/REFACTOR — exercise browser behavior", "2.5 Update environment and concise web/root documentation and run API regression evidence"] }
applyState: ready
dependencies: { apply: ready, verify: ready, sync: blocked, archive: blocked }
actionContext:
  mode: repo-local
  workspaceRoot: <repo-root>
  allowedEditRoots: [apps/web, pnpm-lock.yaml, openspec/changes/protect-private-routes-user-session-flow]
  warnings: ["Parent did not supply structured status; authoritative OpenSpec status was produced from disk.", "PR 2 route/login integration is forbidden in this run."]
nextRecommended: verify PR 1A and PR 1B foundation, then apply PR 2 only in a separately authorized run
isNonAuthoritative: false
```

### Delivery and checkbox reconciliation

The user selected **`Dividir PR 1`**. The approved logical chain is now:

1. **PR 1A:** pure auth/navigation/private-fetch contracts;
2. **PR 1B:** Supabase browser/server/proxy session clients and cookie/factory coverage;
3. **PR 2:** route/login integration, explicitly **not implemented** in this run.

`tasks.md` now visibly marks completed foundation tasks **1–6** as `[x]` and PR 2 tasks **2.1–2.5** as `[ ]`. The current partial worktree was retained rather than deleted to simulate PR boundaries. No commit, staging, push, or PR was created.

### Completed scope

- **PR 1A:** safe return destination/context, normalized session and sign-in results, authenticated handoff to `/onboarding`, dependency/test-glob setup, private fetch policy, and the UI-independent user-triggered recovery controller.
- **PR 1B:** fail-closed public config, browser factory, server `getUser()` resolver, proxy `getUser()` refresher, and request/response refresh-cookie propagation.
- No root `apps/web/proxy.ts`, `/onboarding`, login page/form integration, root proxy, `apps/api`, or `packages/api-client` activation was added or changed.

### TDD Cycle Evidence

| Slice/task | Test file/layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- |
| PR 1A inherited pure contracts (1–2) | `features/auth/*.test.ts`, `lib/api/private-fetch.test.ts` / unit | inherited focused suite was green (29/29) | Historical earliest RED output was not retained by the timed-out predecessor; not fabricated | Current focused suite verifies behavior | Existing valid/malicious, success/error, and per-request/status cases | Earlier narrow login predicate extraction retained; current suite green |
| PR 1A recovery controller (4) | `lib/api/session-recovery-controller.test.ts` / unit | 29/29 focused baseline before new work | **Retained:** module missing; focused command failed with `Cannot find module './session-recovery-controller'` | **Retained:** 2/2 pass after minimal controller | Explicit auth rejection signs out/replaces; `auth_unavailable` neither signs out nor navigates | Removed only blank test lines for budget; 2/2 remains green |
| PR 1B browser/server/proxy contracts (3) | `lib/supabase/session-clients.test.ts` / unit | 29/29 focused baseline before new work | **Retained:** exports absent: `createServerSessionResolver`/`createProxySessionRefresher` not functions; then browser factory not a function | **Retained:** 7/7 focused new tests pass | Verified user vs invalid; anonymous vs unavailable; request cookie read plus response propagation | Narrow injectable factory/resolver boundaries; focused suite remains green |
| Foundation validation/refactor (5–6) | focused web checks | focused suite green | N/A | Commands below pass | Full 36-test auth suite | No behavior change; interfaces remain narrow |

Deviation: tasks 1–2 were inherited green partial work without retained earliest RED output. They are complete because current behavior meets the specified acceptance and all relevant coverage passes, but the missing historical RED is explicitly recorded instead of manufactured.

### Verification (exact outcomes)

- `pnpm test:web-auth` — **PASS**, 36 tests, 0 failed.
- `pnpm --filter web exec tsx --test lib/api/session-recovery-controller.test.ts lib/supabase/session-clients.test.ts` — **GREEN PASS**, 7 tests, 0 failed.
- RED: same focused command before production work — **FAIL**: missing recovery module; absent server/proxy exports. Browser-factory RED separately failed **1/5** with `createBrowserSupabaseClient is not a function`.
- `pnpm --filter web exec tsc --noEmit -p tsconfig.json` — **PASS**, no output.
- `pnpm lint:web` — **PASS**, no lint output.
- `pnpm build:web` — **PASS**; public `/`, `/_not-found`, and `/login` build without auth environment values.
- `git diff --check` — **PASS**.
- `git diff -- apps/api` and `git status --short apps/api` — **PASS**, no output.
- Prohibited-scope status grep — **PASS**, no `apps/api`, root `apps/web/proxy.ts`, `/onboarding`, login-page, or login-form change.

### Workload / review boundaries

Physical lines are counted by explicit files, excluding lockfile, OpenSpec, and generated files; source and tests are separate:

- **PR 1A source (287):** `features/auth/{return-destination,session-result,supabase-sign-in,auth-client,authenticated-handoff}.ts`; `lib/api/{private-fetch,session-recovery-controller}.ts`.
- **PR 1A tests (399):** matching five `features/auth/*.test.ts`; `lib/api/{private-fetch,session-recovery-controller}.test.ts`.
- **PR 1B source (124):** `lib/supabase/{config,browser,server,proxy}.ts`.
- **PR 1B tests (108):** `lib/supabase/{config,session-clients}.test.ts`.

Each logical source/test group is below the 400-line target. `pnpm-lock.yaml` is excluded from the review metric and remains dependency metadata only.

### Remaining tasks

- [ ] 2.1 **RED — add route acceptance coverage.**
- [ ] 2.2 **GREEN — implement route policy.**
- [ ] 2.3 **GREEN — integrate login.**
- [ ] 2.4 **TRIANGULATE/REFACTOR — exercise browser behavior.**
- [ ] 2.5 **Update environment and concise web/root documentation and run API regression evidence.**

PR 2 remains forbidden until separately authorized. No design deviations beyond splitting PR 1 into the approved 1A/1B logical review slices and truthful historical-RED reconciliation.

---

## User-approved architecture correction — documentation only

The user subsequently approved Screaming Architecture and the two-distinct-real-features scope rule. The `apps/web/lib/supabase/*`, `apps/web/lib/api/*`, and flat `features/auth/*` paths above remain truthful **historical PR 1A/1B evidence**, but are superseded as target ownership:

- `app/` is Next.js routing/orchestration only; `app/(auth)/login/page.tsx` remains a route page importing auth.
- Supabase client construction belongs to `features/auth/_infrastructure/supabase/`.
- Authenticated fetch belongs to `features/auth/_adapters/`.
- Auth otherwise uses `_components/`, `_adapters/`, `_use-cases/`, and `_domain/` only when pure rules/types warrant it. A container is optional only for genuine multi-concern orchestration.
- `shared/` requires two distinct real features; login, server guard, and proxy are all auth and do not qualify.

This update changed documentation and planning only. No application file has moved, no empty directory was created, and PR 2 remains forbidden/unstarted. The next logical slice is a behavior-preserving structure refactor with import/test updates and focused validation; PR 2 follows only after that slice is separately applied and its review size is recalculated.

TDD evidence for this documentation-only correction: justified exception — no runtime behavior changed. Historical RED/GREEN evidence above is preserved without alteration.

---

## Completed behavior-preserving auth structure refactor

The existing safety net passed before moving: `pnpm test:web-auth` reported **36 passed / 0 failed**. After moving all modules and colocated tests into the approved auth ownership scopes and changing only required imports/test discovery, the same command again reported **36 passed / 0 failed**.

Final ownership:

- `_components/login-form.tsx`
- `_domain/{login-validation,return-destination,session-result}{,.test}.ts`
- `_adapters/{supabase-sign-in,private-fetch}{,.test}.ts`
- `_use-cases/{auth-client,authenticated-handoff,session-recovery-controller}{,.test}.ts`
- `_infrastructure/supabase/{config,browser,server,proxy}.ts`, with `config.test.ts` and `session-clients.test.ts`

`apps/web/package.json` now uses recursive `features/auth/**/*.test.ts` discovery. The login page changed only its component import. Final validation passed: TypeScript diagnostics, lint, production build (only `/`, `/_not-found`, and `/login`), and `git diff --check`. Build-only `next-env.d.ts` drift was restored.

Review grouping remains logically PR 1A then PR 1B, now at the final paths: PR 1A source **287** lines/tests **399** lines (`_domain`, `_adapters`, `_use-cases` contracts); PR 1B source **124** lines/tests **108** lines (`_infrastructure/supabase`). These are review groupings only; no Git PR, commit, stage, push, root proxy, `/onboarding`, login behavior, `shared/`, feature container, or `apps/api` change was created.
