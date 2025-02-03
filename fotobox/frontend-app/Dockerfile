FROM --platform=linux/amd64 node:23 as build

WORKDIR /app

COPY . .

RUN npm install && npm run build


FROM --platform=linux/amd64 node:23

WORKDIR /app

COPY --from=build /app/build build
COPY --from=build /app/package.json package.json
COPY --from=build /app/package-lock.json package-lock.json
RUN npm ci --omit dev



EXPOSE 3000

ENTRYPOINT [ "node", "build" ]


