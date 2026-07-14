from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import date
from enum import StrEnum
from math import isfinite
from numbers import Real
from types import MappingProxyType
from typing import Any


class OnboardingState(StrEnum):
    INCOMPLETE = "incomplete"
    COMPLETED = "completed"


@dataclass(frozen=True, slots=True)
class _PositiveValue:
    value: int | float

    def __post_init__(self) -> None:
        if (
            isinstance(self.value, bool)
            or not isinstance(self.value, Real)
            or not isfinite(self.value)
            or self.value <= 0
        ):
            raise ValueError("invalid_positive_value")


@dataclass(frozen=True, slots=True)
class PositiveDistanceKm(_PositiveValue):
    pass


@dataclass(frozen=True, slots=True)
class PositiveDurationMinutes(_PositiveValue):
    pass


@dataclass(frozen=True, slots=True)
class PositiveElevationM(_PositiveValue):
    pass


@dataclass(frozen=True, slots=True)
class TargetDate:
    value: date

    @classmethod
    def parse(cls, raw: str) -> "TargetDate":
        try:
            parsed = date.fromisoformat(raw)
        except (TypeError, ValueError):
            raise ValueError("invalid_target_date") from None
        if raw != parsed.isoformat():
            raise ValueError("invalid_target_date")
        return cls(parsed)

    def is_after(self, local_validation_date: date) -> bool:
        return self.value > local_validation_date


_ALLOWED_WEEKDAYS = frozenset(
    {
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
    }
)


@dataclass(frozen=True, slots=True)
class WeeklyAvailability:
    minutes_by_day: Mapping[str, int]

    def __post_init__(self) -> None:
        if not isinstance(self.minutes_by_day, Mapping):
            raise ValueError("invalid_weekly_availability")
        copied = dict(self.minutes_by_day)
        if any(
            day not in _ALLOWED_WEEKDAYS
            or isinstance(minutes, bool)
            or not isinstance(minutes, int)
            or not 15 <= minutes <= 300
            for day, minutes in copied.items()
        ):
            raise ValueError("invalid_weekly_availability")
        object.__setattr__(self, "minutes_by_day", MappingProxyType(copied))

    @property
    def total_minutes(self) -> int:
        return sum(self.minutes_by_day.values())

    @property
    def available_days(self) -> int:
        return len(self.minutes_by_day)

    @property
    def meets_completion_threshold(self) -> bool:
        return self.available_days >= 3 and self.total_minutes >= 150


_LEAKAGE_KEYS = frozenset(
    {
        "owner",
        "owner_id",
        "user_id",
        "storage",
        "storage_id",
        "table",
        "table_id",
        "ui",
        "ui_step",
        "step",
        "step_id",
    }
)


def _contains_leakage(value: Any) -> bool:
    if isinstance(value, Mapping):
        return any(
            key in _LEAKAGE_KEYS or _contains_leakage(nested)
            for key, nested in value.items()
        )
    if isinstance(value, list | tuple):
        return any(_contains_leakage(item) for item in value)
    return False


def _freeze(value: Any) -> Any:
    if isinstance(value, Mapping):
        return MappingProxyType({key: _freeze(nested) for key, nested in value.items()})
    if isinstance(value, list):
        return tuple(_freeze(item) for item in value)
    if isinstance(value, tuple):
        return tuple(_freeze(item) for item in value)
    return value


@dataclass(frozen=True, slots=True)
class OnboardingSnapshot:
    state: OnboardingState
    profile: Mapping[str, Any]
    goal: Mapping[str, Any]
    contract_version: str = field(default="1", kw_only=True)

    def __post_init__(self) -> None:
        if self.contract_version != "1":
            raise ValueError("unsupported_contract_version")
        if not isinstance(self.state, OnboardingState):
            raise ValueError("invalid_onboarding_state")
        if not isinstance(self.profile, Mapping) or not isinstance(self.goal, Mapping):
            raise ValueError("invalid_onboarding_snapshot")
        if _contains_leakage(self.profile) or _contains_leakage(self.goal):
            raise ValueError("onboarding_snapshot_leakage")
        object.__setattr__(self, "profile", _freeze(self.profile))
        object.__setattr__(self, "goal", _freeze(self.goal))
