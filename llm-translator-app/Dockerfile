# Use a prebuilt pytorch image
FROM docker.io/cnstark/pytorch:2.0.1-py3.10.11-ubuntu22.04

# Replace shell with bash so we can source files
RUN rm /bin/sh && ln -s /bin/bash /bin/sh

# Install git and curl and the latest node version on top
RUN apt update \
    && apt install -y git curl \
    && curl -o- https://raw.githubusercontent.com/creationix/nvm/master/install.sh | bash \
    && source ${HOME}/.nvm/nvm.sh \
    && nvm install --lts \
    && ln -s ${HOME}/.nvm/versions/node/$(nvm current) ${HOME}/.nvm/versions/node/lts

ENV NVM_DIR /root/.nvm
ENV NODE_PATH $NVM_DIR/versions/node/lts/lib/node_modules
ENV PATH      $NVM_DIR/versions/node/lts/bin:$PATH

# Define the working dir
WORKDIR /app

# Download the model during the container build operation
RUN git clone https://huggingface.co/Helsinki-NLP/opus-mt-de-en \
    && (cd opus-mt-de-en && rm README.md rust_model.ot && rm -rf .git)


# Copy your Code and the Dockerfile descriptor
COPY . .

# Install all node and python dependencies and transpile Typescript sources
RUN npm install \
    && npm run build \
    && pip3 install -r requirements.txt

# Disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED 1

# Command to starts
CMD ["npm","run","start"]