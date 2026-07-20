from copy import deepcopy
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.modules.planning.generation_contract import GeneratedTrainingBlock


def valid_block() -> dict:
    return {
        "applied_approach": "mode_z",
        "block_focus": "Build sustainable climbing strength",
        "weeks": [
            {
                "week_number": 1,
                "week_goal": "Establish consistent aerobic volume",
                "sessions": [
                    {
                        "scheduled_date": "2026-07-06",
                        "session_type": "Easy trail run",
                        "session_category": "run",
                        "planned_duration_minutes": 50,
                        "planned_distance_kilometers": "7.50",
                        "planned_elevation_meters": 180,
                        "intensity_description": "Conversational aerobic effort",
                        "intensity_segments": [
                            {"duration_minutes": 50, "intensity_band": "low"}
                        ],
                        "target_rpe_min": 3,
                        "target_rpe_max": 4,
                        "is_key_session": False,
                        "purpose": "Develop aerobic durability",
                        "instructions": "Keep the effort relaxed on every climb.",
                    },
                    {
                        "scheduled_date": "2026-07-09",
                        "session_type": "Hill repetitions",
                        "session_category": "run",
                        "planned_duration_minutes": 65,
                        "planned_distance_kilometers": "8.25",
                        "planned_elevation_meters": 420,
                        "intensity_description": "Controlled hard uphill efforts",
                        "intensity_segments": [
                            {"duration_minutes": 15, "intensity_band": "low"},
                            {"duration_minutes": 30, "intensity_band": "high"},
                            {"duration_minutes": 10, "intensity_band": "low"},
                            {"duration_minutes": 10, "intensity_band": "low"},
                        ],
                        "target_rpe_min": 7,
                        "target_rpe_max": 9,
                        "is_key_session": True,
                        "purpose": "Improve uphill running economy",
                        "instructions": "Run six climbs with full easy recoveries.",
                    },
                ],
            }
        ],
        "coach_advice": "Prioritize sleep and reduce effort if fatigue accumulates.",
    }


def test_json_schema_explicitly_documents_cross_field_generation_rules():
    schema = GeneratedTrainingBlock.model_json_schema(mode="validation")
    session_schema = schema["$defs"]["GeneratedTrainingSession"]
    description = " ".join(session_schema["description"].split())
    distance_schema = session_schema["properties"]["planned_distance_kilometers"]

    assert "target_rpe_min <= target_rpe_max" in description
    assert "Run sessions require at least one intensity segment" in description
    assert "exactly equal planned_duration_minutes" in description
    assert "Non-run sessions require intensity_segments to be empty" in description
    assert "base-10 decimal string" in distance_schema["description"]
    assert "floats and booleans are forbidden" in distance_schema["description"]
    assert distance_schema["type"] == "string"


def test_accepts_and_serializes_a_realistic_provider_neutral_block():
    block = GeneratedTrainingBlock.model_validate(valid_block())

    assert block.applied_approach == "mode_z"
    assert block.weeks[0].sessions[0].planned_distance_kilometers == Decimal(
        "7.50"
    )
    payload = block.model_dump(mode="json")
    assert payload["weeks"][0]["sessions"][0][
        "planned_distance_kilometers"
    ] == "7.50"
    assert "full_horizon_estimated_kilometers" not in payload


@pytest.mark.parametrize("week_count", [1, 4])
def test_accepts_block_week_count_boundaries(week_count):
    payload = valid_block()
    payload["weeks"] = [
        {**deepcopy(payload["weeks"][0]), "week_number": number}
        for number in range(1, week_count + 1)
    ]

    assert len(GeneratedTrainingBlock.model_validate(payload).weeks) == week_count


@pytest.mark.parametrize("week_count", [0, 5])
def test_rejects_block_outside_one_to_four_weeks(week_count):
    payload = valid_block()
    payload["weeks"] = [deepcopy(payload["weeks"][0]) for _ in range(week_count)]

    with pytest.raises(ValidationError):
        GeneratedTrainingBlock.model_validate(payload)


@pytest.mark.parametrize(
    "path",
    [
        ("block_focus",),
        ("coach_advice",),
        ("weeks", 0, "week_goal"),
        ("weeks", 0, "sessions", 0, "session_type"),
        ("weeks", 0, "sessions", 0, "intensity_description"),
        ("weeks", 0, "sessions", 0, "purpose"),
        ("weeks", 0, "sessions", 0, "instructions"),
    ],
)
def test_rejects_whitespace_only_explanatory_and_type_fields(path):
    payload = valid_block()
    target = payload
    for key in path[:-1]:
        target = target[key]
    target[path[-1]] = "  \n\t "

    with pytest.raises(ValidationError):
        GeneratedTrainingBlock.model_validate(payload)


