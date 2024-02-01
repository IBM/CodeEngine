FROM icr.io/codeengine/node:20-alpine
WORKDIR /usr/job
COPY . /usr/job/
RUN pwd
WORKDIR /usr/job/job
RUN npm install
CMD [ "node", "./job.mjs" ]
