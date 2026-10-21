# Use the official Jupyter base-notebook image.
# Runs as non-root user "jovyan" (uid 1000) — satisfies IBM security policy.
FROM quay.io/jupyter/base-notebook:latest

# Install project dependencies.
RUN pip install --no-cache-dir \
      pylatexenc \
      matplotlib \
      qiskit-ibm-runtime \
      jupyter

# Pre-load the hello-world notebook into the work directory.
# At runtime the COS persistent data store is mounted over /home/jovyan/work;
# this copy is only visible when the bucket is empty (first launch).
COPY hello-world.ipynb /home/jovyan/hello-world.ipynb

# Copy and install the startup script.
USER root
COPY start.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh
USER jovyan

# Override the base image entrypoint with our startup script.
CMD ["/usr/local/bin/start.sh"]
