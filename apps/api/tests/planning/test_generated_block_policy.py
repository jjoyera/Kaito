from dataclasses import FrozenInstanceError, replace
from datetime import date, timedelta

import pytest

from app.modules.planning import generated_block_policy as policy_module
from app.modules.planning.generated_block_policy import (
    ELEVATION_POLICY_OUTSIDE_MVP,
    GENERATED_BLOCK_SPORTS_POLICY,
    GeneratedBlockPolicyContext,
    GeneratedBlockPolicyWeekContext,
    validate_generated_block_policy,
)
from app.modules.planning.generation_contract import GeneratedTrainingBlock


def session(
    day: int,
    *,
    category: str = "run",
    duration: int = 20,
    segments: tuple[tuple[str, int], ...] | None = None,
    rpe_max: int = 3,
    key: bool = False,
    elevation: int = 0,
    prose: str = "Easy",
) -> dict:
    if segments is None:
        segments = (("low", duration),) if category == "run" else ()
    return {
        "scheduled_date": (date(2026, 8, 3) + timedelta(days=day)).isoformat(),
        "session_type": prose,
        "session_category": category,
        "planned_duration_minutes": duration,
        "planned_distance_kilometers": "1.00" if category == "run" else "0",
        "planned_elevation_meters": elevation,
        "intensity_description": prose,
        "intensity_segments": [
            {"intensity_band": band, "duration_minutes": minutes}
            for band, minutes in segments
        ],
        "target_rpe_min": min(3, rpe_max),
        "target_rpe_max": rpe_max,
        "is_key_session": key,
        "purpose": prose,
        "instructions": prose,
    }


def block(*weeks: list[dict]) -> GeneratedTrainingBlock:
    return GeneratedTrainingBlock.model_validate(
        {
            "applied_approach": "mode_z",
            "block_focus": "Deterministic policy",
            "weeks": [
                {
                    "week_number": index,
                    "week_goal": "Train",
                    "sessions": sessions,
                }
                for index, sessions in enumerate(weeks, start=1)
            ],
            "coach_advice": "Recover",
        }
    )


def context(
    *roles: str,
    status: str = "on_track",
    restrictions: tuple[str, ...] = (),
) -> GeneratedBlockPolicyContext:
    return GeneratedBlockPolicyContext(
        weeks=tuple(
            GeneratedBlockPolicyWeekContext(
                week_number=index,
                projection_phase=(
                    "recovery"
                    if role == "recovery"
                    else "taper"
                    if role == "taper"
                    else "loading"
                ),
                readiness_role=role,
            )
            for index, role in enumerate(roles, start=1)
        ),
        readiness_status=status,
        safety_restriction_codes=restrictions,
    )


def codes(result) -> tuple[str, ...]:
    return tuple(violation.code for violation in result.violations)


def test_runtime_policy_uses_the_public_provider_policy_source(monkeypatch):
    monkeypatch.setattr(
        policy_module,
        "GENERATED_BLOCK_SPORTS_POLICY",
        replace(GENERATED_BLOCK_SPORTS_POLICY, minimum_low_percent=76),
    )
    candidate = block(
        [
            session(
                0,
                duration=100,
                segments=(("low", 75), ("threshold", 15), ("high", 10)),
            ),
            session(1, category="strength"),
        ]
    )

    assert "intensity_low_share_below_minimum" in codes(
        validate_generated_block_policy(candidate, context("build"))
    )


@pytest.mark.parametrize(
    ("segments", "expected"),
    [
        ((("low", 75), ("threshold", 15), ("high", 10)), ()),
        (
            (("low", 74), ("threshold", 16), ("high", 10)),
            (
                "intensity_low_share_below_minimum",
                "intensity_threshold_and_high_share_above_maximum",
            ),
        ),
        ((("low", 89), ("high", 11)), ("intensity_high_share_above_maximum",)),
        (
            (("low", 74), ("threshold", 26)),
            (
                "intensity_low_share_below_minimum",
                "intensity_threshold_and_high_share_above_maximum",
            ),
        ),
        ((("low", 100),), ()),
    ],
)
def test_aggregates_exact_intensity_boundaries_across_the_whole_block(
    segments, expected
):
    split = len(segments) // 2
    first = segments[:split] or segments
    second = segments[split:] if split else ()
    weeks = [
        [
            session(0, duration=sum(m for _, m in first), segments=first),
            session(1, category="strength"),
        ]
    ]
    roles = ["build"]
    if second:
        weeks.append(
            [
                session(7, duration=sum(m for _, m in second), segments=second),
                session(8, category="strength"),
            ]
        )
        roles.append("peak")

    result = validate_generated_block_policy(block(*weeks), context(*roles))

    assert codes(result) == expected


