#################################################
# Build stage
#################################################

FROM registry.access.redhat.com/ubi9/python-312:9.6-1752571600 AS build-stage

LABEL maintainer="kai.wedekind@de.ibm.com"

USER 1001
WORKDIR $HOME

ENV PATH="$HOME/.venv/bin:$PATH"

# Install uv.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy the application into the container.
COPY . .

# Install the application dependencies.
RUN uv sync --frozen --no-cache

USER root

# https://docs.trychroma.com/updates/troubleshooting#sqlite
RUN uv add pysqlite3-binary
RUN sed -i '1i # ruff: noqa: E402,I001\n__import__("pysqlite3")\nimport sys\nsys.modules["sqlite3"] = sys.modules.pop("pysqlite3")' main.py

# Linting
RUN ruff check . --no-cache

# Reinstall without dev dependencies
RUN uv sync --frozen --no-dev

USER 1001

#################################################
# Production stage
#################################################

FROM registry.access.redhat.com/ubi9/python-312:9.6-1752571600

LABEL maintainer="kai.wedekind@de.ibm.com"

USER 1001
WORKDIR $HOME

ENV PATH="$HOME/.venv/bin:$PATH"
ENV MODE=${MODE:-production}
ENV LOG_LEVEL=${LOG_LEVEL:-DEBUG}
ENV PORT=${PORT:-5640}
ENV WORKERS=${WORKERS:-1}

COPY --from=build-stage $HOME/ .

# Run the application.
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT} --workers ${WORKERS} --log-level ${LOG_LEVEL,,} --timeout-keep-alive 50  --header server:acp
