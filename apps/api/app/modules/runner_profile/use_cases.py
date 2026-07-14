from collections.abc import Mapping
from contextlib import AbstractContextManager
from dataclasses import dataclass
from datetime import date
from typing import Any, Literal, Protocol

from app.modules.auth.context import UserContext
from app.modules.runner_profile.domain import OnboardingSnapshot
from app.modules.shared.domain.value_objects import UserId

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
    def __call__(
        self, user: UserContext
    ) -> AbstractContextManager[OnboardingRepository]: ...


class InvalidOnboardingInput(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class OnboardingNotFound(Exception):
    pass


class CorruptOnboardingData(Exception):
    pass


class OnboardingPersistenceUnavailable(Exception):
    def __init__(self) -> None:
        super().__init__("service_unavailable")


def save_onboarding(
    user: UserContext,
    data: SaveOnboardingInput,
    transactions: OwnerTransactionFactory,
) -> OnboardingResult:
    snapshot = _validated_input(data)
    owner_id = UserId(user.user_id)
    try:
        with transactions(user) as repository:
            repository.upsert(owner_id, snapshot.snapshot)
    except Exception:
        raise OnboardingPersistenceUnavailable() from None
    return snapshot


def read_onboarding(
    user: UserContext,
    data: ReadOnboardingInput,
    transactions: OwnerTransactionFactory,
) -> OnboardingResult:
    owner_id = UserId(user.user_id)
    corrupt = False
    missing = False
    try:
        with transactions(user) as repository:
            stored = repository.read(owner_id)
            if stored is None:
                missing = True
            else:
                try:
                    result = _validated_stored(stored, data.validation_date)
                except ValueError:
                    corrupt = True
                else:
                    if _normalized_changed(result.snapshot, stored):
                        repository.upsert(owner_id, result.snapshot)
    except Exception:
        raise OnboardingPersistenceUnavailable() from None
    if missing:
        raise OnboardingNotFound("onboarding_snapshot_not_found")
    if corrupt:
        raise CorruptOnboardingData("stored_onboarding_snapshot_is_invalid")
    return result


def _validated_input(data: SaveOnboardingInput) -> OnboardingResult:
    try:
        from app.modules.runner_profile.validation import parse_and_normalize

        snapshot, diagnostics = parse_and_normalize(data.snapshot, data.validation_date)
    except ValueError as error:
        code = str(error)
        if code not in {"malformed_snapshot", "unsupported_contract_version"}:
            code = "malformed_snapshot"
        raise InvalidOnboardingInput(code) from None
    return OnboardingResult(snapshot, diagnostics)


def _validated_stored(snapshot: JsonObject, validation_date: date) -> OnboardingResult:
    from app.modules.runner_profile.validation import parse_and_normalize

    normalized, diagnostics = parse_and_normalize(snapshot, validation_date)
    return OnboardingResult(normalized, diagnostics)


def _normalized_changed(snapshot: OnboardingSnapshot, raw: JsonObject) -> bool:
    return (
        snapshot.contract_version != raw.get("contract_version")
        or snapshot.state.value != raw.get("state")
        or dict(snapshot.profile) != raw.get("profile")
        or dict(snapshot.goal) != raw.get("goal")
    )
