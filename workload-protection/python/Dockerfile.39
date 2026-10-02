FROM quay.io/sysdig/workload-agent:latest AS workload-agent

# Download dependencies in builder stage
FROM registry.access.redhat.com/ubi9/python-39 AS builder

# Install dependencies
COPY requirements.txt .
RUN python -m pip install -r requirements.txt


# Build final stage
FROM registry.access.redhat.com/ubi9/python-39

ENV PYTHONPATH=/opt/app-root/lib/${PYTHON_VERSION}/site-packages

COPY --chown=1001:0 --from=builder /opt/app-root/lib/python3.9/site-packages ${PYTHONPATH}
COPY --chown=1001:0 *.py /opt/app-root/src/
COPY --chown=1001:0 log_conf.yaml /opt/app-root/src/
COPY --chown=1001:0 entrypoint.sh /opt/app-root/src/entrypoint.sh


COPY --from=workload-agent /opt/draios /opt/draios

USER 0
RUN chmod +x /opt/app-root/src/entrypoint.sh
USER 1001:0

WORKDIR /opt/app-root/src

EXPOSE 8080
ENTRYPOINT ["/opt/app-root/src/entrypoint.sh", "python", "app.py"]