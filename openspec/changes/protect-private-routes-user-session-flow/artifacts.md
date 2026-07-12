# Artifacts — protect-private-routes-user-session-flow

Artifact index and phase tracking for the
`protect-private-routes-user-session-flow` OpenSpec change.

## Current status

PR 1A/1B foundation and the behavior-preserving ownership refactor are complete. The live handoff intentionally remains `/`. PR 2 `/onboarding` route/protection/handoff activation is unstarted; proposal/spec/design statements describing it remain future requirements.

## Phase status

| Phase | Status | Artifact |
| --- | --- | --- |
| init | complete | `README.md`, `artifacts.md` |
| proposal | approved | `proposal.md` |
| spec | complete | `specs/web-session-flow/spec.md`, `specs/web-login-ui/spec.md` |
| design | approved | `design.md` |
| tasks | complete | `tasks.md` |
| apply | partial — PR 1A + PR 1B and structure correction complete; PR 2 unstarted | `apply-progress.md` |
| verify | not started | — |
| sync | not started | — |
| archive | not started | — |

## Superseded init-time project snapshot

> Historical discovery evidence retained for traceability; it is not the current apply status.

- SDD configuration: `openspec/config.yaml`
- Project context: `openspec/project-context.md`
- Existing active and archived change inventory under `openspec/changes/`
- Existing canonical specs under `openspec/specs/`
- Change path verified as absent before creation:
  `openspec/changes/protect-private-routes-user-session-flow/`

## Current SDD and testing context

- Interactive SDD mode; strict TDD is enabled for implementation changes.
- Session artifact store: OpenSpec and Engram.
- Session chained-PR strategy: ask-always.
- Session review budget: 400 changed lines.
- Web stack: Next.js 16, React 19, TypeScript, ESLint, Node test scripts through
  `tsx --test`, and Playwright E2E.
- API stack: FastAPI, Python 3.12, pytest, and ruff.

## Proposal context

- `/login` is public/auth-aware and the first slice creates `/onboarding` as a real
  private route protected by the Supabase session flow.
- Successful login, or an authenticated visit to `/login`, uses a validated internal
  return URL when present and otherwise routes to `/onboarding`.
- `/onboarding` is only a minimal placeholder screen (for example, “Onboarding
  process”). No onboarding workflow, forms, persistence, state machine, completion
  rule, or domain logic is included.
- `/` is no longer the temporary authenticated fallback. Its current scaffold may
  remain unchanged, and it can become a public landing page later. `/dashboard` and
  data-driven onboarding/dashboard selection remain out of scope.
- Supabase Auth is the frontend identity/session provider; private API calls carry
  its access token and FastAPI independently validates it.
- An expired or invalid route session returns the user to `/login` with brief,
  trusted contextual feedback. A private API `401` instead surfaces a recoverable
  auth/session error with a user action to sign in again or re-authenticate; it must
  not trigger unconditional automatic redirects or retry loops.
- The first slice also covers loading UX and safe internal return URLs.
- `proposal.md` incorporates the approved `/onboarding` product decision.
- The spec defines route/session behavior, safe handoff, loading/no-flash behavior,
  recoverable API `401` handling, and the FastAPI authority boundary.

## Design context

- `design.md` selects Supabase SSR cookie storage with Next.js 16 `proxy.ts` for
  early refresh/redirects and server-page defense-in-depth before private rendering.
- Route policy is explicit: `/login` is public/auth-aware, `/onboarding` is private,
  and `/` remains public and is never the authenticated fallback.
- Return destinations use one bounded local-path validator; login context uses fixed
  enum-to-copy mappings rather than reflected query text.
- Private web API calls acquire the current Supabase token per request, attach it as
  a bearer credential, and return typed recoverable `401` versus system `503`
  failures without automatic retries or redirects.
- Backend code and auth semantics remain unchanged.
- The implementation forecast is 550–750 changed lines, so the design recommends a
  two-PR chain with each PR held below the session's 400-line review budget.

## Phase boundary

Design and tasks were explicitly approved by the user. The tasks phase is complete
with strict-TDD work units, verification commands, and a high-risk 400-line forecast.
The user resolved the workload blocker with `Dividir PR 1`. The delivery chain is now
**PR 1A → PR 1B → PR 2**: PR 1A owns pure auth/navigation/private-fetch contracts;
PR 1B owns Supabase browser/server/proxy session factories and cookie coverage; PR 2
owns route/login integration and is explicitly forbidden in the current apply run.

Apply has completed the PR 1A and PR 1B foundation with strict-TDD evidence and separate source/test physical-line counts below 400 per slice. The user subsequently approved Screaming Architecture: `app/` only orchestrates Next.js; auth owns underscore-scoped modules, including Supabase under `_infrastructure/supabase/` and authenticated fetch under `_adapters/`; `shared/` requires two distinct real features. The behavior-preserving structure correction is complete: auth implementation and colocated tests now use the approved underscore scopes, with Supabase under `_infrastructure/supabase/` and authenticated fetch under `_adapters/`. The focused suite remained 36/36 green before and after the move. PR 2 behavior has not started; final verification, sync, and archive remain pending.
