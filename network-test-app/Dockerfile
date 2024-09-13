FROM icr.io/codeengine/node:20-alpine

WORKDIR /network-test-app

COPY *.js *.json /network-test-app/

RUN npm install

ENTRYPOINT [ "node", "app.js" ]