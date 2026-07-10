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

## 4R findings for PR 2

| Finding | Severity | Resolution |
| --- | --- | --- |
| Test auth adapter could be enabled by public env flag alone. | R1/R3 blocker | Fixed: adapter now requires non-production runtime, explicit Playwright flag, and loopback browser hostname. Hidden test DOM counter was removed. |
| Production `/login` exposed a guaranteed `system_error` fallback because real auth integration is deferred. | R4 blocker | Superseded in PR3: user chose to expose the dedicated login page in production to satisfy the product spec, while keeping provider-safe generic system-error feedback until real auth integration lands. |
| Login system failures were user-visible but not observable. | R4 blocker | Fixed: `system_error` outcomes report a scrubbed low-cardinality Sentry exception when DSN is configured. |
| Failed invalid/system submissions did not prove retry recovery. | R3 warning | Fixed: E2E now verifies the button re-enables and a successful retry can hand off after both invalid-credential and system-error outcomes. |
| Playwright CI used production `pnpm start` while `/login` is dev/preview-only. | R3 blocker | Superseded in PR3: the main adapter-backed E2E suite still runs on `pnpm dev`; a production-build Playwright check now verifies `/login` renders under `pnpm start`. |

Final PR2 4R re-review: risk, resilience, readability, and reliability all PASS.
