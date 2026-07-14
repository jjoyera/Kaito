# Design: Implement Onboarding Persistence and RLS

## Technical Approach

Persist one owner-scoped JSONB snapshot through FastAPI use cases. Supabase CLI owns DDL/RLS; synchronous SQLAlchemy 2/psycopg 3 performs CRUD. Both boundaries run Issue #20 validation with an explicit runner-local date.

## Architecture Decisions

| Decision | Alternative / tradeoff | Choice and rationale |
|---|---|---|
| Storage | History adds excluded capability | `onboarding_snapshots(owner_id uuid PK/FK auth.users, snapshot jsonb, created_at, updated_at)`; checks require object/version/state; no extra index/history. Atomic upsert preserves `updated_at` on equivalent retry. |
| Transactions | Repository commits hide atomicity | Use case enters one `OwnerTransactionFactory` context wrapping `owner_connection`; repositories MUST NOT commit/rollback. |
| Validation/owner | HTTP-only validation or client owner | Validate before write/after read. Only `UserContext.user_id` becomes `UserId`; inputs/results omit owner/storage. Repository filters plus RLS enforce ownership. |

## Data Flow and Security

`Bearer JWT → UserContext → use case → guarded owner transaction → repository → RLS → JSONB`

Lifespan—not import—requires URL and literal role `kaito_api_login`. Migration creates it `NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS`, with only required `authenticated` membership and no table grants; operations temporarily add `LOGIN`/password. Unsupported hosting fails closed.

Before role adoption, startup/every transaction verify expected `session_user`, `current_user=session_user`, safe attributes, and empty claims. Static `SET LOCAL ROLE authenticated`, parameterized `{sub,role}`, and login/effective-role/`auth.uid()` assertions precede owner-filtered CRUD; policies retain `USING`/`WITH CHECK`. No-row/false/error disposes or rolls back/invalidates; rollback pool reset plus re-guard clears local state. Only stable codes are observable—never identity, URL, SQL, claims, payload, or raw errors.

## File Boundaries

| File | Action | Responsibility |
|---|---|---|
| `apps/api/app/modules/runner_profile/{domain,validation}.py` | Modify/create | Types; parse, normalize, validate, demote. |
| `apps/api/app/modules/runner_profile/repository.py` | Create | Port, SQL adapter, transaction factory. |
| `apps/api/app/modules/runner_profile/use_cases.py` | Create | Inputs, failures, orchestration. |
| `apps/api/app/modules/runner_profile/{schemas,router}.py`, `apps/api/app/main.py`, `apps/api/tests/runner_profile/test_{use_cases,router}.py` | Later | DTOs/routes/composition and tests. |

## Executable Contracts

```python
JsonObject = Mapping[str, Any]

@dataclass(frozen=True, slots=True)
class Diagnostic:
    code: str
    field: str | None
    message_key: str
    severity: Literal["error", "warning"]
    metadata: Mapping[str, str | int | float | bool | None]

@dataclass(frozen=True, slots=True)
class SaveOnboardingInput:
    snapshot: JsonObject
    validation_date: date

@dataclass(frozen=True, slots=True)
class ReadOnboardingInput:
    validation_date: date

@dataclass(frozen=True, slots=True)
class OnboardingResult:
    snapshot: OnboardingSnapshot
    diagnostics: tuple[Diagnostic, ...]

class OnboardingRepository(Protocol):
    def read(self, owner_id: UserId) -> JsonObject | None: ...
    def upsert(self, owner_id: UserId, snapshot: OnboardingSnapshot) -> None: ...

class OwnerTransactionFactory(Protocol):
    def __call__(self, user: UserContext) -> ContextManager[OnboardingRepository]: ...

def save_onboarding(user: UserContext, data: SaveOnboardingInput,
                    transactions: OwnerTransactionFactory) -> OnboardingResult: ...
def read_onboarding(user: UserContext, data: ReadOnboardingInput,
                    transactions: OwnerTransactionFactory) -> OnboardingResult: ...
```

`PUT /runner-profile/onboarding` accepts `{snapshot, validation_date}`; `GET` takes `validation_date=YYYY-MM-DD`; both return `{snapshot, diagnostics}`. Failures/mappings: `InvalidOnboardingInput(code="malformed_snapshot"|"unsupported_contract_version")` → 422 `Invalid onboarding snapshot`; `OnboardingNotFound` → 404 `Onboarding snapshot not found`; `CorruptOnboardingData` → 500 `Stored onboarding snapshot is invalid`; `OnboardingPersistenceUnavailable` → 503 `Service unavailable`. Strict DTOs reject owner/storage fields with 422.

## Deterministic Behavior Contract

| Case | Required outcome |
|---|---|
| Save | Freeze without mutating input; malformed/unknown data opens no transaction. Clear hidden restriction/modality fields, validate only with `validation_date`, demote invalid `completed`, upsert normalization. |
| Read | Missing/corrupt data, including unknown version, never upserts. Persist revalidation clearing/demotion atomically. Catch domain failures inside `owner_connection`; raise after clean exit to avoid database-failure misclassification. |
| Diagnostics | Codes: `required`, `out_of_range`, `target_date_not_future`, `availability_insufficient`; canonical field path; errors block, warnings do not. Metadata has rule parameters, never values/identity. |
| Failure/no mutation | Repository/transaction failure → `OnboardingPersistenceUnavailable`; rollback preserves prior data. Inputs/results are immutable and owner-free. |

## Testing Strategy

Task 2.3 imports these contracts and uses transaction/repository fakes for calls, no-write, immutability, dates, clearing, demotion, diagnostics, and failures. Existing pinned-CLI Docker proof remains: two Auth claim identities use non-privileged `kaito_api_login`; own CRUD succeeds, cross insert is denied, cross select/update/delete affects zero; admin is setup/cleanup only, output is secret/identity-free, cleanup is sanitized/failing, and CI always stops Supabase.

## Threat Matrix

| Boundary | Applicability | Design response | Planned RED tests |
|---|---|---|---|
| Documentation-like paths | N/A — fixed pytest path; no executable classification | None | None |
| Git repository selection | N/A — no Git invocation | None | None |
| Commit state | N/A — no commit automation | None | None |
| Push state | N/A — no push automation | None | None |
| PR commands | N/A — no PR command composition | None | None |

## Migration / Rollout

Supabase migrations own roles, grants, constraints, triggers, and RLS; no Alembic. One strict-TDD PR on `feat/onboarding-persistence-21-pr2` is capped at 2,500 lines. Rollback disables API composition before authorized forward removal and preserves data by default. UI, plan generation, history, analytics, and broad docs remain excluded.

## Open Questions

None.
