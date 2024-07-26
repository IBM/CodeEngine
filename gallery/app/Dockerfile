FROM icr.io/codeengine/node:22-alpine
RUN apk -U upgrade

# Define which files should be copied into the container image
COPY *.js .
COPY page.* .
COPY pictures/* /pictures/
COPY package.json .

# Load all dependencies
RUN npm install

# Define how the app is being started
EXPOSE 8080
CMD [ "node", "app.js" ]
