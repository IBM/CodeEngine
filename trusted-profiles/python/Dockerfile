# Download dependencies in builder stage
FROM registry.access.redhat.com/ubi9/python-39 AS builder

COPY requirements.txt .
RUN python -m pip install -r requirements.txt

# Build final stage
FROM gcr.io/distroless/python3

ENV PYTHONPATH=/app/site-packages

COPY --chown=1001:0 --from=builder /opt/app-root/lib/python3.9/site-packages ${PYTHONPATH}
COPY --chown=1001:0 main.py /app/

USER 1001:0
WORKDIR /app

CMD ["main.py"]