def test_aggregates_three_week_mixed_intensity_at_exact_and_adjacent_boundaries():
    exact = block(
        [session(0, duration=25, segments=(("low", 25),))],
        [session(7, duration=25, segments=(("low", 25),))],
        [
            session(
                14,
                duration=50,
                segments=(("low", 25), ("threshold", 15), ("high", 10)),
            )
        ],
    )
    adjacent = block(
        [session(0, duration=25, segments=(("low", 25),))],
        [session(7, duration=25, segments=(("low", 25),))],
        [
            session(
                14,
                duration=50,
                segments=(("low", 24), ("threshold", 15), ("high", 11)),
            )
        ],
    )
    policy_context = context(
        "build",
        "peak",
        "taper",
        restrictions=("favor_recovery_rest_or_gentle_activity",),
    )

    exact_result = validate_generated_block_policy(exact, policy_context)
    adjacent_result = validate_generated_block_policy(adjacent, policy_context)

    assert codes(exact_result) == ()
    assert codes(adjacent_result) == (
        "intensity_low_share_below_minimum",
        "intensity_high_share_above_maximum",
        "intensity_threshold_and_high_share_above_maximum",
    )


@pytest.mark.parametrize("week_count", [1, 2, 3])
def test_accepts_all_low_intensity_for_short_blocks(week_count):
    result = validate_generated_block_policy(
        block(*[[session(index * 7)] for index in range(week_count)]),
        context(*(["build"] * week_count)),
    )

    assert codes(result) == tuple(
        "strength_session_frequency_below_minimum" for _ in range(week_count)
    )


@pytest.mark.parametrize(
    ("role", "restrictions", "strength", "expected"),
    [
        ("build", (), [session(1, category="strength", duration=20)], ()),
        ("peak", (), [], ("strength_session_frequency_below_minimum",)),
        (
            "build",
            (),
            [session(1, category="strength", duration=19)],
            (
                "strength_session_duration_below_minimum",
                "strength_session_frequency_below_minimum",
            ),
        ),
        (
            "build",
            (),
            [session(1, category="strength"), session(2, category="strength")],
            ("strength_session_frequency_above_maximum",),
        ),
        ("recovery", (), [], ()),
        ("taper", (), [session(1, category="strength")], ()),
        (
            "taper",
            (),
            [session(1, category="strength"), session(2, category="strength")],
            ("strength_session_frequency_above_maximum",),
        ),
        ("build", ("no_demanding_sessions",), [], ()),
        ("build", ("favor_recovery_rest_or_gentle_activity",), [], ()),
    ],
)
def test_enforces_strength_duration_and_role_specific_frequency(
    role, restrictions, strength, expected
):
    result = validate_generated_block_policy(
        block([session(0), *strength]), context(role, restrictions=restrictions)
    )

    assert codes(result) == expected


@pytest.mark.parametrize(
    "restriction",
    [
        "no_demanding_sessions",
        "favor_recovery_rest_or_gentle_activity",
    ],
)
def test_strength_maximum_remains_when_restriction_removes_minimum(restriction):
    result = validate_generated_block_policy(
        block(
            [
                session(0),
                session(1, category="strength"),
                session(2, category="strength"),
            ]
        ),
        context("build", restrictions=(restriction,)),
    )

    assert codes(result) == ("strength_session_frequency_above_maximum",)


def test_strength_policy_does_not_duplicate_daily_availability_limits():
    result = validate_generated_block_policy(
        block([session(0), session(0, category="strength", duration=20)]),
        context("build"),
    )

    assert codes(result) == ()


@pytest.mark.parametrize(
    "demanding",
    [
        session(0, duration=20, segments=(("low", 19), ("high", 1))),
        session(0, duration=20, segments=(("low", 19), ("threshold", 1)), key=True),
        session(0, rpe_max=8),
        session(0, rpe_max=7, key=True),
    ],
)
def test_each_structured_demanding_signal_is_forbidden_in_recovery(demanding):
    result = validate_generated_block_policy(
        block([demanding]), context("recovery")
    )

    assert "demanding_session_forbidden_in_recovery_week" in codes(result)


@pytest.mark.parametrize(
    ("status", "restrictions", "expected_code"),
    [
        ("not_feasible", (), "demanding_session_forbidden_by_readiness"),
        (
            "on_track",
            ("no_demanding_sessions",),
            "demanding_session_forbidden_by_restriction",
        ),
    ],
)
def test_forbids_demanding_sessions_from_readiness_or_restrictions(
    status, restrictions, expected_code
):
    result = validate_generated_block_policy(
        block([session(0, rpe_max=8)]),
        context("taper", status=status, restrictions=restrictions),
    )

    assert expected_code in codes(result)


@pytest.mark.parametrize(
    ("candidate", "expected"),
    [
        (session(0, duration=20, segments=(("low", 19), ("high", 1))), True),
        (session(0, key=True), True),
        (session(0, rpe_max=8), True),
        (
            session(
                0,
                duration=20,
                segments=(("low", 19), ("threshold", 1)),
                rpe_max=7,
            ),
            False,
        ),
    ],
)
def test_reduced_demanding_rule_uses_the_stricter_structured_definition(
    candidate, expected
):
    result = validate_generated_block_policy(
        block([candidate]),
        context(
            "build",
            restrictions=(
                "reduce_demanding_session_intensity_or_duration",
                "no_demanding_sessions",
            ),
        ),
    )

    assert ("demanding_session_exceeds_reduced_limit" in codes(result)) is expected


