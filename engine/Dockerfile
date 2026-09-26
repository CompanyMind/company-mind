FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
WORKDIR /app
# Install from the lockfile, runtime deps only, at build time. UV_NO_SYNC stops
# `uv run` (the CMD here and the bot's compose command) from re-syncing the
# default groups on every container start, which pulled in the dev group
# (pytest, ranx -> numba/pandas/matplotlib) from the network each boot.
ENV UV_NO_SYNC=1 \
    PATH="/app/.venv/bin:$PATH"
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project
COPY app ./app
EXPOSE 8000
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
