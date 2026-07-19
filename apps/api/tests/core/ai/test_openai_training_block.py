import json
import traceback
from copy import deepcopy
from datetime import date
from decimal import Decimal
from types import SimpleNamespace

import httpx
import openai
import pytest
from pydantic import ValidationError

from app.core.ai.training_block_prompt_v1 import PROMPT_VERSION
from app.core.config import PINNED_OPENAI_MODEL
from app.modules.planning.generation_context import (
    ProviderAvailabilityDay,
    ProviderGenerationContext,
    ProviderGoalContext,
    ProviderReadinessContext,
    ProviderSafetyContext,
    ProviderWeekConstraint,
)
from app.modules.planning.generation_contract import GeneratedTrainingBlock


def context() -> ProviderGenerationContext:
    return ProviderGenerationContext(
        authorized_approach="mode_z",
        generation_window_start=date(2026, 7, 6),
        goal_date=date(2026, 7, 12),
        goal=ProviderGoalContext(
            modality="trail",
            target_distance_kilometers=Decimal("42.50"),
            positive_elevation_meters=Decimal("1500"),
            km_effort=Decimal("57.50"),
        ),
        readiness=ProviderReadinessContext(
            status="on_track",
            minimum_peak_weekly_minutes=240,
            required_peak_loading_weeks=3,
            reason_codes=(),
        ),
        safety=ProviderSafetyContext(
            restriction_codes=(), load_increase_blocked_for_horizon=False
        ),
        availability=(ProviderAvailabilityDay(weekday="saturday", minutes=150),),
        weeks=(
            ProviderWeekConstraint(
                week_number=1,
                window_start=date(2026, 7, 6),
                window_end=date(2026, 7, 12),
                phase="loading",
                readiness_role="build",
                target_running_kilometers=Decimal("30.00"),
                maximum_longest_outing_kilometers=Decimal("15.00"),
                maximum_longest_outing_duration_minutes=120,
                load_increase_blocked=False,
            ),
        ),
    )


def valid_payload() -> dict[str, object]:
    return {
        "applied_approach": "mode_z",
        "block_focus": "Aerobic durability",
        "weeks": [
            {
                "week_number": 1,
                "week_goal": "Build consistency",
                "sessions": [
                    {
                        "scheduled_date": "2026-07-11",
                        "session_type": "Long trail run",
                        "session_category": "run",
                        "planned_duration_minutes": 90,
                        "planned_distance_kilometers": "12.50",
                        "planned_elevation_meters": 400,
                        "intensity_description": "Easy aerobic effort",
                        "intensity_segments": [
                            {"duration_minutes": 90, "intensity_band": "low"}
                        ],
                        "target_rpe_min": 3,
                        "target_rpe_max": 4,
                        "is_key_session": True,
                        "purpose": "Develop endurance",
                        "instructions": "Keep every climb controlled.",
                    }
                ],
            }
        ],
        "coach_advice": "Prioritize recovery.",
    }


class FakeResponses:
    def __init__(self, result: object = None, error: Exception | None = None) -> None:
        self.result = result
        self.error = error
        self.calls: list[dict[str, object]] = []

    def parse(self, **kwargs: object) -> object:
        self.calls.append(kwargs)
        if self.error is not None:
            raise self.error
        return self.result


class FakeClient:
    def __init__(self, result: object = None, error: Exception | None = None) -> None:
        self.responses = FakeResponses(result, error)


def assert_normalized_failure_hides_context(
    caught: pytest.ExceptionInfo[Exception],
    *,
    message: str,
    secrets: tuple[str, ...],
) -> None:
    error = caught.value
    assert str(error) == message
    assert error.__cause__ is None
    assert error.__suppress_context__ is True
    assert error.__context__ is not None
    formatted = "".join(traceback.format_exception(error))
    for secret in secrets:
        assert secret not in formatted


def parsed_response(parsed: object, *, status: str = "completed") -> object:
    return SimpleNamespace(
        status=status,
        incomplete_details=None,
        output=[
            SimpleNamespace(
                type="message",
                content=[SimpleNamespace(type="output_text", parsed=parsed)],
            )
        ],
    )


def refusal_response(
    *, with_output_text: bool = False, status: str = "completed"
) -> object:
    content = [SimpleNamespace(type="refusal", refusal="raw refusal details")]
    if with_output_text:
        content.append(SimpleNamespace(type="output_text", parsed=None))
    return SimpleNamespace(
        status=status,
        incomplete_details=SimpleNamespace(reason="max_output_tokens"),
        output=[SimpleNamespace(type="message", content=content)],
    )


