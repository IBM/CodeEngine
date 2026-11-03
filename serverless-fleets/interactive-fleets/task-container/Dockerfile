# ---------------------------------------------------------------------------
# Fleet task image — interactive-fleets data enrichment worker
#
# Base: ubi-minimal
# Purpose: Receives a JSON payload as $1, enriches it, and writes the result
#          to the COS mount at /data/results/interactive-fleet-result/{task_id}.json.
# ---------------------------------------------------------------------------
FROM registry.access.redhat.com/ubi10/ubi-minimal

# Install runtime dependencies
#   bash        — shell interpreter
#   jq          — JSON processing
#   util-linux  — uuidgen
#   (hostname read from /etc/hostname; elapsed time computed with bash arithmetic)
RUN microdnf install -y \
      bash \
      jq \
      util-linux \
    && microdnf clean all

# Copy the task entrypoint
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Results are written to /data/results (the fleet COS mount root).
# The script appends interactive-fleet-result/<task_id>.json inside this dir.
ENV RESULTS_DIR=/data/results

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
