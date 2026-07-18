from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any, Literal

Approach = Literal["kaio_path", "mode_z", "kaioken"]


@dataclass(frozen=True, slots=True)
class TrainingPlanDraft:
    plan_id: str
    status: Literal["draft"]
    plan_approach: Approach


class UnsupportedEligibilityModality(ValueError):
    def __init__(self) -> None:
        super().__init__("unsupported_modality")


@dataclass(frozen=True, slots=True)
class ApproachEligibility:
    approach: Approach
    available: bool
    blocking_reason_codes: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class ApproachAssessment:
    approaches: tuple[ApproachEligibility, ...]
    recommended_approach: Literal["kaio_path", "mode_z"]
    safety_restriction_codes: tuple[str, ...]


_DISTANCE_BRACKETS = (
    (Decimal("15"), 4, 6),
    (Decimal("30"), 6, 8),
    (Decimal("50"), 8, 10),
    (Decimal("80"), 10, 12),
    (Decimal("Infinity"), 12, 16),
)


class ApproachEligibilityPolicy:
    """Pure, deterministic policy for the permitted training intensity."""

    def assess(
        self, snapshot: Mapping[str, Any], assessment_date: date
    ) -> ApproachAssessment:
        profile = snapshot["profile"]
        goal = snapshot["goal"]
        modality = goal["modality"]
        if modality not in {"trail", "ultra_trail"}:
            raise UnsupportedEligibilityModality()

        prior = profile["prior_history"]
        baseline = profile["baseline_4_weeks"]
        availability = profile["availability"]["minutes_by_day"]
        physical = profile["physical_status"]
        target_distance = Decimal(str(goal["target_distance_km"]))
        days_to_goal = (date.fromisoformat(goal["target_date"]) - assessment_date).days
        mode_z_weeks, kaioken_weeks = _minimum_weeks(target_distance)

        weekly_sessions = Decimal(str(baseline["sessions"])) / 4
        volume_ratio = (
            Decimal(str(baseline["distance_km"])) / 4 / target_distance
        )
        experience_ratio = (
            Decimal(str(prior["longest_completed_distance_km"])) / target_distance
        )
        long_run_ratio = (
            Decimal(str(baseline["longest_outing_km"])) / target_distance
        )
        available_days = len(availability)
        available_minutes = sum(availability.values())
        status = physical["status"]
        has_pain = physical["has_pain_or_limitation"]
        pain_affects_running = has_pain and physical.get(
            "pain_or_limitation_affects_running", False
        )

        mode_z_reasons = _mode_z_reasons(
            status=status,
            pain_affects_running=pain_affects_running,
            weekly_sessions=weekly_sessions,
            consistency=baseline["recent_consistency"],
            experience_ratio=experience_ratio,
            long_run_ratio=long_run_ratio,
            available_days=available_days,
            days_to_goal=days_to_goal,
            minimum_days=mode_z_weeks * 7,
        )
        kaioken_reasons = _kaioken_reasons(
            status=status,
            has_pain=has_pain,
            weekly_sessions=weekly_sessions,
            consistency=baseline["recent_consistency"],
            volume_ratio=volume_ratio,
            experience_ratio=experience_ratio,
            long_run_ratio=long_run_ratio,
            race_frequency=prior["prior_modality_race_frequency"],
            mountain_experience=prior["mountain_experience"],
            available_days=available_days,
            available_minutes=available_minutes,
            days_to_goal=days_to_goal,
            minimum_days=kaioken_weeks * 7,
        )
        restrictions = _safety_restrictions(
            status, has_pain, pain_affects_running
        )
        approaches = (
            ApproachEligibility("kaio_path", True, ()),
            ApproachEligibility("mode_z", not mode_z_reasons, mode_z_reasons),
            ApproachEligibility("kaioken", not kaioken_reasons, kaioken_reasons),
        )
        return ApproachAssessment(
            approaches=approaches,
            recommended_approach="mode_z" if not mode_z_reasons else "kaio_path",
            safety_restriction_codes=restrictions,
        )


def _minimum_weeks(distance: Decimal) -> tuple[int, int]:
    return next(
        (mode_z, kaioken)
        for limit, mode_z, kaioken in _DISTANCE_BRACKETS
        if distance <= limit
    )


def _mode_z_reasons(**values: Any) -> tuple[str, ...]:
    reasons: list[str] = []
    if values["status"] == "recovering":
        reasons.append("recovering")
    if values["pain_affects_running"]:
        reasons.append("pain_affects_running")
    if values["weekly_sessions"] < 3:
        reasons.append("insufficient_weekly_sessions")
    if values["consistency"] not in {"fairly_consistent", "very_consistent"}:
        reasons.append("insufficient_recent_consistency")
    if values["experience_ratio"] < Decimal("0.75"):
        reasons.append("insufficient_experience_ratio")
    if values["long_run_ratio"] < Decimal("0.25"):
        reasons.append("insufficient_long_run_ratio")
    if values["available_days"] < 3:
        reasons.append("insufficient_available_days")
    if values["days_to_goal"] < values["minimum_days"]:
        reasons.append("insufficient_time_to_goal")
    return tuple(reasons)


def _kaioken_reasons(**values: Any) -> tuple[str, ...]:
    reasons: list[str] = []
    if values["status"] != "feeling_good":
        reasons.append("physical_status_not_feeling_good")
    if values["has_pain"]:
        reasons.append("pain_or_limitation_present")
    if values["weekly_sessions"] < 3:
        reasons.append("insufficient_weekly_sessions")
    if values["consistency"] != "very_consistent":
        reasons.append("insufficient_recent_consistency")
    if values["volume_ratio"] < Decimal("0.60"):
        reasons.append("insufficient_volume_ratio")
    if values["experience_ratio"] < Decimal("1.00"):
        reasons.append("insufficient_experience_ratio")
    if values["long_run_ratio"] < Decimal("0.35"):
        reasons.append("insufficient_long_run_ratio")
    if values["race_frequency"] != "multiple":
        reasons.append("insufficient_prior_modality_races")
    if values["mountain_experience"] not in {"medium", "high"}:
        reasons.append("insufficient_mountain_experience")
    if values["available_days"] < 4:
        reasons.append("insufficient_available_days")
    if values["available_minutes"] < 300:
        reasons.append("insufficient_available_minutes")
    if values["days_to_goal"] < values["minimum_days"]:
        reasons.append("insufficient_time_to_goal")
    return tuple(reasons)


def _safety_restrictions(
    status: str, has_pain: bool, pain_affects_running: bool
) -> tuple[str, ...]:
    if status == "recovering":
        return (
            "no_load_increase",
            "no_demanding_sessions",
            "favor_recovery_rest_or_gentle_activity",
        )
    if pain_affects_running:
        return ("no_compensation", "no_load_increase", "no_demanding_sessions")
    restrictions: list[str] = []
    if has_pain:
        restrictions.extend(("no_compensation", "no_load_increase"))
    if status == "carrying_fatigue":
        restrictions.extend(
            (
                "no_weekly_load_increase",
                "reduce_demanding_session_intensity_or_duration",
            )
        )
    return tuple(restrictions)
