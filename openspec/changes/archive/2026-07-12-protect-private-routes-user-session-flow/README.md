# protect-private-routes-user-session-flow

OpenSpec change container for private-route protection and the user session flow.

## Current status

**Apply is partial.** PR 1A/1B foundation and the behavior-preserving auth ownership refactor are complete. The live login handoff intentionally remains `/`. PR 2—creating/protecting `/onboarding` and activating it as the authenticated handoff—is unstarted.

Proposal, specs, design, and tasks are approved/complete planning artifacts. Their `/onboarding` statements describe the future PR 2 requirement, not current runtime behavior.

## Intent

Define a coherent web session flow for Kaito and protect routes that require an
authenticated user. Scope, expected behavior, affected routes, and integration
boundaries remain to be confirmed during proposal.

## SDD guardrails

- Technical artifacts must be written in English.
- Strict TDD applies during implementation when relevant test runners are available.
- This init creates only the change container and artifact index; proposal, spec,
  design, tasks, implementation, verification, sync, and lifecycle operations are
  not part of this phase.
- Current session mode is interactive, with an auto-forecast chained-PR strategy
  and a 400 changed-line review budget.

## Next phase

**PR 2 apply, only when separately authorized** — add route acceptance coverage first, then create/protect `/onboarding` and switch the login handoff from `/` to `/onboarding`.
