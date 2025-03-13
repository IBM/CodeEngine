import { existsSync } from "fs";
import http from "http";

// Libraries needed to materialize the authentication to COS and to SecretsManager
// and to read service credentials from SecretsManager
import SecretsManager from "@ibm-cloud/secrets-manager/secrets-manager/v2.js";
import { ContainerAuthenticator } from "ibm-cloud-sdk-core";

// Libraries to convert CSV content into a object structure
import csv from "csv-parser";
import { Readable } from "stream";

// Libraries to access PostgreSQL
import pg from "pg";
import pgConnectionString from "pg-connection-string";

console.info("Starting the app ...");

//
// Initialize COS
const cosRegion = process.env.COS_REGION;
const cosTrustedProfileName = process.env.COS_TRUSTED_PROFILE_NAME;
let cosAuthenticator;
if (cosTrustedProfileName) {
  // create an authenticator to access the COS instance based on a trusted profile
  cosAuthenticator = new ContainerAuthenticator({
    iamProfileName: cosTrustedProfileName,
  });
}

//
// Initialize Secrets Manager SDK
const smTrustedProfileName = process.env.SM_TRUSTED_PROFILE_NAME;
const smServiceURL = process.env.SM_SERVICE_URL;
const smPgSecretId = process.env.SM_PG_SECRET_ID;
let secretsManager;
if (smTrustedProfileName && smServiceURL) {
  // create an authenticator to access the SecretsManager instance based on a trusted profile
  const smAuthenticator = new ContainerAuthenticator({
    iamProfileName: smTrustedProfileName,
  });
  // Create an instance of the SDK by providing an authentication mechanism and your Secrets Manager instance URL
  secretsManager = new SecretsManager({
    authenticator: smAuthenticator,
    serviceUrl: smServiceURL,
  });
}

let _pgClient;

