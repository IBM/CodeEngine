FROM icr.io/codeengine/node:20-alpine
WORKDIR /usr/job
COPY . /usr/job/
RUN npm install
CMD [ "node", "cloudant_change_listener.mjs" ]
