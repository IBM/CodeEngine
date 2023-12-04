FROM icr.io/codeengine/node:20-alpine
WORKDIR /usr/job
COPY . /usr/job/
RUN cd  ./cloudant-change-listener/job
RUN npm install
CMD [ "node", "./job.mjs" ]
