// Libraries to access PostgreSQL
import pg from "pg";
const { Pool } = pg;
import pgConnectionString from "pg-connection-string";

// File that contains all data base related functionalities, like establishing a connection

let _pgPool;

/**
 * Connect to PostgreSQL
 * https://node-postgres.com/
 */ 
function connectDb(connectionString, caCert) {
  return new Promise((resolve, reject) => {
    const postgreConfig = pgConnectionString.parse(connectionString);

    // Add the ssl ca cert
    postgreConfig.ssl = {
      ca: caCert,
    };

    // set up a new client using our config details
    let pool = new Pool({ ...postgreConfig, max: 20, idleTimeoutMillis: 5000, connectionTimeoutMillis: 2000 });

    pool.query(
      "CREATE TABLE IF NOT EXISTS users (firstname varchar(256) NOT NULL, lastname varchar(256) NOT NULL, CONSTRAINT pk_users PRIMARY KEY(firstname, lastname));",
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
        return resolve(pool);
      }
    );
  });
}

export async function getPgClient(secretsManager, secretId) {
  const fn = "getPgClient ";
  const startTime = Date.now();
  console.log(`${fn} >`);

  // Check whether the pg pool had been initialized already
  if (_pgPool) {
    console.log(`${fn} < from local cache`);
    return Promise.resolve(_pgPool);
  }

  console.log(`Fetching secret '${secretId}' ...`);
  // Use the Secrets Manager API to get the secret using the secret ID
  const res = await secretsManager.getSecret({
    id: secretId,
  });
  console.log(`Secret '${secretId}' fetched in ${Date.now() - startTime} ms`);

  console.log(
    `Connecting to the DB using SM secret '${res.result.name}' (last updated: '${res.result.updated_at}') ...`
  );
  const pgCaCert = Buffer.from(res.result.credentials.connection.postgres.certificate.certificate_base64, "base64");
  const pgConnectionString = res.result.credentials.connection.postgres.composed[0];
  _pgPool = await connectDb(pgConnectionString, pgCaCert);

  _pgPool.on("error", (err) => {
    console.log("Pool received an error event", err);
  });

  console.log(`${fn} < done - duration ${Date.now() - startTime} ms`);
  return _pgPool;
}

export function addUser(client, firstName, lastName) {
  const fn = "addUser ";
  const startTime = Date.now();
  console.log(`${fn} > firstName: '${firstName}', lastName: '${lastName}'`);
  return new Promise(function (resolve, reject) {
    const queryText =
      "INSERT INTO users(firstname,lastname) VALUES($1, $2) ON CONFLICT (firstname, lastname) DO NOTHING";
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

export function listUsers(client) {
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
export function deleteUsers(client) {
  const fn = "deleteUsers ";
  const startTime = Date.now();
  console.log(`${fn} >`);
  return new Promise(function (resolve, reject) {
    const queryText = "DROP TABLE users";
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

export async function closeDBConnection() {
  if (_pgPool) {
    console.log("Draining PG pool...");
    await _pgPool.end();
    console.log("PG pool has drained.");
  }
}
