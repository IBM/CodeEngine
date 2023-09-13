FROM icr.io/codeengine/node:18-alpine
RUN npm install
COPY server.js .
EXPOSE 8080
CMD [ "node", "server.js" ]