def test_normalizes_surrounding_whitespace_in_text_fields():
    payload = valid_block()
    payload["block_focus"] = "  Aerobic durability  "
    payload["weeks"][0]["sessions"][0]["purpose"] = "  Build endurance  "

    block = GeneratedTrainingBlock.model_validate(payload)

    assert block.block_focus == "Aerobic durability"
    assert block.weeks[0].sessions[0].purpose == "Build endurance"


@pytest.mark.parametrize("duration", [0, -1])
def test_rejects_non_positive_duration(duration):
    payload = valid_block()
    payload["weeks"][0]["sessions"][0]["planned_duration_minutes"] = duration

    with pytest.raises(ValidationError):
        GeneratedTrainingBlock.model_validate(payload)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("planned_distance_kilometers", "-0.01"),
        ("planned_elevation_meters", -1),
    ],
)
def test_rejects_negative_distance_and_elevation(field, value):
    payload = valid_block()
    payload["weeks"][0]["sessions"][0][field] = value

    with pytest.raises(ValidationError):
        GeneratedTrainingBlock.model_validate(payload)


def test_allows_zero_distance_and_elevation_for_non_running_sessions():
    payload = valid_block()
    session = payload["weeks"][0]["sessions"][0]
    session["session_category"] = "strength"
    session["planned_distance_kilometers"] = "0"
    session["planned_elevation_meters"] = 0
    session["intensity_segments"] = []

    GeneratedTrainingBlock.model_validate(payload)


@pytest.mark.parametrize(
    ("path", "value"),
    [
        (("weeks", 0, "sessions", 0, "scheduled_date"), "not-a-date"),
        (("weeks", 0, "sessions", 0, "is_key_session"), "false"),
        (("weeks", 0, "sessions", 0, "planned_duration_minutes"), 45.5),
        (("weeks", 0, "sessions", 0, "planned_distance_kilometers"), 7.5),
        (("weeks", 0, "sessions", 0, "planned_elevation_meters"), 10.5),
        (("weeks", 0, "week_number"), True),
    ],
)
def test_rejects_invalid_dates_booleans_and_numeric_types(path, value):
    payload = valid_block()
    target = payload
    for key in path[:-1]:
        target = target[key]
    target[path[-1]] = value

    with pytest.raises(ValidationError):
        GeneratedTrainingBlock.model_validate(payload)


@pytest.mark.parametrize("week_number", [0, -1])
def test_rejects_non_positive_week_numbers(week_number):
    payload = valid_block()
    payload["weeks"][0]["week_number"] = week_number

    with pytest.raises(ValidationError):
        GeneratedTrainingBlock.model_validate(payload)


@pytest.mark.parametrize("approach", ["kaio_path", "mode_z", "kaioken"])
def test_accepts_only_canonical_applied_approaches(approach):
    payload = valid_block()
    payload["applied_approach"] = approach

    assert GeneratedTrainingBlock.model_validate(payload).applied_approach == approach


def test_rejects_unknown_applied_approach():
    payload = valid_block()
    payload["applied_approach"] = "threshold_plan"

    with pytest.raises(ValidationError):
        GeneratedTrainingBlock.model_validate(payload)


@pytest.mark.parametrize(
    "path",
    [
        (),
        ("weeks", 0),
        ("weeks", 0, "sessions", 0),
    ],
)
def test_forbids_unknown_fields_at_every_contract_level(path):
    payload = valid_block()
    target = payload
    for key in path:
        target = target[key]
    target["unexpected"] = "not allowed"

    with pytest.raises(ValidationError):
        GeneratedTrainingBlock.model_validate(payload)


def test_forbids_model_provided_full_horizon_estimate():
    payload = valid_block()
    payload["full_horizon_estimated_kilometers"] = "350.00"

    with pytest.raises(ValidationError):
        GeneratedTrainingBlock.model_validate(payload)


@pytest.mark.parametrize(
    "category", ["run", "strength", "recovery", "cross_training"]
)
def test_accepts_every_canonical_session_category(category):
    payload = valid_block()
    session = payload["weeks"][0]["sessions"][0]
    session["session_category"] = category
    if category != "run":
        session["intensity_segments"] = []

    block = GeneratedTrainingBlock.model_validate(payload)

    assert block.weeks[0].sessions[0].session_category == category


@pytest.mark.parametrize(
    "category", ["running", "cross-training", "rest", "RUN", ""]
)
def test_rejects_non_canonical_session_categories(category):
    payload = valid_block()
    payload["weeks"][0]["sessions"][0]["session_category"] = category

    with pytest.raises(ValidationError):
        GeneratedTrainingBlock.model_validate(payload)


