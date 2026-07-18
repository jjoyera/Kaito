from copy import deepcopy
from datetime import date

import pytest

from app.modules.planning.domain import (
    ApproachEligibilityPolicy,
    UnsupportedEligibilityModality,
)


def eligible_snapshot(
    *, distance: float = 50.0, target_date: str = "2026-10-10"
) -> dict:
    return {
        "contract_version": "1",
        "state": "completed",
        "profile": {
            "prior_history": {
                "longest_completed_distance_km": distance,
                "habitual_terrain": "mixed",
                "mountain_experience": "high",
                "prior_modality_race_frequency": "multiple",
            },
            "baseline_4_weeks": {
                "sessions": 12,
                "distance_km": distance * 2.4,
                "positive_elevation_m": 2000,
                "longest_outing_km": distance * 0.35,
                "recent_consistency": "very_consistent",
            },
            "availability": {
                "minutes_by_day": {
                    "monday": 75,
                    "tuesday": 75,
                    "thursday": 75,
                    "saturday": 75,
                }
            },
            "training_preferences": {
                "mountain_trail_access": "easy_access",
                "gym_access": "yes",
                "planning_preference": "fixed_routine",
            },
            "physical_status": {
                "status": "feeling_good",
                "has_pain_or_limitation": False,
            },
        },
        "goal": {
            "modality": "trail",
            "target_date": target_date,
            "target_distance_km": distance,
            "positive_elevation_m": 2000,
        },
    }


def assess(snapshot: dict, assessment_date: date = date(2026, 7, 1)):
    return ApproachEligibilityPolicy().assess(snapshot, assessment_date)


def entry(result, approach: str):
    return next(item for item in result.approaches if item.approach == approach)


def test_returns_all_approaches_in_intensity_order_and_never_recommends_kaioken():
    result = assess(eligible_snapshot())

    assert [item.approach for item in result.approaches] == [
        "kaio_path",
        "mode_z",
        "kaioken",
    ]
    assert all(item.available for item in result.approaches)
    assert result.recommended_approach == "mode_z"


@pytest.mark.parametrize(
    ("field", "passing", "failing", "reason"),
    [
        ("sessions", 12, 11, "insufficient_weekly_sessions"),
        ("longest_outing_km", 12.5, 12.49, "insufficient_long_run_ratio"),
    ],
)
def test_mode_z_exact_thresholds_and_just_below(field, passing, failing, reason):
    snapshot = eligible_snapshot()
    snapshot["profile"]["baseline_4_weeks"][field] = passing
    assert entry(assess(snapshot), "mode_z").available

    snapshot["profile"]["baseline_4_weeks"][field] = failing
    assert reason in entry(assess(snapshot), "mode_z").blocking_reason_codes


def test_ratio_thresholds_are_decimal_exact_and_reject_just_below():
    snapshot = eligible_snapshot(distance=42.2)
    snapshot["profile"]["prior_history"]["longest_completed_distance_km"] = 31.65
    snapshot["profile"]["baseline_4_weeks"]["longest_outing_km"] = 10.55
    assert entry(assess(snapshot), "mode_z").available

    snapshot["profile"]["prior_history"]["longest_completed_distance_km"] = 31.649
    snapshot["profile"]["baseline_4_weeks"]["longest_outing_km"] = 10.549
    reasons = entry(assess(snapshot), "mode_z").blocking_reason_codes
    assert "insufficient_experience_ratio" in reasons
    assert "insufficient_long_run_ratio" in reasons

    snapshot = eligible_snapshot(distance=42.2)
    snapshot["profile"]["baseline_4_weeks"]["distance_km"] = 101.28
    snapshot["profile"]["baseline_4_weeks"]["longest_outing_km"] = 14.77
    assert entry(assess(snapshot), "kaioken").available
    snapshot["profile"]["baseline_4_weeks"]["distance_km"] = 101.279
    snapshot["profile"]["baseline_4_weeks"]["longest_outing_km"] = 14.769
    reasons = entry(assess(snapshot), "kaioken").blocking_reason_codes
    assert "insufficient_volume_ratio" in reasons
    assert "insufficient_long_run_ratio" in reasons


def test_continuous_decimal_distance_brackets_and_whole_day_date_boundary():
    brackets = [(15, 4), (15.1, 6), (30, 6), (30.1, 8), (50.1, 10), (80.1, 12)]
    for distance, weeks in brackets:
        snapshot = eligible_snapshot(distance=distance)
        snapshot["goal"]["target_date"] = date(2026, 7, 1).fromordinal(
            date(2026, 7, 1).toordinal() + weeks * 7
        ).isoformat()
        assert entry(assess(snapshot), "mode_z").available
        snapshot["goal"]["target_date"] = date.fromordinal(
            date(2026, 7, 1).toordinal() + weeks * 7 - 1
        ).isoformat()
        assert "insufficient_time_to_goal" in entry(
            assess(snapshot), "mode_z"
        ).blocking_reason_codes


