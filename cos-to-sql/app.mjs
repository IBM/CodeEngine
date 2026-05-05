import { stat } from "fs/promises";
import crypto from "crypto";
import express from "express";
import favicon from "serve-favicon";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

// Libraries needed to materialize the authentication to COS and to SecretsManager
// and to read service credentials from SecretsManager
import SecretsManager from "@ibm-cloud/secrets-manager/secrets-manager/v2.js";
import { ContainerAuthenticator } from "ibm-cloud-sdk-core";

// Imports to handle data base related operations
import { addUser, closeDBConnection, deleteUsers, getPgClient, listUsers } from "./utils/db.mjs";
import { getObjectContent } from "./utils/cos.mjs";
import { convertCsvToDataStruct } from "./utils/utils.mjs";
import { getCodeEngineLogger } from "./utils/logging.mjs";

const appLogger = getCodeEngineLogger("app");

appLogger.info("Starting the app ...");

const requiredEnvVars = [
  "COS_REGION",
  "COS_TRUSTED_PROFILE_NAME",
  "SM_TRUSTED_PROFILE_NAME",
  "SM_SERVICE_URL",
  "SM_PG_SECRET_ID",
];

requiredEnvVars.forEach((envVarName) => {
  if (!process.env[envVarName]) {
    appLogger.warn(`Failed to start app. Missing '${envVarName}' environment variable`);
    process.exit(1);
  }
});

//
// Initialize COS
const cosRegion = process.env.COS_REGION;
const cosTrustedProfileName = process.env.COS_TRUSTED_PROFILE_NAME;
// Create an authenticator to access the COS instance based on a trusted profile
const cosAuthenticator = new ContainerAuthenticator({
  iamProfileName: cosTrustedProfileName,
});

//
// Initialize Secrets Manager SDK
const smTrustedProfileName = process.env.SM_TRUSTED_PROFILE_NAME;
const smServiceURL = process.env.SM_SERVICE_URL;
const smPgSecretId = process.env.SM_PG_SECRET_ID;
// Create an instance of the SDK by providing an authentication mechanism and your Secrets Manager instance URL
const secretsManager = new SecretsManager({
  // Create an authenticator to access the SecretsManager instance based on a trusted profile
  authenticator: new ContainerAuthenticator({
    iamProfileName: smTrustedProfileName,
  }),
  serviceUrl: smServiceURL,
});

const app = express();
app.use(express.json());
app.use(favicon(path.join(__dirname, "public", "favicon.ico")));

// helper function to send JSON responses
function sendJSONResponse(request, response, returnCode, jsonObject) {
  response.status(returnCode);
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(jsonObject));
  const duration = Date.now() - request.startTime;
  request.logger.info(`handled ${request.method} request for '${request.path}' in ${duration}ms; rc: '${returnCode}'`, {
    returnCode,
    duration_ms: duration,
  });
}

// use router to bundle all routes to /
const router = express.Router();

// adding a middleware that extracts the correlation id and initializes the logger
router.use((req, res, next) => {
  const correlationId = req.header("x-request-id") || crypto.randomBytes(8).toString("hex");
  req.startTime = Date.now();
  req.correlationId = correlationId;
  const operationId = `${req.method}:${req.path}`;
  req.operationId = operationId;
  req.logger = getCodeEngineLogger("handle-request").child({ correlationId, operationId });
  req.logger.info(`handling incoming ${req.method} request for '${req.path}'`);
  next();
});

app.use("/", router);

//
// Default http endpoint, which prints the list of all users in the database
router.get("/", async (req, res) => {
  const pgClient = await getPgClient(secretsManager, smPgSecretId);
  const allUsers = await listUsers(pgClient);

  return sendJSONResponse(req, res, 200, { users: allUsers.rows });
});

//
// Readiness endpoint
router.get("/readiness", async (req, res) => {
  console.log(`handling /readiness`);
  if (!(await stat("/var/run/secrets/codeengine.cloud.ibm.com/compute-resource-token/token"))) {
    console.error("Mounting the trusted profile compute resource token is not enabled");

    return sendJSONResponse(req, res, 500, {
      error: "Mounting the trusted profile compute resource token is not enabled",
    });
  }

  return sendJSONResponse(req, res, 200, { status: "ok" });
});

//
// Ingestion endpoint
router.post("/cos-to-sql", async (req, res) => {
  req.logger.debug(`request headers: '${JSON.stringify(req.headers)}`);
  const event = req.body;
  req.logger.debug(`request body: '${event}'`);

  //
  // assess whether the request payload contains information about the COS file that got updated
  if (!event) {
    req.logger.info("Request does not contain any event data");
    return sendJSONResponse(req, res, 400, { error: "request does not contain any event data" });
  }

  //
  // make sure that the event relates to a COS write operation
  if (event.notification.event_type !== "Object:Write") {
    req.logger.info(`COS operation '${event.notification.event_type}' does not match expectations 'Object:Write'`);

    return sendJSONResponse(req, res, 400, {
      error: `COS operation '${event.notification.event_type}' does not match expectations 'Object:Write'`,
    });
  }
  if (event.notification.content_type !== "text/csv") {
    req.logger.info(
      `COS update did happen on file '${event.key}' which is of type '${event.notification.content_type}' (expected type 'text/csv')`
    );

    return sendJSONResponse(req, res, 400, {
      error: `COS update did happen on file '${event.key}' which is of type '${event.notification.content_type}' (expected type 'text/csv')`,
    });
  }
  req.logger.info(`Received a COS update event on the CSV file '${event.key}' in bucket '${event.bucket}'`);

  //
  // Retrieve the COS object that got updated
  req.logger.info(`Retrieving file content of '${event.key}' from bucket ${event.bucket} ...`);
  const fileContent = await getObjectContent(cosAuthenticator, cosRegion, event.bucket, event.key);

  //
  // Convert CSV to a object structure representing an array of users
  req.logger.info(`Converting CSV data to a data struct ...`);
  const users = await convertCsvToDataStruct(fileContent);
  req.logger.info(`users: ${JSON.stringify(users)}`);

  const pgClient = await getPgClient(secretsManager, smPgSecretId);

  //
  // Iterate through the list of users
  req.logger.info(`Writing converted CSV data to the PostgreSQL database ...`);
  let numberOfProcessedUsers = 0;
  for (const userToAdd of users) {
    try {
      // Perform a single SQL insert statement per user
      const result = await addUser(pgClient, userToAdd.Firstname, userToAdd.Lastname);
      req.logger.info(`Added ${JSON.stringify(userToAdd)} -> ${JSON.stringify(result)}`);
      numberOfProcessedUsers++;
    } catch (err) {
      req.logger.error(`Failed to add user '${JSON.stringify(userToAdd)}' to the database`, err);
    }
  }

  req.logger.info(`Processed ${numberOfProcessedUsers} user records!`);
  return sendJSONResponse(req, res, 200, { status: "done" });
});

//
// Endpoint that drops the users table
router.get("/clear", async (req, res) => {
  const pgClient = await getPgClient(secretsManager, smPgSecretId);
  await deleteUsers(pgClient);
  req.logger.info(`Deletions done!`);
  return sendJSONResponse(req, res, 200, { status: "done" });
});

// start server
const port = 8080;
const server = app.listen(port, () => {
  appLogger.info(`Server is up and running on port ${port}!`);
});

process.on("SIGTERM", async () => {
  appLogger.info("SIGTERM signal received.");

  await closeDBConnection();

  server.close(() => {
    appLogger.info("Http server closed.");
  });
});