const server = http
  .createServer(async function (request, response) {
    //
    // Readiness endpoint
    if (request.url == "/readiness") {
      if (!cosRegion) {
        console.error("environment variable COS_REGION is not set");
        response.writeHead(500, { "Content-Type": "application/json" });
        response.end('{"error": "environment variable COS_REGION is not set"}');
        return;
      }

      if (!cosTrustedProfileName) {
        console.error("environment variable COS_TRUSTED_PROFILE_NAME is not set");
        response.writeHead(500, { "Content-Type": "application/json" });
        response.end('{"error": "environment variable COS_TRUSTED_PROFILE_NAME is not set"}');
        return;
      }

      if (!smTrustedProfileName) {
        console.error("environment variable SM_TRUSTED_PROFILE_NAME is not set");
        response.writeHead(500, { "Content-Type": "application/json" });
        response.end('{"error": "environment variable SM_TRUSTED_PROFILE_NAME is not set"}');
        return;
      }

      if (!smServiceURL) {
        console.error("environment variable SM_SERVICE_URL is not set");
        response.writeHead(500, { "Content-Type": "application/json" });
        response.end('{"error": "environment variable SM_SERVICE_URL is not set"}');
        return;
      }

      if (!smPgSecretId) {
        console.error("environment variable SM_PG_SECRET_ID is not set");
        response.writeHead(500, { "Content-Type": "application/json" });
        response.end('{"error": "environment variable SM_PG_SECRET_ID is not set"}');
        return;
      }

      if (!existsSync("/var/run/secrets/codeengine.cloud.ibm.com/compute-resource-token/token")) {
        console.error("Mounting the trusted profile compute resource token is not enabled");
        response.writeHead(500, { "Content-Type": "application/json" });
        response.end('{"error": "Mounting the trusted profile compute resource token is not enabled"}');
        return;
      }

      response.writeHead(200, { "Content-Type": "application/json" });
      response.end('{"status": "ok"}');
      return;
    }

    //
    // Ingestion endpoint
    if (request.url == "/cos-to-sql") {
      const body = await getBody(request);
      console.log(`request body: '${body}'`);
      console.log(`request headers: '${JSON.stringify(request.headers)}`);

      //
      // assess whether the jobrun execution contains information about the COS file that got updated
      if (!body) {
        console.log("Request does not contain any event data");
        response.writeHead(400, { "Content-Type": "application/json" });
        response.end('{"error": "request does not contain any event data"}');
        return;
      }
      const eventData = JSON.parse(body);
      console.log(`eventData: '${JSON.stringify(eventData)}'`);

      //
      // make sure that the event relates to a COS write operation
      if (eventData.notification.event_type !== "Object:Write") {
        console.log(`COS operation '${eventData.notification.event_type}' does not match expectations 'Object:Write'`);
        response.writeHead(400, { "Content-Type": "application/json" });
        response.end(
          `{"error": "COS operation '${eventData.notification.event_type}' does not match expectations 'Object:Write'"}`
        );
        return;
      }
      if (eventData.notification.content_type !== "text/csv") {
        console.log(
          `COS update did happen on file '${eventData.key}' which is of type '${eventData.notification.content_type}' (expected type 'text/csv')`
        );
        response.writeHead(400, { "Content-Type": "application/json" });
        response.end(
          `{"error": "COS update did happen on file '${eventData.key}' which is of type '${eventData.notification.content_type}' (expected type 'text/csv')"}`
        );
        return;
      }
      console.log(`Received a COS update event on the CSV file '${eventData.key}' in bucket '${eventData.bucket}'`);

      //
      // retrieve the COS object that got updated
      console.log(`Retrieving file content of '${eventData.key}' from bucket ${eventData.bucket} ...`);
      const fileContent = await getObjectContent(cosAuthenticator, cosRegion, eventData.bucket, eventData.key);

      //
      // convert CSV to a object structure
      console.log(`Converting CSV data to a data struct ...`);
      const users = await convertCsvToDataStruct(fileContent);
      console.log(`users: ${JSON.stringify(users)}`);

      const pgClient = await getPgClient(secretsManager, smPgSecretId);

      // Do something meaningful with the data
      // https://github.com/IBM-Cloud/compose-postgresql-helloworld-nodejs/blob/master/server.js
      console.log(`Writing converted CSV data to the PostgreSQL database ...`);
      const insertOperations = [];
      users.forEach((userToAdd) => {
        insertOperations.push(addUser(pgClient, userToAdd.Firstname, userToAdd.Lastname));
      });

      // Wait for all SQL insert operations to finish
      console.log(`Waiting for all SQL INSERT operations to finish ...`);
      await Promise.all(insertOperations)
        .then((results) => {
          results.forEach((result, idx) =>
            console.log(`Added ${JSON.stringify(users[idx])} -> ${JSON.stringify(result)}`)
          );
          console.info("COMPLETED");
          return Promise.resolve();
        })
        .catch((err) => {
          console.error("Failed to add users to the database", err);
          console.info("FAILED");
          return Promise.reject();
        });

      console.log(`Insertions done!`);
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(`{"status": "done"}`);
      return;
    }

    //
    // Endpoint that drops the users table
    if (request.url == "/clear") {
      const pgClient = await getPgClient(secretsManager, smPgSecretId);
      await deleteUsers(pgClient);
      console.log(`Deletions done!`);
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(`{"status": "done"}`);
      return;
    }

    //
    // Default http endpoint, which prints a simple hello world
    const pgClient = await getPgClient(secretsManager, smPgSecretId);
    const allUsers = await listUsers(pgClient);
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ users: allUsers.rows }));
  })
  .listen(8080);

console.log("Server running at http://0.0.0.0:8080/");

process.on("SIGTERM", () => {
  console.info("SIGTERM signal received.");
  server.close(() => {
    console.log("Http server closed.");

    if (_pgClient) {
      _pgClient.end();
      console.log("PG client ended.");
    }
  });
});

async function getObjectContent(authenticator, region, bucket, key) {
  const fn = "getObjectContent ";
  const startTime = Date.now();
  console.log(`${fn} > region: '${region}', bucket: '${bucket}', key: '${key}'`);

  // prepare the request to download the content of a file
  const requestOptions = {
    method: "GET",
  };

  // authenticate the request
  await authenticator.authenticate(requestOptions);

  // perform the request
  const response = await fetch(
    `https://s3.direct.${region}.cloud-object-storage.appdomain.cloud/${bucket}/${key}`,
    requestOptions
  );

  if (response.status !== 200) {
    const err = new Error(`Unexpected status code: ${response.status}`);
    console.log(`${fn} < failed - error: ${err.message}; duration ${Date.now() - startTime} ms`);
    return Promise.reject(err);
  }

  // read the response
  const responseBody = await response.text();

  console.log(`${fn} < done - duration ${Date.now() - startTime} ms`);
  return responseBody;
}

function convertCsvToDataStruct(csvContent) {
  return new Promise((resolve) => {
    // the result to return
    const results = [];

    // create a new readable stream
    var readableStream = new Readable();

    // the CSV parser consumes the stream
    readableStream
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => {
        console.log(`converted CSV data: ${JSON.stringify(results)}`);

        resolve(results);
      });

    // push the CSV file content to the stream
    readableStream.push(csvContent);
    readableStream.push(null); // indicates end-of-file
  });
}

