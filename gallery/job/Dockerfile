FROM icr.io/codeengine/node:18-alpine

# Define which files should be copied into the container image
COPY *.js .
COPY package.json .

# Load all dependencies
RUN npm install

# Define how the job is being started
CMD [ "node", "job.js" ]
