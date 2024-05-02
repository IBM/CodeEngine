FROM icr.io/codeengine/node:18-alpine

WORKDIR /job

COPY *.mjs *.json /job

RUN npm install

ENTRYPOINT [ "node", "job.mjs" ]
