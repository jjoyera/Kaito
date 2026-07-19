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
                        "planned_duration_minutes": 50,
                        "planned_distance_kilometers": "7.50",
                        "planned_elevation_meters": 180,
                        "intensity_description": "Conversational aerobic effort",
                        "is_key_session": False,
                        "purpose": "Develop aerobic durability",
                        "instructions": "Keep the effort relaxed on every climb.",
                    },
                    {
                        "scheduled_date": "2026-07-09",
                        "session_type": "Hill repetitions",
                        "planned_duration_minutes": 65,
                        "planned_distance_kilometers": "8.25",
                        "planned_elevation_meters": 420,
                        "intensity_description": "Controlled hard uphill efforts",
                        "is_key_session": True,
                        "purpose": "Improve uphill running economy",
                        "instructions": "Run six climbs with full easy recoveries.",
                    },
                ],
            }
        ],
        "coach_advice": "Prioritize sleep and reduce effort if fatigue accumulates.",
    }


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


def test_allows_zero_distance_and_elevation_for_strength_or_rest_sessions():
    payload = valid_block()
    session = payload["weeks"][0]["sessions"][0]
    session["planned_distance_kilometers"] = "0"
    session["planned_elevation_meters"] = 0

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
