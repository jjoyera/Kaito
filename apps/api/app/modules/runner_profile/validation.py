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
_HABITUAL_TERRAINS = frozenset({"mountain", "trail", "road", "mixed"})
_MOUNTAIN_EXPERIENCES = frozenset({"low", "medium", "high"})
_PRIOR_MODALITY_RACE_FREQUENCIES = frozenset({"never", "once", "multiple"})
_PHYSICAL_STATUS_VALUES = frozenset(
    {"feeling_good", "carrying_fatigue", "recovering"}
)
_TRAINING_PREFERENCE_VALUES = {
    "mountain_trail_access": frozenset(
        {"easy_access", "weekends_only", "very_limited"}
    ),
    "gym_access": frozenset({"yes", "home_only"}),
    "planning_preference": frozenset({"fixed_routine", "flexible_weekly"}),
}


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
    _validate_prior_history(profile)
    _validate_training_preferences(profile)
    _validate_physical_status(profile)
    _validate_goal(goal)


def _validate_profile_blocks(profile: dict[str, Any]) -> None:
    for block in (
        "prior_history",
        "baseline_4_weeks",
        "availability",
        "training_preferences",
        "physical_status",
    ):
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


def _validate_prior_history(profile: dict[str, Any]) -> None:
    prior = _mapping(profile.get("prior_history", {})) or {}
    for field in (
        "habitual_terrain",
        "mountain_experience",
        "prior_modality_race_frequency",
    ):
        if field in prior and not isinstance(prior[field], str):
            raise ValueError("malformed_snapshot")


def _validate_training_preferences(profile: dict[str, Any]) -> None:
    preferences = _mapping(profile.get("training_preferences", {})) or {}
    if any(
        field in preferences and not isinstance(preferences[field], str)
        for field in _TRAINING_PREFERENCE_VALUES
    ):
        raise ValueError("malformed_snapshot")


def _validate_physical_status(profile: dict[str, Any]) -> None:
    physical_status = _mapping(profile.get("physical_status", {})) or {}
    status = physical_status.get("status")
    detail = physical_status.get("pain_or_limitation_detail")
    if status is not None and not isinstance(status, str):
        raise ValueError("malformed_snapshot")
    for field in (
        "has_pain_or_limitation",
        "pain_or_limitation_affects_running",
    ):
        if field in physical_status and not isinstance(physical_status[field], bool):
            raise ValueError("malformed_snapshot")
    if detail is not None and (
        not isinstance(detail, str) or len(detail.strip()) > 500
    ):
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
    profile.pop("restrictions", None)
    physical_status = _mapping(profile.get("physical_status"))
    if physical_status is not None:
        if physical_status.get("has_pain_or_limitation") is False:
            physical_status.pop("pain_or_limitation_affects_running", None)
            physical_status.pop("pain_or_limitation_detail", None)
        else:
            detail = physical_status.get("pain_or_limitation_detail")
            if isinstance(detail, str):
                normalized_detail = detail.strip()
                if normalized_detail:
                    physical_status["pain_or_limitation_detail"] = normalized_detail
                else:
                    physical_status.pop("pain_or_limitation_detail", None)
        profile["physical_status"] = physical_status
    baseline = _mapping(profile.get("baseline_4_weeks"))
    if baseline is not None:
        baseline.pop("training_hours", None)
        profile["baseline_4_weeks"] = baseline
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
    _add_training_preference_diagnostics(profile, diagnostics)
    _add_physical_status_diagnostics(profile, diagnostics)
    _add_prior_history_diagnostics(profile, diagnostics)
    _add_baseline_diagnostics(profile, diagnostics)
    _add_goal_diagnostics(goal, validation_date, diagnostics)
    return diagnostics


def _add_required_diagnostics(
    profile: JsonObject, goal: JsonObject, diagnostics: list[Diagnostic]
) -> None:
    required = (
        (
            profile.get("prior_history", {}),
            (
                "longest_completed_distance_km",
                "habitual_terrain",
                "mountain_experience",
                "prior_modality_race_frequency",
            ),
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
            profile.get("training_preferences", {}),
            tuple(_TRAINING_PREFERENCE_VALUES),
            "profile.training_preferences",
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


def _add_training_preference_diagnostics(
    profile: JsonObject, diagnostics: list[Diagnostic]
) -> None:
    preferences = profile.get("training_preferences", {})
    for field, allowed in _TRAINING_PREFERENCE_VALUES.items():
        value = preferences.get(field)
        if value is not None and value not in allowed:
            diagnostics.append(
                _diagnostic("out_of_range", f"profile.training_preferences.{field}")
            )


def _add_physical_status_diagnostics(
    profile: JsonObject, diagnostics: list[Diagnostic]
) -> None:
    physical_status = profile.get("physical_status", {})
    status = physical_status.get("status")
    if status is None:
        diagnostics.append(_diagnostic("required", "profile.physical_status.status"))
    elif status not in _PHYSICAL_STATUS_VALUES:
        diagnostics.append(
            _diagnostic("out_of_range", "profile.physical_status.status")
        )
    has_pain = physical_status.get("has_pain_or_limitation")
    if has_pain is None:
        diagnostics.append(
            _diagnostic("required", "profile.physical_status.has_pain_or_limitation")
        )
    elif has_pain and physical_status.get("pain_or_limitation_affects_running") is None:
        diagnostics.append(
            _diagnostic(
                "required",
                "profile.physical_status.pain_or_limitation_affects_running",
            )
        )


def _add_prior_history_diagnostics(
    profile: JsonObject, diagnostics: list[Diagnostic]
) -> None:
    prior = profile.get("prior_history", {})
    allowed = {
        "habitual_terrain": _HABITUAL_TERRAINS,
        "mountain_experience": _MOUNTAIN_EXPERIENCES,
        "prior_modality_race_frequency": _PRIOR_MODALITY_RACE_FREQUENCIES,
    }
    for field, values in allowed.items():
        value = prior.get(field)
        if value is not None and value not in values:
            diagnostics.append(
                _diagnostic("out_of_range", f"profile.prior_history.{field}")
            )


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