def test_accepts_mixed_run_segments_that_sum_to_planned_duration():
    block = GeneratedTrainingBlock.model_validate(valid_block())

    segments = block.weeks[0].sessions[1].intensity_segments
    assert [segment.intensity_band for segment in segments] == [
        "low",
        "high",
        "low",
        "low",
    ]
    assert sum(segment.duration_minutes for segment in segments) == 65


@pytest.mark.parametrize("segments", [None, []])
def test_rejects_missing_or_empty_run_segments(segments):
    payload = valid_block()
    session = payload["weeks"][0]["sessions"][0]
    if segments is None:
        session.pop("intensity_segments")
    else:
        session["intensity_segments"] = segments

    with pytest.raises(ValidationError):
        GeneratedTrainingBlock.model_validate(payload)


def test_rejects_run_segments_that_do_not_sum_to_planned_duration():
    payload = valid_block()
    payload["weeks"][0]["sessions"][0]["intensity_segments"][0][
        "duration_minutes"
    ] = 49

    with pytest.raises(ValidationError):
        GeneratedTrainingBlock.model_validate(payload)


@pytest.mark.parametrize("category", ["strength", "recovery", "cross_training"])
def test_rejects_running_intensity_segments_for_non_running_categories(category):
    payload = valid_block()
    payload["weeks"][0]["sessions"][0]["session_category"] = category

    with pytest.raises(ValidationError):
        GeneratedTrainingBlock.model_validate(payload)


@pytest.mark.parametrize("band", ["low", "threshold", "high"])
def test_accepts_every_canonical_intensity_band(band):
    payload = valid_block()
    payload["weeks"][0]["sessions"][0]["intensity_segments"][0][
        "intensity_band"
    ] = band

    block = GeneratedTrainingBlock.model_validate(payload)

    assert block.weeks[0].sessions[0].intensity_segments[0].intensity_band == band


@pytest.mark.parametrize("band", ["medium", "tempo", "HIGH", ""])
def test_rejects_non_canonical_intensity_bands(band):
    payload = valid_block()
    payload["weeks"][0]["sessions"][0]["intensity_segments"][0][
        "intensity_band"
    ] = band

    with pytest.raises(ValidationError):
        GeneratedTrainingBlock.model_validate(payload)


@pytest.mark.parametrize("duration", [0, -1, True, 12.5])
def test_rejects_non_positive_or_ambiguous_segment_durations(duration):
    payload = valid_block()
    payload["weeks"][0]["sessions"][0]["intensity_segments"] = [
        {"duration_minutes": duration, "intensity_band": "low"}
    ]

    with pytest.raises(ValidationError):
        GeneratedTrainingBlock.model_validate(payload)


@pytest.mark.parametrize(("minimum", "maximum"), [(1, 1), (1, 10), (10, 10)])
def test_accepts_target_rpe_boundaries(minimum, maximum):
    payload = valid_block()
    session = payload["weeks"][0]["sessions"][0]
    session["target_rpe_min"] = minimum
    session["target_rpe_max"] = maximum

    block = GeneratedTrainingBlock.model_validate(payload)

    assert block.weeks[0].sessions[0].target_rpe_min == minimum
    assert block.weeks[0].sessions[0].target_rpe_max == maximum


@pytest.mark.parametrize(("minimum", "maximum"), [(0, 5), (5, 11), (8, 7)])
def test_rejects_out_of_range_or_reversed_target_rpe(minimum, maximum):
    payload = valid_block()
    session = payload["weeks"][0]["sessions"][0]
    session["target_rpe_min"] = minimum
    session["target_rpe_max"] = maximum

    with pytest.raises(ValidationError):
        GeneratedTrainingBlock.model_validate(payload)


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("target_rpe_min", True),
        ("target_rpe_min", 3.0),
        ("target_rpe_max", False),
        ("target_rpe_max", 8.5),
    ],
)
def test_rejects_ambiguous_target_rpe_numeric_types(field, value):
    payload = valid_block()
    payload["weeks"][0]["sessions"][0][field] = value

    with pytest.raises(ValidationError):
        GeneratedTrainingBlock.model_validate(payload)


@pytest.mark.parametrize(
    "field",
    ["session_category", "intensity_segments", "target_rpe_min", "target_rpe_max"],
)
def test_rejects_missing_structured_session_fields(field):
    payload = valid_block()
    payload["weeks"][0]["sessions"][0].pop(field)

    with pytest.raises(ValidationError):
        GeneratedTrainingBlock.model_validate(payload)


def test_forbids_unknown_fields_in_intensity_segments():
    payload = valid_block()
    payload["weeks"][0]["sessions"][0]["intensity_segments"][0][
        "unexpected"
    ] = "not allowed"

    with pytest.raises(ValidationError):
        GeneratedTrainingBlock.model_validate(payload)
