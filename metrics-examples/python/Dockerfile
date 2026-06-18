
# Download dependencies in builder stage
FROM registry.access.redhat.com/ubi9/python-312 AS builder

# Install dependencies
COPY requirements.txt .
RUN python -m pip install -r requirements.txt

# Build final stage
FROM registry.access.redhat.com/ubi10/python-312-minimal

ENV PYTHONPATH=/opt/app-root/lib/${PYTHON_VERSION}/site-packages

COPY --chown=1001:0 --from=builder /opt/app-root/lib/python3.12/site-packages ${PYTHONPATH}
COPY --chown=1001:0 *.py /opt/app-root/src/
COPY --chown=1001:0 utils/ /opt/app-root/src/utils
COPY --chown=1001:0 log_conf.yaml /opt/app-root/src/

USER 1001:0
WORKDIR /opt/app-root/src

CMD python app.py
