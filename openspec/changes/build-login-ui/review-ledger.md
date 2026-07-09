# Review Ledger — build-login-ui

## 4R findings for PR 1

| Finding | Severity | Resolution |
| --- | --- | --- |
| Auth outcome mapping treated bare provider `400`/`401` statuses as `invalid_credentials`. | R3/R4 blocker | Fixed: invalid credentials now require an explicit provider/auth error code; status-only `400`/`401` maps to `system_error`. Unit tests cover explicit credential codes, status-only responses, and raw payload redaction. |
| CI did not run the new auth contract tests. | R3 blocker | Fixed: `.github/workflows/ci.yml` now runs `pnpm test:web-auth` with existing web validation. |
| Change README still described only initialized/awaiting proposal status. | R2 readability | Fixed: README now records completed proposal/spec/design/tasks, PR 1 apply complete, and PR 2/PR 3 pending. |
| `apps/web/next-env.d.ts` contained build-generated route type import churn. | Generated churn | Fixed: restored the pre-build/dev Next reference content while keeping the file. |