def test_importing_adapter_does_not_require_api_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    from app.core.ai.openai_training_block import OpenAITrainingBlockProvider

    assert OpenAITrainingBlockProvider is not None


def test_returns_only_existing_validated_generated_training_block() -> None:
    from app.core.ai.openai_training_block import OpenAITrainingBlockProvider

    block = GeneratedTrainingBlock.model_validate(valid_payload())
    provider = OpenAITrainingBlockProvider(FakeClient(parsed_response(block)))

    result = provider.generate(context())

    assert result is block
    assert type(result) is GeneratedTrainingBlock


def test_records_exact_structured_responses_api_call() -> None:
    from app.core.ai.openai_training_block import OpenAITrainingBlockProvider

    block = GeneratedTrainingBlock.model_validate(valid_payload())
    client = FakeClient(parsed_response(block))

    OpenAITrainingBlockProvider(client).generate(context())

    assert len(client.responses.calls) == 1
    call = client.responses.calls[0]
    assert call.keys() == {"model", "input", "text_format"}
    assert call["model"] == PINNED_OPENAI_MODEL
    assert call["text_format"] is GeneratedTrainingBlock
    assert isinstance(call["input"], str)
    assert call["input"].startswith(f"prompt_version: {PROMPT_VERSION}\n")
    assert '"target_running_kilometers":"30.00"' in call["input"]
    for forbidden in ("stream", "fallback", "max_retries", "retry"):
        assert forbidden not in call


def test_refusal_is_normalized_without_raw_details() -> None:
    from app.core.ai.openai_training_block import (
        OpenAITrainingBlockProvider,
        TrainingGenerationRefused,
    )

    with pytest.raises(TrainingGenerationRefused) as caught:
        OpenAITrainingBlockProvider(FakeClient(refusal_response())).generate(context())

    assert str(caught.value) == "generation_refused"
    assert "raw refusal details" not in str(caught.value)


def test_refusal_precedes_missing_or_incomplete_output() -> None:
    from app.core.ai.openai_training_block import (
        OpenAITrainingBlockProvider,
        TrainingGenerationRefused,
    )

    with pytest.raises(TrainingGenerationRefused, match="^generation_refused$"):
        OpenAITrainingBlockProvider(
            FakeClient(refusal_response(with_output_text=True, status="incomplete"))
        ).generate(context())


def test_missing_parsed_output_is_invalid() -> None:
    from app.core.ai.openai_training_block import (
        OpenAITrainingBlockProvider,
        TrainingGenerationInvalidResponse,
    )

    response = SimpleNamespace(status="completed", output=[])
    with pytest.raises(
        TrainingGenerationInvalidResponse, match="^generation_invalid_response$"
    ):
        OpenAITrainingBlockProvider(FakeClient(response)).generate(context())


@pytest.mark.parametrize("reason", ["max_output_tokens", "content_filter", None])
def test_incomplete_response_is_invalid_without_reason_leakage(
    reason: str | None,
) -> None:
    from app.core.ai.openai_training_block import (
        OpenAITrainingBlockProvider,
        TrainingGenerationInvalidResponse,
    )

    response = SimpleNamespace(
        status="incomplete",
        incomplete_details=SimpleNamespace(reason=reason),
        output=[],
    )
    with pytest.raises(TrainingGenerationInvalidResponse) as caught:
        OpenAITrainingBlockProvider(FakeClient(response)).generate(context())

    assert str(caught.value) == "generation_invalid_response"
    assert str(reason) not in str(caught.value)


def test_pydantic_parse_failure_is_normalized() -> None:
    from app.core.ai.openai_training_block import (
        OpenAITrainingBlockProvider,
        TrainingGenerationInvalidResponse,
    )

    raw_body = "pydantic-raw-provider-body-secret"
    with pytest.raises(ValidationError) as validation_error:
        GeneratedTrainingBlock.model_validate(
            {**valid_payload(), "raw_provider_body": raw_body}
        )
    provider = OpenAITrainingBlockProvider(FakeClient(error=validation_error.value))

    with pytest.raises(TrainingGenerationInvalidResponse) as caught:
        provider.generate(context())

    assert_normalized_failure_hides_context(
        caught,
        message="generation_invalid_response",
        secrets=(raw_body, "raw_provider_body"),
    )


