FROM python:3.12-slim

WORKDIR /workspace/apps/api

COPY apps/api/pyproject.toml apps/api/uv.lock ./
RUN pip install --no-cache-dir uv && uv sync --frozen

COPY apps/api ./

RUN adduser --disabled-password --gecos "" kaito \
    && chown -R kaito:kaito /workspace/apps/api
USER kaito

EXPOSE 8000
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
