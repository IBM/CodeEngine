FROM icr.io/codeengine/node:22-alpine
RUN apk -U upgrade
WORKDIR /app
RUN npm init -f && npm install
COPY server.js .
EXPOSE 8080
CMD [ "node", "server.js" ]
