# Review Ledger — build-login-ui

## 4R findings for PR 1

| Finding | Severity | Resolution |
| --- | --- | --- |
| Auth outcome mapping treated bare provider `400`/`401` statuses as `invalid_credentials`. | R3/R4 blocker | Fixed: invalid credentials now require an explicit provider/auth error code; status-only `400`/`401` maps to `system_error`. Unit tests cover explicit credential codes, status-only responses, and raw payload redaction. |
| CI did not run the new auth contract tests. | R3 blocker | Fixed: `.github/workflows/ci.yml` now runs `pnpm test:web-auth` with existing web validation. |
| Change README still described only initialized/awaiting proposal status. | R2 readability | Fixed: README now records completed proposal/spec/design/tasks, PR 1 apply complete, and PR 2/PR 3 pending. |
| `apps/web/next-env.d.ts` contained build-generated route type import churn. | Generated churn | Fixed: restored the pre-build/dev Next reference content while keeping the file. |

## CodeRabbit findings for PR 1

| Finding | Severity | Resolution |
| --- | --- | --- |
| `continueToAuthenticatedFlow` used an unused `state` parameter with `void state`. | Actionable | Fixed: removed the production parameter and kept the no-state-inspection test through a widened test-only function type. |
| Brand palette lacked explicit WCAG-safe text pairings for secondary and success colors. | Actionable | Fixed: documented accessible secondary/success text alternatives and usage restrictions for normal text on light backgrounds. |
| `apply-progress.md` included a developer-specific absolute workspace path. | Actionable | Fixed: replaced it with repository-neutral workspace-root wording. |
| Design used invalid login card width expression `min(100%, 28rem-32rem)`. | Actionable | Fixed: replaced it with valid `min(100%, 32rem)` and optional `clamp(20rem, 92vw, 32rem)`. |
| Button examples documented hover but not keyboard focus. | Nitpick | Fixed: added a `:focus-visible` example with outline and box-shadow. |
| Thrown provider errors were converted to `system_error` without a reporting hook. | Nitpick | Fixed: added optional `onSystemError` reporting to preserve diagnostics without leaking raw provider details into user-facing outcomes. |
