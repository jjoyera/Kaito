from collections.abc import Mapping
from datetime import date
from math import isfinite
from numbers import Real
from typing import Any

from app.modules.runner_profile.domain import (
    OnboardingSnapshot,
    OnboardingState,
    TargetDate,
    WeeklyAvailability,
)
from app.modules.runner_profile.use_cases import Diagnostic

JsonObject = Mapping[str, Any]

_MODALITIES = frozenset({"trail", "ultra_trail", "ocr", "backyard"})
_OBSTACLE_DIFFICULTIES = frozenset({"low", "medium", "high"})
_REMOVED_PRIOR_HISTORY_FIELDS = frozenset(
    {
        "training_years",
        "completed_race_count_range",
        "practiced_modalities",
        "practiced_terrain",
    }
)
_RECENT_CONSISTENCIES = frozenset({"irregular", "fairly_consistent", "very_consistent"})


def _diagnostic(code: str, field: str) -> Diagnostic:
    return Diagnostic(code, field, code, "error", {})


def _is_number(value: Any, *, positive: bool = False, half_steps: bool = False) -> bool:
    if isinstance(value, bool) or not isinstance(value, Real) or not isfinite(value):
        return False
    if positive and value <= 0 or not positive and value < 0:
        return False
    return not half_steps or value * 2 == int(value * 2)


def _required(value: Any, field: str, diagnostics: list[Diagnostic]) -> None:
    if value is None:
        diagnostics.append(_diagnostic("required", field))


def _mapping(value: Any) -> dict[str, Any] | None:
    return dict(value) if isinstance(value, Mapping) else None


def parse_and_normalize(
    raw: JsonObject, validation_date: date
) -> tuple[OnboardingSnapshot, tuple[Diagnostic, ...]]:
    if not isinstance(raw, Mapping):
        raise ValueError("malformed_snapshot")
    if raw.get("contract_version") != "1":
        raise ValueError("unsupported_contract_version")
    state = raw.get("state")
    if state not in {member.value for member in OnboardingState}:
        raise ValueError("malformed_snapshot")
    profile, goal = _mapping(raw.get("profile")), _mapping(raw.get("goal"))
    if profile is None or goal is None:
        raise ValueError("malformed_snapshot")
    _reject_removed_fields(profile, goal)
    _validate_structural(profile, goal)
    _clear_hidden(profile, goal)
    snapshot = OnboardingSnapshot(
        contract_version="1", state=OnboardingState(state), profile=profile, goal=goal
    )
    diagnostics = _completion_diagnostics(snapshot, validation_date)
    if snapshot.state is OnboardingState.COMPLETED and diagnostics:
        snapshot = OnboardingSnapshot(
            contract_version="1",
            state=OnboardingState.INCOMPLETE,
            profile=profile,
            goal=goal,
        )
    return snapshot, tuple(diagnostics)


def _reject_removed_fields(profile: dict[str, Any], goal: dict[str, Any]) -> None:
    prior_history = _mapping(profile.get("prior_history", {}))
    if (
        prior_history is not None
        and _REMOVED_PRIOR_HISTORY_FIELDS.intersection(prior_history)
    ) or "technicality" in goal:
        raise ValueError("malformed_snapshot")


def _validate_structural(profile: dict[str, Any], goal: dict[str, Any]) -> None:
    _validate_profile_blocks(profile)
    _validate_availability(profile)
    _validate_baseline(profile)
    _validate_profile_numbers(profile)
    _validate_restrictions(profile)
    _validate_goal(goal)


def _validate_profile_blocks(profile: dict[str, Any]) -> None:
    for block in ("prior_history", "baseline_4_weeks", "availability", "restrictions"):
        if block in profile and not isinstance(profile[block], Mapping):
            raise ValueError("malformed_snapshot")


def _validate_availability(profile: dict[str, Any]) -> None:
    availability = (_mapping(profile.get("availability", {})) or {}).get(
        "minutes_by_day"
    )
    if availability is not None:
        try:
            WeeklyAvailability(availability)
        except ValueError:
            raise ValueError("malformed_snapshot") from None


