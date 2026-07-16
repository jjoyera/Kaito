# Artifacts — refine-signup-ux-flow

Artifact index for the `refine-signup-ux-flow` OpenSpec change.

## Phase status

| Phase | Status | Artifact |
| --- | --- | --- |
| init | complete | `README.md`, `artifacts.md` |
| proposal | approved; password recovery deferred | `proposal.md` |
| spec | complete | `specs/signup-registration-ux/spec.md` |
| design | complete; awaiting approval | `design.md` |
| tasks | blocked by design approval | `tasks.md` |
| apply | blocked by approved tasks | `apply-progress.md` |
| verify | blocked by apply | `verify-report.md` |
| sync | blocked by successful verification | `sync-report.md` |

## Project context read during init

- `openspec/config.yaml`
- `openspec/project-context.md`
- `package.json`
- `.atl/skill-registry.md`
- Relevant registration requirements and journeys in `docs/02-user-journeys.md`, `docs/04-functional-requirements.md`, and `docs/08-architecture.md`
- Target path verified as absent before creation: `openspec/changes/refine-signup-ux-flow/`

## Specification notes

- The proposal did not include a `Capabilities` section, so the affected registration and post-signup login behavior is represented as one inferred domain: `signup-registration-ux`.
- No canonical spec exists at `openspec/specs/signup-registration-ux/spec.md`; this change therefore contains a full new-domain specification.
- No other active change spec was found for the inferred domain.
- The approved option 1 boundary defers real password recovery and prohibits a fake or dead recovery CTA.

## Current implementation references (read-only and frozen)

- `apps/web/app/(auth)/register/page.tsx`
- `apps/web/features/auth/_components/register-form.tsx`
- `apps/web/features/auth/_adapters/supabase-sign-up.ts`
- `apps/web/features/auth/_use-cases/register-client.ts`
- `apps/web/features/auth/_domain/register-validation.ts`
- `apps/web/shared/components/processing-modal.tsx`
- `apps/web/app/styles.css`
- `apps/web/e2e/register.spec.ts`
- `apps/web/proxy.ts`
- Related unit/contract tests beside the auth adapter, use case, domain, and proxy code

These paths are references for later discovery and design only. Existing uncommitted implementation remains untouched by init.

## Design decisions

- Registration consumes a closed provider-agnostic outcome union; rate limits may carry trusted structured retry seconds and otherwise use a 60-second fallback.
- `/register` uses an explicit request/navigation/feedback/cooldown state machine with an absolute same-tab cooldown deadline.
- Confirmation-required signup uses a 30-second, one-time sessionStorage record bound to an opaque URL nonce; the login banner consumes the record and strips the nonce. No email or credential enters navigation/storage state.
- The processing overlay is an auth-owned ordinary-DOM portal with dialog semantics, focus containment, background inertness, and no dismissal. The frozen speculative native shared dialog is removed during apply.
- Browser-sensitive behavior remains covered by Playwright; pure adapter, use-case, transition, cooldown, and nonce rules use the existing Node/tsx runner under strict TDD.

## Relevant validation commands for a future apply phase

- `pnpm test:web-auth`
- `pnpm lint:web`
- `pnpm build:web`
- `pnpm test:web-e2e`

The repository requires Node.js `>=24.18 <25`; the recorded local preflight uses Node.js `v22.22.2`, so web validation will require switching Node versions.

## Session choices for this change

- Mode: interactive
- Artifact store: OpenSpec repository only
- Chained PR strategy: single-pr-default
- Review budget: 3,000 changed lines
- Application code modified by init: no
