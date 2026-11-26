# Code bundle of the receiver function. Build context: this directory (see ../../build)
FROM node:24.22-alpine3.24 AS build
WORKDIR /bundle
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY main.js ./

FROM scratch
COPY --from=build /bundle /