def _validate_baseline(profile: dict[str, Any]) -> None:
    baseline = _mapping(profile.get("baseline_4_weeks", {})) or {}
    consistency = baseline.get("recent_consistency")
    if consistency is not None and not isinstance(consistency, str):
        raise ValueError("malformed_snapshot")


def _validate_profile_numbers(profile: dict[str, Any]) -> None:
    prior = _mapping(profile.get("prior_history", {})) or {}
    baseline = _mapping(profile.get("baseline_4_weeks", {})) or {}
    checks = (
        (prior.get("longest_completed_distance_km"), False, False),
        (baseline.get("sessions"), False, False),
        (baseline.get("distance_km"), False, False),
        (baseline.get("positive_elevation_m"), False, False),
        (baseline.get("longest_outing_km"), False, False),
    )
    if any(
        value is not None and not _is_number(value, positive=positive, half_steps=half)
        for value, positive, half in checks
    ):
        raise ValueError("malformed_snapshot")
    sessions = baseline.get("sessions")
    if sessions is not None and (
        isinstance(sessions, bool) or not isinstance(sessions, int)
    ):
        raise ValueError("malformed_snapshot")


def _validate_restrictions(profile: dict[str, Any]) -> None:
    restrictions = _mapping(profile.get("restrictions", {})) or {}
    if "has_restrictions" in restrictions and not isinstance(
        restrictions["has_restrictions"], bool
    ):
        raise ValueError("malformed_snapshot")
    if "detail" in restrictions and not isinstance(restrictions["detail"], str):
        raise ValueError("malformed_snapshot")


def _validate_goal(goal: dict[str, Any]) -> None:
    _validate_goal_measurements(goal)
    _validate_goal_integers(goal)
    _validate_goal_strings(goal)


def _validate_goal_measurements(goal: dict[str, Any]) -> None:
    for key in ("target_distance_km", "positive_elevation_m"):
        if key in goal and not _is_number(goal[key], positive=True):
            raise ValueError("malformed_snapshot")


def _validate_goal_integers(goal: dict[str, Any]) -> None:
    for key in ("obstacle_count", "target_loops"):
        if key in goal and (
            isinstance(goal[key], bool)
            or not isinstance(goal[key], int)
            or goal[key] < 1
        ):
            raise ValueError("malformed_snapshot")
    if "max_altitude_m" in goal and (
        isinstance(goal["max_altitude_m"], bool)
        or not isinstance(goal["max_altitude_m"], int)
    ):
        raise ValueError("malformed_snapshot")


def _validate_goal_strings(goal: dict[str, Any]) -> None:
    for key in ("modality", "obstacle_difficulty"):
        if key in goal and not isinstance(goal[key], str):
            raise ValueError("malformed_snapshot")


def _clear_hidden(profile: dict[str, Any], goal: dict[str, Any]) -> None:
    baseline = _mapping(profile.get("baseline_4_weeks"))
    if baseline is not None:
        baseline.pop("training_hours", None)
        profile["baseline_4_weeks"] = baseline
    restrictions = _mapping(profile.get("restrictions"))
    if restrictions is not None:
        if restrictions.get("has_restrictions") is False:
            restrictions.pop("detail", None)
        profile["restrictions"] = restrictions
    modality = goal.get("modality")
    hidden = {
        "trail": {"obstacle_count", "obstacle_difficulty", "target_loops"},
        "ultra_trail": {"obstacle_count", "obstacle_difficulty", "target_loops"},
        "ocr": {
            "positive_elevation_m",
            "max_altitude_m",
            "target_loops",
        },
        "backyard": {
            "target_distance_km",
            "positive_elevation_m",
            "max_altitude_m",
            "obstacle_count",
            "obstacle_difficulty",
        },
    }
    for key in hidden.get(modality, set()):
        goal.pop(key, None)


def _completion_diagnostics(
    snapshot: OnboardingSnapshot, validation_date: date
) -> list[Diagnostic]:
    profile, goal, diagnostics = snapshot.profile, snapshot.goal, []
    _add_required_diagnostics(profile, goal, diagnostics)
    _add_availability_diagnostics(profile, diagnostics)
    _add_restriction_diagnostics(profile, diagnostics)
    _add_baseline_diagnostics(profile, diagnostics)
    _add_goal_diagnostics(goal, validation_date, diagnostics)
    return diagnostics


