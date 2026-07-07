# Artifact References — initial-project-scaffolding

Current artifacts:

- `openspec/changes/archive/2026-07-07-initial-project-scaffolding/proposal.md` — created in the
  proposal phase; defines the approved scaffolding intent, scope, risks, rollback,
  and success criteria.
- `openspec/changes/archive/2026-07-07-initial-project-scaffolding/specs/project-scaffolding/spec.md`
  — created in the spec phase; full new-domain spec with SHALL-style requirements
  and scenarios covering monorepo boundaries, pnpm workspace, `apps/web` and
  `apps/api` (`/health`) runnable boundaries, reserved `packages/api-client`,
  Docker local convenience (web/api only), basic CI, Spanish living-document
  `README.md`, and explicit scope exclusions.

- `openspec/changes/archive/2026-07-07-initial-project-scaffolding/design.md` — created in the
  design phase; fixes concrete implementation choices (Node 24.18 + pnpm 11,
  Python 3.12 + uv, minimal Next.js/FastAPI apps, `/health` → `{"status":"ok"}`,
  reserved `packages/api-client`, local-only Docker, basic CI, Spanish living
  README, and single-PR delivery under the 600-line review budget unless tasks
  reveal extra scope).
- `openspec/changes/archive/2026-07-07-initial-project-scaffolding/tasks.md` — created in the tasks
  phase; ordered implementation checklist with review workload forecast, concrete
  file targets, verification steps, and the single-PR-under-600-lines guardrail.
- `openspec/changes/archive/2026-07-07-initial-project-scaffolding/apply-progress.md` — created in
  the apply phase; records implemented files, verification evidence, and local
  environment notes.

Planned artifacts for subsequent phases:

- Verify artifacts are not created yet; verify must review implementation against
  the spec and tasks.

Reference documents:

- `README.md`
- `docs/01-git-flow.md`
- `docs/08-architecture.md`
- `openspec/config.yaml`
