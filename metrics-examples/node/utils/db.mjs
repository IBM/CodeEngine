import { Client } from "pg";

const pgServiceCredentials = process.env.DATABASES_FOR_POSTGRESQL_CONNECTION;
const pgTimeoutMs = 15000; // timeout in 15 seconds
let _dbClient = null;

export async function getDbClient() {
  if (!pgServiceCredentials) {
    return undefined;
  }
  
  if (_dbClient) {
    return _dbClient;
  }

  // Use env variables loaded from service binding to connect to our postgres instance
  console.log("Connecting to PostgreSQL instance...");
  postgresSetup = JSON.parse(pgServiceCredentials);
  cli = postgresSetup.cli;
  postgres = postgresSetup.postgres;
  cert = Buffer.from(postgres.certificate.certificate_base64, "base64").toString("utf8");

  // Define the client
  const client = new Client({
    user: postgres.authentication.username,
    password: cli.environment.PGPASSWORD,
    host: postgres.hosts[0].hostname,
    database: postgres.database,
    port: postgres.hosts[0].port,
    statement_timeout: pgTimeoutMs,
    query_timeout: pgTimeoutMs,
    lock_timeout: pgTimeoutMs,
    application_name: "network-test-app",
    connectionTimeoutMillis: pgTimeoutMs,
    ssl: {
      ca: cert,
      rejectUnauthorized: true,
    },
  });

  // Initiate the connection
  _dbClient = await client.connect();

  return _dbClient;
}

export async function closeDbClient() {
  try {
    if (_dbClient) {
      await _dbClient.end();
      console.log("DB connection closed.");
    }
  } catch (e) {
    console.error("Failed to close DB connection.");
  }
}
