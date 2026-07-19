import math

import pytest

from app.core import config


@pytest.fixture(autouse=True)
def clear_openai_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in ("OPENAI_API_KEY", "OPENAI_MODEL", "OPENAI_TIMEOUT_SECONDS"):
        monkeypatch.delenv(name, raising=False)


def test_openai_api_key_is_required_and_trimmed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "  test-key  ")

    settings = config.get_openai_settings()

    assert settings.api_key == "test-key"


@pytest.mark.parametrize("value", [None, "", "  \t "])
def test_openai_api_key_rejects_missing_or_blank(
    monkeypatch: pytest.MonkeyPatch, value: str | None
) -> None:
    if value is not None:
        monkeypatch.setenv("OPENAI_API_KEY", value)

    with pytest.raises(config.OpenAIConfigError, match="openai_not_configured"):
        config.get_openai_settings()


def test_openai_model_defaults_to_pinned_snapshot(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    assert config.get_openai_settings().model == "gpt-5.5-2026-04-23"


@pytest.mark.parametrize("value", ["gpt-5", " gpt-5.5-2026-04-23 ", ""])
def test_openai_model_fails_closed_for_any_non_exact_override(
    monkeypatch: pytest.MonkeyPatch, value: str
) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_MODEL", value)

    with pytest.raises(config.OpenAIConfigError, match="openai_model_not_allowed"):
        config.get_openai_settings()


def test_openai_timeout_defaults_to_sixty_seconds(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    assert math.isclose(config.get_openai_settings().timeout_seconds, 60.0)


def test_openai_timeout_accepts_positive_finite_override(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_TIMEOUT_SECONDS", "12.5")

    assert math.isclose(config.get_openai_settings().timeout_seconds, 12.5)


@pytest.mark.parametrize(
    "value",
    [
        "",
        " ",
        "abc",
        "nan",
        "NaN",
        "inf",
        "+inf",
        "-inf",
        "0",
        "-1",
        "true",
        "false",
    ],
)
def test_openai_timeout_rejects_invalid_values(
    monkeypatch: pytest.MonkeyPatch, value: str
) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_TIMEOUT_SECONDS", value)

    with pytest.raises(config.OpenAIConfigError, match="openai_timeout_invalid"):
        config.get_openai_settings()


def test_openai_settings_repr_does_not_expose_api_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "highly-sensitive-key")

    assert "highly-sensitive-key" not in repr(config.get_openai_settings())


def test_client_builder_passes_key_timeout_and_disables_sdk_retries(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[dict[str, object]] = []
    sentinel = object()

    def fake_client(**kwargs: object) -> object:
        calls.append(kwargs)
        return sentinel

    monkeypatch.setenv("OPENAI_API_KEY", "  test-key  ")
    monkeypatch.setenv("OPENAI_TIMEOUT_SECONDS", "17")

    result = config.build_openai_client(client_factory=fake_client)

    assert result is sentinel
    assert calls == [{"api_key": "test-key", "timeout": 17.0, "max_retries": 0}]


def test_client_builder_uses_default_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[dict[str, object]] = []
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    config.build_openai_client(client_factory=lambda **kwargs: calls.append(kwargs))

    assert calls == [{"api_key": "test-key", "timeout": 60.0, "max_retries": 0}]