def test_malformed_parse_failure_is_normalized() -> None:
    from app.core.ai.openai_training_block import (
        OpenAITrainingBlockProvider,
        TrainingGenerationInvalidResponse,
    )

    raw_payload = "raw-malformed-provider-payload-secret"
    provider = OpenAITrainingBlockProvider(FakeClient(error=ValueError(raw_payload)))
    with pytest.raises(TrainingGenerationInvalidResponse) as caught:
        provider.generate(context())

    assert_normalized_failure_hides_context(
        caught,
        message="generation_invalid_response",
        secrets=(raw_payload,),
    )


def test_wrong_parsed_type_is_invalid_instead_of_being_revalidated() -> None:
    from app.core.ai.openai_training_block import (
        OpenAITrainingBlockProvider,
        TrainingGenerationInvalidResponse,
    )

    with pytest.raises(
        TrainingGenerationInvalidResponse, match="^generation_invalid_response$"
    ):
        OpenAITrainingBlockProvider(
            FakeClient(parsed_response(deepcopy(valid_payload())))
        ).generate(context())


def test_timeout_is_caught_before_broader_api_error() -> None:
    from app.core.ai.openai_training_block import (
        OpenAITrainingBlockProvider,
        TrainingGenerationTimeout,
    )

    raw_url = "https://example.test/raw-timeout-secret"
    error = openai.APITimeoutError(request=httpx.Request("POST", raw_url))
    with pytest.raises(TrainingGenerationTimeout) as caught:
        OpenAITrainingBlockProvider(FakeClient(error=error)).generate(context())

    assert_normalized_failure_hides_context(
        caught,
        message="generation_timeout",
        secrets=(raw_url, "raw-timeout-secret"),
    )


def test_api_error_is_normalized_without_upstream_text() -> None:
    from app.core.ai.openai_training_block import (
        OpenAITrainingBlockProvider,
        TrainingGenerationUnavailable,
    )

    raw_message = "raw-upstream-exception-secret"
    error = openai.APIError(
        raw_message,
        request=httpx.Request("POST", "https://example.test"),
        body={"api_key": "secret-key", "prompt": "private-context-secret"},
    )
    with pytest.raises(TrainingGenerationUnavailable) as caught:
        OpenAITrainingBlockProvider(FakeClient(error=error)).generate(context())

    assert_normalized_failure_hides_context(
        caught,
        message="generation_provider_unavailable",
        secrets=(raw_message, "secret-key", "private-context-secret", "api_key"),
    )


@pytest.mark.parametrize("value", [{}, object()])
def test_provider_rejects_non_provider_context_at_runtime(value: object) -> None:
    from app.core.ai.openai_training_block import OpenAITrainingBlockProvider

    with pytest.raises(TypeError, match="provider_generation_context_required"):
        OpenAITrainingBlockProvider(FakeClient()).generate(value)  # type: ignore[arg-type]


def test_generated_contract_is_compatible_with_sdk_structured_schema_and_parsing(
) -> None:
    from openai.lib._parsing._responses import (
        parse_response,
        type_to_text_format_param,
    )
    from openai.types.responses import Response

    try:
        text_format = type_to_text_format_param(GeneratedTrainingBlock)
        raw_response = Response.model_validate(
            {
                "id": "response_offline_test",
                "created_at": 0,
                "model": PINNED_OPENAI_MODEL,
                "object": "response",
                "output": [
                    {
                        "id": "message_offline_test",
                        "type": "message",
                        "role": "assistant",
                        "status": "completed",
                        "content": [
                            {
                                "type": "output_text",
                                "text": json.dumps(valid_payload()),
                                "annotations": [],
                                "logprobs": [],
                            }
                        ],
                    }
                ],
                "parallel_tool_calls": False,
                "tool_choice": "none",
                "tools": [],
            }
        )
        parsed_response_from_sdk = parse_response(
            text_format=GeneratedTrainingBlock,
            input_tools=[],
            response=raw_response,
        )
    except Exception as error:  # pragma: no cover - failure message is the contract
        pytest.fail(
            "GeneratedTrainingBlock is incompatible with openai==2.46.0 "
            f"structured parsing: {type(error).__name__}"
        )

    assert text_format["type"] == "json_schema"
    assert text_format["strict"] is True
    assert text_format["schema"]["additionalProperties"] is False
    assert type(parsed_response_from_sdk.output_parsed) is GeneratedTrainingBlock
