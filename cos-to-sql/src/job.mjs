// library needed to materialize the authentication to COS and to SecretsManager
// and to read service credentials from SecretsManager
import { ContainerAuthenticator } from "ibm-cloud-sdk-core";
import SecretsManager from "@ibm-cloud/secrets-manager/secrets-manager/v2.js";

// library to convert CSV content into a object structure
import csv from "csv-parser";
import { Readable } from "stream";

// library to access PostgreSQL
import pg from "pg";
import pgConnectionString from "pg-connection-string";

console.info("Starting CSV to SQL conversion ...");

const run = async () => {
  //
  // assess whether the jobrun execution contains information about the COS file that got updated
  if (!process.env.CE_DATA) {
    console.log("< ABORT - job does not contain any event data");
    return process.exit(1);
  }
  const eventData = JSON.parse(process.env.CE_DATA);
  console.log(`eventData: '${JSON.stringify(eventData)}'`);

  //
  // make sure that the event relates to a COS write operation
  if (eventData.operation !== "Object:Write") {
    console.log(`< ABORT - COS operation '${eventData.operation}' does not match expectations 'Object:Write'`);
    return process.exit(1);
  }
  if (eventData.notification.content_type !== "text/csv") {
    console.log(
      `< ABORT - COS update did happen on file '${eventData.key}' which is of type '${eventData.notification.content_type}' (expected type 'text/csv')`
    );
    return process.exit(1);
  }
  console.log(`Received a COS update event on the CSV file '${eventData.key}' in bucket '${eventData.bucket}'`);

  const cosRegion = process.env.COS_REGION;
  if (!cosRegion) {
    console.error("environment variable COS_REGION is not set");
    process.exit(1);
  }

  const cosTrustedProfileName = process.env.COS_TRUSTED_PROFILE_NAME;
  if (!cosTrustedProfileName) {
    console.error("environment variable COS_TRUSTED_PROFILE_NAME is not set");
    process.exit(1);
  }

  // create an authenticator to access the COS instance based on a trusted profile
  const cosAuthenticator = new ContainerAuthenticator({
    iamProfileName: cosTrustedProfileName,
  });

  //
  // retrieve the COS object that got updated
  console.log(`Retrieving file content of '${eventData.key}' from bucket ${eventData.bucket} ...`);
  const fileContent = await getObjectContent(cosAuthenticator, cosRegion, eventData.bucket, eventData.key);

  //
  // convert CSV to a object structure
  console.log(`Converting CSV data to a data struct ...`);
  const users = await convertCsvToDataStruct(fileContent);
  console.log(`users: ${JSON.stringify(users)}`);

  const smTrustedProfileName = process.env.SM_TRUSTED_PROFILE_NAME;
  if (!smTrustedProfileName) {
    console.error("environment variable SM_TRUSTED_PROFILE_NAME is not set");
    process.exit(1);
  }

  const smServiceURL = process.env.SM_SERVICE_URL;
  if (!smServiceURL) {
    console.error("environment variable SM_SERVICE_URL is not set");
    process.exit(1);
  }

  // create an authenticator to access the SecretsManager instance based on a trusted profile
  const smAuthenticator = new ContainerAuthenticator({
    iamProfileName: smTrustedProfileName,
  });

  // Create an instance of the SDK by providing an authentication mechanism and your Secrets Manager instance URL
  const secretsManager = new SecretsManager({
    authenticator: smAuthenticator,
    serviceUrl: smServiceURL,
  });

  const smPgSecretId = process.env.SM_PG_SECRET_ID;
  if (!smPgSecretId) {
    console.error("environment variable SM_PG_SECRET_ID is not set");
    process.exit(1);
  }

  // Use the Secrets Manager API to get the secret using the secret ID
  const res = await secretsManager.getSecret({
    id: smPgSecretId,
  });

  console.log(`Secret '${smPgSecretId}' content: '${JSON.stringify(res.result)}'`);

  //
  // Connect to PostgreSQL
  // https://node-postgres.com/
  console.log(`Establishing connection to PostgreSQL database using SM secret '${res.result.name}' (last updated: '${res.result.updated_at}') ...`);
  const pgCaCert = Buffer.from(res.result.credentials.connection.postgres.certificate.certificate_base64, "base64");
  const pgConnectionString = res.result.credentials.connection.postgres.composed[0];
  const pgClient = await connectDb(pgConnectionString, pgCaCert);

  // Do something meaningful with the data
  // https://github.com/IBM-Cloud/compose-postgresql-helloworld-nodejs/blob/master/server.js
  console.log(`Writing converted CSV data to the PostgreSQL database ...`);
  const insertOperations = [];
  users.forEach((userToAdd) => {
    insertOperations.push(addUser(pgClient, userToAdd.Firstname, userToAdd.Lastname));
  });

  // Wait for all SQL insert operations to finish
  console.log(`Waiting for all SQL INSERT operations to finish ...`);
  Promise.all(insertOperations)
    .then((results) => {
      results.forEach((result, idx) => console.log(`Added ${JSON.stringify(users[idx])} -> ${JSON.stringify(result)}`));
      console.info("COMPLETED");
    })
    .catch((err) => {
      console.error("Failed to add users to the database", err);
      console.info("FAILED");
    });
};
run();

async function getObjectContent(authenticator, region, bucket, key) {
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
    console.error(`Unexpected status code: ${response.status}`);
    process.exit(1);
  }

  // read the response
  const responseBody = await response.text();

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

function addUser(client, firstName, lastName) {
  return new Promise(function (resolve, reject) {
    const queryText = "INSERT INTO users(firstname,lastname) VALUES($1, $2)";
    client.query(queryText, [firstName, lastName], function (error, result) {
      if (error) {
        return reject(error);
      }
      return resolve(result);
    });
  });
}
