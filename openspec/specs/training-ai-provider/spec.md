# Training AI Provider

## Purpose

Define the stable M1 boundary for generating one structured training block from the backend-owned provider context.

## Requirements

### Fixed provider configuration

The API MUST use `openai==2.46.0`, the OpenAI Responses API, and model snapshot `gpt-5.5-2026-04-23`.

- `OPENAI_API_KEY` MUST be trimmed and MUST be required only when the provider client is constructed.
- An absent `OPENAI_MODEL` MUST select the fixed snapshot; every explicit value other than the exact snapshot MUST fail closed.
- An absent `OPENAI_TIMEOUT_SECONDS` MUST select 60 seconds; overrides MUST be positive and finite.
- The SDK client MUST set `max_retries=0` because orchestration and repair are outside M1.

### Provider-neutral generation boundary

The generation port MUST accept only `ProviderGenerationContext` and return only a Pydantic-validated `GeneratedTrainingBlock`.

The OpenAI adapter MUST call `client.responses.parse` with the fixed model, the versioned prompt as `input`, and `GeneratedTrainingBlock` as `text_format`. It MUST NOT expose raw responses, return mappings, bypass Pydantic validation, stream, retry, repair, or select fallback providers.

### Versioned prompt

Prompt `training-block-v1` MUST be deterministic and English. It MUST serialize only `ProviderGenerationContext` as deterministic JSON, preserving decimal values as strings.

The prompt MUST state that the backend-owned approach, dates, weekly distance, availability, session trajectory, readiness, and sports restrictions are constraints rather than model choices. It MUST prohibit medical diagnosis and invented missing data and request only the structured `GeneratedTrainingBlock` schema.

### Neutral failure classification

The adapter MUST normalize provider outcomes without including API keys, prompt/context data, response payloads, or upstream exception text:

- API timeout: `generation_timeout`;
- structured refusal: `generation_refused`;
- missing, incomplete, malformed, or wrongly typed parsed output: `generation_invalid_response`;
- other OpenAI API failures: `generation_provider_unavailable`.

A structured refusal MUST take precedence over incomplete or absent parsed output.

## Out of scope

M1 does not orchestrate retries or repair, invoke sports/context validators after parsing, persist generated plans, expose endpoints or UI, emit telemetry, support fallback models, or support multiple providers.
