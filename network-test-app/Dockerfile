FROM icr.io/codeengine/node:22-alpine
RUN apk -U upgrade

WORKDIR /network-test-app

COPY *.js *.json /network-test-app/

RUN npm install

ENTRYPOINT [ "node", "app.js" ]