# build-login-ui

OpenSpec change container for the login UI slice.

## Status

**Phase: apply in progress** — proposal, spec, design, and tasks are complete.
PR 1 (auth contracts and unit-level tests) is applied; PR 2 functional `/login`
UI and PR 3 visual/accessibility polish remain pending.

## Intent

Create the frontend login user interface for Kaito through a chained PR flow.
PR 1 establishes provider-agnostic auth contracts and unit tests; later PRs add
the `/login` route, form behavior, styling, accessibility, and E2E coverage.

## SDD guardrails

- Keep PR boundaries explicit: PR 1 auth contracts only, PR 2 functional UI, PR 3 polish/accessibility.
- Do not add signup, password reset, demo access, magic-link, social auth, route guards, onboarding/dashboard branching, or backend behavior in this change.
- Technical artifacts for this change should be written in English.
- Strict TDD applies to implementation phases when test runners are available.

## Next phase

**Apply PR 2** — implement the functional `/login` route and form behavior after
PR 1 review findings are resolved.
