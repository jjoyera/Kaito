FROM python:3.12-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:0.11.29 /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy
WORKDIR /workspace/apps/api

COPY apps/api/pyproject.toml apps/api/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project --no-build

FROM python:3.12-slim AS runtime

ENV PATH="/workspace/apps/api/.venv/bin:${PATH}" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000
WORKDIR /workspace/apps/api

RUN useradd --create-home --uid 10001 kaito

COPY --from=builder --chown=kaito:kaito /workspace/apps/api/.venv .venv
COPY --chown=kaito:kaito apps/api/app app

USER kaito
EXPOSE 8000

CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port \"${PORT:-8000}\""]
