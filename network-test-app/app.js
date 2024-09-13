const { Client } = require("pg");
const express = require("express");
const app = express()

postgresSetup = JSON.parse(process.env.DATABASES_FOR_POSTGRESQL_CONNECTION);

parsedCli = postgresSetup.cli;
parsedPostgres = postgresSetup.postgres;

const dbPort = parsedPostgres.hosts[0].port;
app.get("/", (request, response) => {
    console.log("Connecting to PostgreSQL instance...");
    try {
        // Use env variables loaded from service binding to connect to our postgres instance
        const client = new Client({
            user: parsedPostgres.authentication.username,
            password: parsedCli.environment.PGPASSWORD,
            host: parsedPostgres.hosts.hostname,
            database: parsedPostgres.database,
            port: dbPort,
        });
        client.connect();

        // Run some simple commands to verify that we connected to the postgres instance
        console.log("Insert table");
        client.query("CREATE TABLE IF NOT EXISTS myfriendships (id SERIAL PRIMARY KEY, name varchar(256) NOT NULL, created_at bigint NOT NULL, greeting text);");
    } catch (err) {
        console.error("Failed to connect to PostgreSQL instance", err);
        process.exit(1);
      }
})
    
app.listen(dbPort, () => {
    console.log('listening on localhost', dbPort)
})



    
