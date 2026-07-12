# protect-private-routes-user-session-flow

OpenSpec change container for private-route protection and the user session flow.

## Current status

**Completed, merged, synced, and archived.** PR 1A/1B, the behavior-preserving auth ownership refactor, and PR 2 are complete. `/onboarding` is the protected placeholder fallback after authenticated login; it does not represent onboarding completion or product-state routing. See [`archive-report.md`](archive-report.md).

## Intent

Delivered a coherent web session flow for Kaito: authenticated users reach the
protected `/onboarding` placeholder through validated internal handoffs, while
session and integration boundaries remain explicit.

## SDD guardrails

- The completed change used English technical artifacts and strict TDD where relevant
  test runners were available.
- Delivery followed an interactive, chained-PR strategy with explicit review-budget
  and evidence exceptions recorded in the verification artifacts.

## Lifecycle

Archive complete. Canonical specs include the verified behavior; `/dashboard` and onboarding-completion selection remain out of scope.
