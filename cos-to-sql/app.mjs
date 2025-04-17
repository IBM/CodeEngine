import { stat } from "fs/promises";
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

console.info("Starting the app ...");

const requiredEnvVars = [
  "COS_REGION",
  "COS_TRUSTED_PROFILE_NAME",
  "SM_TRUSTED_PROFILE_NAME",
  "SM_SERVICE_URL",
  "SM_PG_SECRET_ID",
];

requiredEnvVars.forEach((envVarName) => {
  if (!process.env[envVarName]) {
    console.log(`Failed to start app. Missing '${envVarName}' environment variable`);
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

// use router to bundle all routes to /
const router = express.Router();
app.use("/", router);

//
// Default http endpoint, which prints the list of all users in the database
router.get("/", async (req, res) => {
  console.log(`handling / for '${req.url}'`);
  const pgClient = await getPgClient(secretsManager, smPgSecretId);
  const allUsers = await listUsers(pgClient);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ users: allUsers.rows }));
});

//
// Readiness endpoint
router.get("/readiness", async (req, res) => {
  console.log(`handling /readiness`);
  if (!(await stat("/var/run/secrets/codeengine.cloud.ibm.com/compute-resource-token/token"))) {
    console.error("Mounting the trusted profile compute resource token is not enabled");
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end('{"error": "Mounting the trusted profile compute resource token is not enabled"}');
    return;
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end('{"status": "ok"}');
  return;
});

//
// Ingestion endpoint
router.post("/cos-to-sql", async (req, res) => {
  console.log(`handling /cos-to-sql for '${req.url}'`);
  console.log(`request headers: '${JSON.stringify(req.headers)}`);
  const event = req.body;
  console.log(`request body: '${event}'`);

  //
  // assess whether the request payload contains information about the COS file that got updated
  if (!event) {
    console.log("Request does not contain any event data");
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end('{"error": "request does not contain any event data"}');
    return;
  }

  //
  // make sure that the event relates to a COS write operation
  if (event.notification.event_type !== "Object:Write") {
    console.log(`COS operation '${event.notification.event_type}' does not match expectations 'Object:Write'`);
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(`{"error": "COS operation '${event.notification.event_type}' does not match expectations 'Object:Write'"}`);
    return;
  }
  if (event.notification.content_type !== "text/csv") {
    console.log(
      `COS update did happen on file '${event.key}' which is of type '${event.notification.content_type}' (expected type 'text/csv')`
    );
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      `{"error": "COS update did happen on file '${event.key}' which is of type '${event.notification.content_type}' (expected type 'text/csv')"}`
    );
    return;
  }
  console.log(`Received a COS update event on the CSV file '${event.key}' in bucket '${event.bucket}'`);

  //
  // Retrieve the COS object that got updated
  console.log(`Retrieving file content of '${event.key}' from bucket ${event.bucket} ...`);
  const fileContent = await getObjectContent(cosAuthenticator, cosRegion, event.bucket, event.key);

  //
  // Convert CSV to a object structure representing an array of users
  console.log(`Converting CSV data to a data struct ...`);
  const users = await convertCsvToDataStruct(fileContent);
  console.log(`users: ${JSON.stringify(users)}`);

  const pgClient = await getPgClient(secretsManager, smPgSecretId);

  //
  // Iterate through the list of users
  console.log(`Writing converted CSV data to the PostgreSQL database ...`);
  let numberOfProcessedUsers = 0;
  for (const userToAdd of users) {
    try {
      // Perform a single SQL insert statement per user
      const result = await addUser(pgClient, userToAdd.Firstname, userToAdd.Lastname);
      console.log(`Added ${JSON.stringify(userToAdd)} -> ${JSON.stringify(result)}`);
      numberOfProcessedUsers++;
    } catch (err) {
      console.error(`Failed to add user '${JSON.stringify(userToAdd)}' to the database`, err);
    }
  }

  console.log(`Processed ${numberOfProcessedUsers} user records!`);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(`{"status": "done"}`);
  return;
});

//
// Endpoint that drops the users table
router.get("/clear", async (req, res) => {
  console.log(`handling /clear for '${req.url}'`);
  const pgClient = await getPgClient(secretsManager, smPgSecretId);
  await deleteUsers(pgClient);
  console.log(`Deletions done!`);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(`{"status": "done"}`);
  return;
});

// start server
const port = 8080;
const server = app.listen(port, () => {
  console.log(`Server is up and running on port ${port}!`);
});

process.on("SIGTERM", async () => {
  console.info("SIGTERM signal received.");

  await closeDBConnection();

  server.close(() => {
    console.log("Http server closed.");
  });
});