def test_taper_allows_only_one_demanding_session_across_taper_weeks():
    result = validate_generated_block_policy(
        block(
            [session(0, rpe_max=8)],
            [session(7, rpe_max=7, key=True), session(8, rpe_max=8)],
        ),
        context("taper", "taper"),
    )

    assert codes(result).count("taper_demanding_session_limit_exceeded") == 2
    taper_violations = [
        violation
        for violation in result.violations
        if violation.code == "taper_demanding_session_limit_exceeded"
    ]
    assert [
        (item.week_number, item.session_index) for item in taper_violations
    ] == [(2, 0), (2, 1)]


def test_policy_ignores_all_prose_when_classifying_demanding_sessions():
    alarming = session(0, prose="MAX HIGH THRESHOLD KEY SESSION")
    neutral = session(0, prose="gentle recovery")

    alarming_result = validate_generated_block_policy(
        block([alarming]), context("recovery")
    )
    neutral_result = validate_generated_block_policy(
        block([neutral]), context("recovery")
    )

    assert codes(alarming_result) == ()
    assert codes(neutral_result) == ()


@pytest.mark.parametrize("elevation", [0, 1, 5000])
def test_elevation_is_always_outside_mvp_safety_guarantees(elevation):
    result = validate_generated_block_policy(
        block([session(0, elevation=elevation)]), context("recovery")
    )

    assert result.metadata.elevation_policy == ELEVATION_POLICY_OUTSIDE_MVP
    assert "elevation" not in " ".join(codes(result))


@pytest.mark.parametrize(
    ("candidate", "policy_context", "expected"),
    [
        (
            block([session(0)], [session(7)]),
            context("build"),
            ("policy_context_week_count_mismatch",),
        ),
        (
            block([session(0)]),
            context("build", "peak"),
            ("policy_context_week_count_mismatch",),
        ),
        (
            block([session(0)], [session(7)]),
            GeneratedBlockPolicyContext(
                weeks=(
                    GeneratedBlockPolicyWeekContext(1, "loading", "build"),
                    GeneratedBlockPolicyWeekContext(1, "loading", "peak"),
                ),
                readiness_status="on_track",
                safety_restriction_codes=(),
            ),
            (
                "policy_context_duplicate_week_number",
                "policy_context_week_number_mismatch",
            ),
        ),
        (
            block([session(0)], [session(7)]),
            GeneratedBlockPolicyContext(
                weeks=(
                    GeneratedBlockPolicyWeekContext(2, "loading", "build"),
                    GeneratedBlockPolicyWeekContext(1, "loading", "peak"),
                ),
                readiness_status="on_track",
                safety_restriction_codes=(),
            ),
            (
                "policy_context_out_of_order_weeks",
                "policy_context_week_number_mismatch",
                "policy_context_week_number_mismatch",
            ),
        ),
        (
            block([session(0)], [session(7)]),
            GeneratedBlockPolicyContext(
                weeks=(
                    GeneratedBlockPolicyWeekContext(1, "loading", "build"),
                    GeneratedBlockPolicyWeekContext(3, "loading", "peak"),
                ),
                readiness_status="on_track",
                safety_restriction_codes=(),
            ),
            ("policy_context_week_number_mismatch",),
        ),
    ],
)
def test_fails_closed_for_incoherent_policy_week_context(
    candidate, policy_context, expected
):
    result = validate_generated_block_policy(candidate, policy_context)

    assert codes(result) == expected


def test_multiple_violations_and_repeated_results_have_canonical_order():
    candidate = block(
        [
            session(
                0,
                duration=100,
                segments=(("low", 60), ("threshold", 20), ("high", 20)),
                rpe_max=8,
            ),
            session(1, category="strength", duration=19),
        ],
        [session(7, rpe_max=8)],
    )
    policy_context = context(
        "build",
        "recovery",
        status="not_feasible",
        restrictions=("reduce_demanding_session_intensity_or_duration",),
    )

    first = validate_generated_block_policy(candidate, policy_context)
    second = validate_generated_block_policy(candidate, policy_context)

    assert first == second
    assert codes(first) == (
        "intensity_low_share_below_minimum",
        "intensity_high_share_above_maximum",
        "intensity_threshold_and_high_share_above_maximum",
        "strength_session_duration_below_minimum",
        "strength_session_frequency_below_minimum",
        "demanding_session_forbidden_by_readiness",
        "demanding_session_exceeds_reduced_limit",
        "demanding_session_forbidden_in_recovery_week",
        "demanding_session_forbidden_by_readiness",
        "demanding_session_exceeds_reduced_limit",
    )
    with pytest.raises(FrozenInstanceError):
        first.metadata.elevation_policy = "safe"  # type: ignore[misc]
