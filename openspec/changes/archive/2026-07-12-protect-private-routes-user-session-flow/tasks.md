# Tasks — Protect Private Routes and Define the User Session Flow

> **Current status:** The change and PR 2 are complete, merged, synced, and archived. Current PR 2 correctness/GREEN evidence passes. `/onboarding` is the protected placeholder fallback; `/dashboard` and onboarding-completion selection remain out of scope. See [`archive-report.md`](archive-report.md). The maintainer accepted the documented historical strict-TDD evidence exception for foundational tasks 1–2 and the single-PR size exception below.

## Review Workload Forecast and approved delivery plan

| Field | Value |
| --- | --- |
| Estimated changed lines | 550–750 overall; 490 current PR 2 reviewable lines |
| 400-line budget risk | High — explicitly accepted by maintainer |
| Decision needed before apply | No — maintainer accepted `size:exception` |
| Chained PRs recommended | No for the completed PR 2 delivery; historical chain remains recorded below |
| Chain strategy | `size-exception`: single PR 2 delivery on `feature/protect-private-routes-session-flow-19-pr2` |

The approved delivery plan retains the historical PR 1A → PR 1B → structure correction sequence. For the current ~490-line PR 2 slice, the maintainer explicitly accepted a single-PR size exception despite the 400-line session budget. This records review-workload risk only; it does not widen product scope. No commit, stage, push, or PR creation is part of apply.

| Slice | Scope | State | Budget measurement (lockfile/OpenSpec/generated excluded) |
| --- | --- | --- | --- |
| PR 1A | Pure auth/navigation/private-fetch contracts: return destination/context, normalized session/sign-in mapping, handoff contract, private fetch, UI-independent recovery controller, and tests | Complete | source 287 lines; tests 399 lines |
| PR 1B | Supabase public config plus browser/server/proxy session-client factories, `getUser()` normalization, cookie propagation, and tests | Complete | source 124 lines; tests 108 lines |
| Structure correction | Behavior-preserving move into auth underscore scopes; update imports/tests only | Complete | PR 1A source 287/tests 399; PR 1B source 124/tests 108 |
| PR 2 | Route/login integration: root proxy, `/onboarding`, loading state, login page/form integration, E2E route acceptance, and release docs | **Complete** | 490 reviewable physical lines; explicit single-PR `size:exception` accepted |

The structure correction was completed after PR 1B and before PR 2. PR 1A/1B source/test groups remain below 400 physical lines. The completed PR 2 slice exceeds the 400-line target, and the maintainer explicitly accepted that delivery exception.

## Implementation Tasks (strict TDD)

### PR 1A — Pure auth/navigation/private-fetch contracts

- [x] 1. **RED → GREEN — establish safe auth contracts.** Covered returnTo validation (local path/query/fragment; absolute, `//`, backslash, control, encoded attack, `/login`, trailing `/login/`, and oversized rejection), `/onboarding` default, bounded context mapping, provider/session normalization, Supabase sign-in mapping, and handoff selection. Historical earliest RED output from the interrupted predecessor was not retained; completion relies on current behavior plus truthful corrective/new RED evidence recorded in `apply-progress.md`.
- [x] 2. **GREEN — implement pure auth contracts.** `return-destination.ts`, `session-result.ts`, `supabase-sign-in.ts`, `auth-client.ts`, and `authenticated-handoff.ts` implement the contracts without provider text/tokens in URLs, UI, or telemetry. `@supabase/supabase-js` and `@supabase/ssr` are declared and the focused glob includes API/Supabase tests.
- [x] 4. **RED → GREEN — implement private API and narrow recovery contracts.** `private-fetch.ts` enforces relative paths, rejects caller authorization, acquires a per-call token, makes one request/no retry, and maps `401`/`503` distinctly. The UI-independent `session-recovery-controller.ts` only signs out/navigates after an explicit `auth_required` or `auth_rejected` recovery action; `auth_unavailable` does neither.

### PR 1B — Supabase browser/server/proxy session-client boundaries

- [x] 3. **RED → GREEN — add session client boundaries.** Browser creation uses only explicit public config; server resolution reads request cookies and calls `getUser()`; proxy resolution calls `getUser()` once, normalizes authenticated/anonymous/invalid/unavailable outcomes, and propagates refresh cookies to both request and response. Missing configuration remains fail-closed, and public `/` and `/login` build without auth variables.

### Foundation validation/refactor

- [x] 5. **TRIANGULATE — validate primitive boundaries.** Focused tests, TypeScript diagnostics, lint, build, API-diff inspection, and diff whitespace checks pass. No `apps/api`, root proxy, `/onboarding`, login page, or login-form changes exist.
- [x] 6. **REFACTOR — keep interfaces narrow.** Extracted the login predicate and small client factory/resolver boundaries; no module-level token cache, `packages/api-client` activation, or backend change.

### Structure correction — required before PR 2

- [x] S.1 **RED/GREEN characterization — preserve contracts while moving ownership.** The pre-move focused suite passed 36/36. Modules and colocated tests now live under `_components/`, `_domain/`, `_adapters/`, `_use-cases/`, and `_infrastructure/supabase/`; imports and the recursive test glob were updated without behavior changes.
- [x] S.2 **TRIANGULATE/REFACTOR — verify structure and behavior.** The post-move focused suite passed 36/36, TypeScript/lint/build/diff checks passed, and no stale auth `lib` ownership, shared/container scaffolding, or PR 2 route behavior was introduced.

### PR 2 — Route/session and login integration (complete)

- [x] 2.1 **RED — add route acceptance coverage.** Added failing-first Playwright coverage for anonymous/authenticated `/onboarding`, safe return URL fallback, unavailable and invalid-session context, and authenticated `/login` handoff. The guarded test-session seam keeps the acceptance coverage non-production and loopback-only.
- [x] 2.2 **GREEN — implement route policy.** Created root `apps/web/proxy.ts`, private `/onboarding` placeholder/loading boundary, and proxy/server defense-in-depth.
- [x] 2.3 **GREEN — integrate login.** Modified `apps/web/app/(auth)/login/page.tsx` and `apps/web/features/auth/_components/login-form.tsx` to use the validated destination, Supabase sign-in, replace navigation, refresh, and bounded session context.
- [x] 2.4 **TRIANGULATE/REFACTOR — exercise browser behavior.** Focused Playwright and complete web regression checks pass; coverage verifies redirects, no private-content flash, safe handoff, unavailable-vs-invalid context, and cookie policy.

### PR 2 release/docs follow-up (complete)

- [x] 2.5 Update environment and concise web/root documentation and run API regression evidence; retain the frontend-only/backend-unchanged boundary.

## Verification command set

```bash
pnpm test:web-auth
pnpm lint:web
pnpm build:web
pnpm test:web-e2e             # PR 2 only
cd apps/api && uv run ruff check .  # release verification only; API must remain unchanged
```
