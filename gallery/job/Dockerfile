FROM icr.io/codeengine/node:22-alpine
RUN apk -U upgrade

# Define which files should be copied into the container image
COPY *.js .
COPY package.json .

# Load all dependencies
RUN npm install

# Define how the job is being started
CMD [ "node", "job.js" ]