def test_kaioken_exact_numeric_thresholds_pass_and_just_below_values_fail():
    cases = [
        ("sessions", 12, 11, "insufficient_weekly_sessions"),
        ("distance_km", 120, 119.9, "insufficient_volume_ratio"),
        ("longest_outing_km", 17.5, 17.49, "insufficient_long_run_ratio"),
    ]
    for field, passing, failing, reason in cases:
        snapshot = eligible_snapshot()
        snapshot["profile"]["baseline_4_weeks"][field] = passing
        assert entry(assess(snapshot), "kaioken").available
        snapshot["profile"]["baseline_4_weeks"][field] = failing
        assert reason in entry(assess(snapshot), "kaioken").blocking_reason_codes

    snapshot = eligible_snapshot()
    snapshot["profile"]["prior_history"]["longest_completed_distance_km"] = 50
    assert entry(assess(snapshot), "kaioken").available
    snapshot["profile"]["prior_history"]["longest_completed_distance_km"] = 49.99
    assert "insufficient_experience_ratio" in entry(
        assess(snapshot), "kaioken"
    ).blocking_reason_codes

    snapshot = eligible_snapshot(target_date="2026-09-09")
    assert entry(assess(snapshot), "kaioken").available
    snapshot["goal"]["target_date"] = "2026-09-08"
    assert "insufficient_time_to_goal" in entry(
        assess(snapshot), "kaioken"
    ).blocking_reason_codes

    snapshot = eligible_snapshot()
    snapshot["profile"]["availability"]["minutes_by_day"] = {
        "monday": 75,
        "tuesday": 75,
        "thursday": 75,
        "saturday": 75,
    }
    assert entry(assess(snapshot), "kaioken").available
    snapshot["profile"]["availability"]["minutes_by_day"] = {
        "monday": 99,
        "tuesday": 100,
        "saturday": 100,
    }
    reasons = entry(assess(snapshot), "kaioken").blocking_reason_codes
    assert "insufficient_available_days" in reasons
    assert "insufficient_available_minutes" in reasons


def test_kaioken_categorical_requirements_each_block_independently():
    changes = [
        (
            ("physical_status", "status"),
            "carrying_fatigue",
            "physical_status_not_feeling_good",
        ),
        (
            ("baseline_4_weeks", "recent_consistency"),
            "fairly_consistent",
            "insufficient_recent_consistency",
        ),
        (
            ("prior_history", "prior_modality_race_frequency"),
            "once",
            "insufficient_prior_modality_races",
        ),
        (
            ("prior_history", "mountain_experience"),
            "low",
            "insufficient_mountain_experience",
        ),
    ]
    for (block, field), value, reason in changes:
        snapshot = eligible_snapshot()
        snapshot["profile"][block][field] = value
        assert reason in entry(assess(snapshot), "kaioken").blocking_reason_codes


def test_recovering_security_precedence_allows_only_kaio_with_recovery_restrictions():
    snapshot = eligible_snapshot()
    snapshot["profile"]["physical_status"].update(
        {
            "status": "recovering",
            "has_pain_or_limitation": True,
            "pain_or_limitation_affects_running": True,
        }
    )
    result = assess(snapshot)

    assert [item.available for item in result.approaches] == [True, False, False]
    assert result.recommended_approach == "kaio_path"
    assert result.safety_restriction_codes == (
        "no_load_increase",
        "no_demanding_sessions",
        "favor_recovery_rest_or_gentle_activity",
    )


def test_pain_affecting_running_allows_only_kaio_and_clearly_restricts_compensation():
    snapshot = eligible_snapshot()
    snapshot["profile"]["physical_status"].update(
        {"has_pain_or_limitation": True, "pain_or_limitation_affects_running": True}
    )
    result = assess(snapshot)

    assert [item.available for item in result.approaches] == [True, False, False]
    assert "pain_affects_running" in entry(result, "mode_z").blocking_reason_codes
    assert result.safety_restriction_codes == (
        "no_compensation",
        "no_load_increase",
        "no_demanding_sessions",
    )


def test_non_affecting_pain_and_fatigue_block_kaioken_but_not_mode_z():
    pain = eligible_snapshot()
    pain["profile"]["physical_status"].update(
        {"has_pain_or_limitation": True, "pain_or_limitation_affects_running": False}
    )
    pain_result = assess(pain)
    assert entry(pain_result, "mode_z").available
    assert not entry(pain_result, "kaioken").available
    assert pain_result.safety_restriction_codes == (
        "no_compensation",
        "no_load_increase",
    )

    fatigue = eligible_snapshot()
    fatigue["profile"]["physical_status"]["status"] = "carrying_fatigue"
    fatigue_result = assess(fatigue)
    assert entry(fatigue_result, "mode_z").available
    assert not entry(fatigue_result, "kaioken").available
    assert fatigue_result.safety_restriction_codes == (
        "no_weekly_load_increase",
        "reduce_demanding_session_intensity_or_duration",
    )


def test_reports_multiple_simultaneous_blocking_reasons_stably():
    snapshot = eligible_snapshot(target_date="2026-07-10")
    snapshot["profile"]["baseline_4_weeks"].update(
        {
            "sessions": 4,
            "distance_km": 119.9,
            "recent_consistency": "irregular",
            "longest_outing_km": 1,
        }
    )
    snapshot["profile"]["prior_history"].update(
        {"longest_completed_distance_km": 1, "prior_modality_race_frequency": "never"}
    )
    reasons = entry(assess(snapshot), "kaioken").blocking_reason_codes

    assert reasons[:3] == (
        "insufficient_weekly_sessions",
        "insufficient_recent_consistency",
        "insufficient_volume_ratio",
    )
    assert "insufficient_time_to_goal" in reasons
    assert len(reasons) > 5


@pytest.mark.parametrize("modality", ["ocr", "backyard"])
def test_rejects_dormant_unsupported_modalities_at_eligibility_boundary(modality):
    snapshot = eligible_snapshot()
    snapshot["goal"]["modality"] = modality
    with pytest.raises(UnsupportedEligibilityModality, match="unsupported_modality"):
        assess(snapshot)


def test_habitual_terrain_and_elevation_do_not_change_eligibility():
    baseline = eligible_snapshot()
    changed = deepcopy(baseline)
    changed["profile"]["prior_history"]["habitual_terrain"] = "road"
    changed["profile"]["baseline_4_weeks"]["positive_elevation_m"] = 0
    changed["goal"]["positive_elevation_m"] = 9000
    assert assess(changed) == assess(baseline)
