# ---------------------------------------------------------------------------
# Fleet task image — clef email spam classifier
#
# Base: ubi-minimal (same base used in the ollama fleet sample)
# Purpose: Runs as the fleet task container. The ollama server is started by
#          the prehook on the worker node and listens on localhost:11434.
#          This container calls the clef model via the ollama HTTP API and
#          prints a JSON result to stdout.
# ---------------------------------------------------------------------------
FROM registry.access.redhat.com/ubi10/ubi-minimal

# Install runtime dependencies
RUN microdnf install -y \
      curl \
      python3 \
      bash \
    && microdnf clean all

# Copy the task entrypoint
COPY entrypoint.py /usr/local/bin/entrypoint.py
RUN chmod +x /usr/local/bin/entrypoint.py

# The task container reaches the ollama server running on the worker host via
# the special podman hostname host.containers.internal (resolves to the host IP).
ENV OLLAMA_HOST=http://host.containers.internal:11434
ENV MODEL=clef

# The email text is passed as the first argument to the entrypoint at task
# submission time (populated by the Code Engine function __main__.py).

ENTRYPOINT ["python3", "/usr/local/bin/entrypoint.py"]