def _add_required_diagnostics(
    profile: JsonObject, goal: JsonObject, diagnostics: list[Diagnostic]
) -> None:
    required = (
        (
            profile.get("prior_history", {}),
            ("longest_completed_distance_km",),
            "profile.prior_history",
        ),
        (
            profile.get("baseline_4_weeks", {}),
            (
                "sessions",
                "distance_km",
                "positive_elevation_m",
                "longest_outing_km",
            ),
            "profile.baseline_4_weeks",
        ),
        (
            profile.get("restrictions", {}),
            ("has_restrictions",),
            "profile.restrictions",
        ),
        (goal, ("modality", "target_date"), "goal"),
    )
    for values, fields, prefix in required:
        for field in fields:
            _required(values.get(field), f"{prefix}.{field}", diagnostics)


def _add_availability_diagnostics(
    profile: JsonObject, diagnostics: list[Diagnostic]
) -> None:
    availability = (_mapping(profile.get("availability", {})) or {}).get(
        "minutes_by_day"
    )
    if availability is None:
        diagnostics.append(
            _diagnostic("required", "profile.availability.minutes_by_day")
        )
    else:
        weekly_availability = WeeklyAvailability(availability)
        if weekly_availability.available_days < 3:
            diagnostics.append(
                _diagnostic(
                    "availability_insufficient_days",
                    "profile.availability.minutes_by_day",
                )
            )
        if weekly_availability.total_minutes < 150:
            diagnostics.append(
                _diagnostic(
                    "availability_insufficient_total",
                    "profile.availability.minutes_by_day",
                )
            )


def _add_restriction_diagnostics(
    profile: JsonObject, diagnostics: list[Diagnostic]
) -> None:
    restrictions = profile.get("restrictions", {})
    if restrictions.get("has_restrictions") and not (
        isinstance(restrictions.get("detail"), str)
        and 1 <= len(restrictions["detail"].strip()) <= 500
    ):
        diagnostics.append(_diagnostic("required", "profile.restrictions.detail"))


def _add_baseline_diagnostics(
    profile: JsonObject, diagnostics: list[Diagnostic]
) -> None:
    baseline = profile.get("baseline_4_weeks", {})
    consistency = baseline.get("recent_consistency")
    if consistency is None:
        diagnostics.append(
            _diagnostic("required", "profile.baseline_4_weeks.recent_consistency")
        )
    elif consistency not in _RECENT_CONSISTENCIES:
        diagnostics.append(
            _diagnostic("out_of_range", "profile.baseline_4_weeks.recent_consistency")
        )


def _add_goal_diagnostics(
    goal: JsonObject, validation_date: date, diagnostics: list[Diagnostic]
) -> None:
    modality = goal.get("modality")
    if modality not in _MODALITIES:
        diagnostics.append(_diagnostic("out_of_range", "goal.modality"))
    target_date = goal.get("target_date")
    try:
        if target_date is not None and not TargetDate.parse(target_date).is_after(
            validation_date
        ):
            diagnostics.append(
                _diagnostic("target_date_not_future", "goal.target_date")
            )
    except ValueError:
        diagnostics.append(_diagnostic("out_of_range", "goal.target_date"))
    conditional = {
        "trail": ("target_distance_km", "positive_elevation_m"),
        "ultra_trail": ("target_distance_km", "positive_elevation_m"),
        "ocr": ("target_distance_km", "obstacle_count"),
        "backyard": ("target_loops",),
    }
    for field in conditional.get(modality, ()):
        _required(goal.get(field), f"goal.{field}", diagnostics)
    if (
        modality in {"trail", "ultra_trail"}
        and goal.get("max_altitude_m") is not None
        and goal["max_altitude_m"] < 0
    ):
        diagnostics.append(_diagnostic("out_of_range", "goal.max_altitude_m"))
    if modality == "ocr" and goal.get("obstacle_difficulty") not in {
        None,
        *_OBSTACLE_DIFFICULTIES,
    }:
        diagnostics.append(_diagnostic("out_of_range", "goal.obstacle_difficulty"))
