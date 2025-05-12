# Start from the code-server Debian base image
FROM codercom/code-server

USER root

RUN chown -R coder:coder /home/coder

# Install Java
RUN apt update && \
    apt install wget lsb-release -y  && \
    wget https://packages.microsoft.com/config/debian/$(lsb_release -rs)/packages-microsoft-prod.deb -O packages-microsoft-prod.deb && \
    dpkg -i packages-microsoft-prod.deb

RUN apt-get update && \
    apt-get install -y msopenjdk-21

# Install VS Code extensions
# Extensions will not be installed into the default directory (<user-data-dir>/extensions).
# Instead, they will be managed in a dedicated directory to ensure they remain uncoupled from the user-data directory.
# This prevents the extensions directory from changing if the user-data directory is overwritten or reconfigured at runtime.
USER coder

ENV EXTENSION_DIR=/home/coder/extensions
RUN mkdir -p "${EXTENSION_DIR}"
RUN echo "[]" > "${EXTENSION_DIR}/extensions.json"

# Install the required extensions using code-server with the specified extensions directory.
# Note: We use a different marketplace than VS Code. See https://github.com/cdr/code-server/blob/main/docs/FAQ.md#differences-compared-to-vs-code for more details.
RUN code-server --extensions-dir "${EXTENSION_DIR}" --install-extension redhat.java
RUN code-server --extensions-dir "${EXTENSION_DIR}" --install-extension vscjava.vscode-java-debug
RUN code-server --extensions-dir "${EXTENSION_DIR}" --install-extension vmware.vscode-spring-boot
RUN code-server --extensions-dir "${EXTENSION_DIR}" --install-extension vmware.vscode-boot-dev-pack


ENTRYPOINT /usr/bin/entrypoint.sh --extensions-dir ${EXTENSION_DIR}