function connectDb(connectionString, caCert) {
  return new Promise((resolve, reject) => {
    const postgreConfig = pgConnectionString.parse(connectionString);

    // Add some ssl
    postgreConfig.ssl = {
      ca: caCert,
    };

    // set up a new client using our config details
    let client = new pg.Client(postgreConfig);

    client.connect((err) => {
      if (err) {
        console.error(`Failed to connect to postgreSQL host '${postgreConfig.host}'`, err);
        return reject(err);
      }

      client.query(
        "CREATE TABLE IF NOT EXISTS users (firstname varchar(256) NOT NULL, lastname varchar(256) NOT NULL)",
        (err, result) => {
          if (err) {
            console.log(`Failed to create PostgreSQL table 'users'`, err);
            return reject(err);
          }
          console.log(
            `Established PostgreSQL client connection to '${postgreConfig.host}' - user table init: ${JSON.stringify(
              result
            )}`
          );
          return resolve(client);
        }
      );
    });
  });
}

async function getPgClient(secretsManager, secretId) {
  const fn = "getPgClient ";
  const startTime = Date.now();
  console.log(`${fn} >`);

  // Check whether the pg client had been initialized already
  if (_pgClient) {
    console.log(`${fn} < from local cache`);
    return Promise.resolve(_pgClient);
  }

  console.log(`Fetching secret '${secretId}' ...`);
  // Use the Secrets Manager API to get the secret using the secret ID
  const res = await secretsManager.getSecret({
    id: secretId,
  });
  console.log(`Secret '${secretId}' fetched in ${Date.now() - startTime} ms`);

  //
  // Connect to PostgreSQL
  // https://node-postgres.com/
  console.log(
    `Establishing connection to PostgreSQL database using SM secret '${res.result.name}' (last updated: '${res.result.updated_at}') ...`
  );
  const pgCaCert = Buffer.from(res.result.credentials.connection.postgres.certificate.certificate_base64, "base64");
  const pgConnectionString = res.result.credentials.connection.postgres.composed[0];
  _pgClient = await connectDb(pgConnectionString, pgCaCert);

  console.log(`${fn} < done - duration ${Date.now() - startTime} ms`);
  return _pgClient;
}

function addUser(client, firstName, lastName) {
  const fn = "addUser ";
  const startTime = Date.now();
  console.log(`${fn} > firstName: '${firstName}', lastName: '${lastName}'`);
  return new Promise(function (resolve, reject) {
    const queryText = "INSERT INTO users(firstname,lastname) VALUES($1, $2)";
    client.query(queryText, [firstName, lastName], function (error, result) {
      if (error) {
        console.log(`${fn} < failed - error: ${error}; duration ${Date.now() - startTime} ms`);
        return reject(error);
      }
      console.log(`${fn} < succeeded - duration ${Date.now() - startTime} ms`);
      return resolve(result);
    });
  });
}

function listUsers(client) {
  const fn = "listUsers ";
  const startTime = Date.now();
  console.log(`${fn} >`);
  return new Promise(function (resolve, reject) {
    const queryText = "SELECT * FROM users";
    client.query(queryText, undefined, function (error, result) {
      if (error) {
        console.log(`${fn} < failed - error: ${error}; duration ${Date.now() - startTime} ms`);
        return reject(error);
      }
      console.log(`${fn} < succeeded - duration ${Date.now() - startTime} ms`);
      return resolve(result);
    });
  });
}
function deleteUsers(client) {
  const fn = "deleteUsers ";
  const startTime = Date.now();
  console.log(`${fn} >`);
  return new Promise(function (resolve, reject) {
    const queryText = "DELETE FROM users";
    client.query(queryText, undefined, function (error, result) {
      if (error) {
        console.log(`${fn} < failed - error: ${error}; duration ${Date.now() - startTime} ms`);
        return reject(error);
      }
      console.log(`${fn} < succeeded - duration ${Date.now() - startTime} ms`);
      return resolve(result);
    });
  });
}

function getBody(request) {
  return new Promise((resolve) => {
    const bodyParts = [];
    let body;
    request
      .on("data", (chunk) => {
        bodyParts.push(chunk);
      })
      .on("end", () => {
        body = Buffer.concat(bodyParts).toString();
        resolve(body);
      });
  });
}
