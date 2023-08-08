FROM icr.io/codeengine/node:12-alpine

COPY dist /dist
COPY node_modules /node_modules

EXPOSE 8080
CMD [ "node", "dist/server.js" ]
