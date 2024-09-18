const { Client } = require("pg");
const express = require("express");
const app = express()

function getEnv(name) {
    let val = process.env.name;
    if ((val === undefined) || (val === null)) {
        throw ("missing env var for " + name);
    }
    return val;
}

try {
    pgServiceCredentials = getEnv("DATABASES_FOR_POSTGRESQL_CONNECTION")
} catch (err) {
    console.log(err)
    process.exit(1)
}

/* 
    Postgres service credentials have been configured properly, 
    continue with attempting to connect to service
*/

postgresSetup = JSON.parse(pgServiceCredentials);
cli = postgresSetup.cli;
postgres = postgresSetup.postgres;

const port = process.env.PORT;

app.get("/", async (request, response) => {
    console.log("Connecting to PostgreSQL instance...");
    const cert = Buffer.from(postgres.certificate.certificate_base64, 'base64').toString('utf8');

    try {
        // Use env variables loaded from service binding to connect to our postgres instance
        const client = new Client({
            user: postgres.authentication.username,
            password: cli.environment.PGPASSWORD,
            host: postgres.hosts[0].hostname,
            database: postgres.database,
            port: postgres.hosts[0].port,
            ssl: {
                cert: cert,
                rejectUnauthorized: false,
            },
        });
        await client.connect();

        // Run some simple commands to verify that we connected to the postgres instance
        console.log("Insert table");
        result = await client.query("CREATE TABLE IF NOT EXISTS myfriendships (id SERIAL PRIMARY KEY, name varchar(256) NOT NULL, created_at bigint NOT NULL, greeting text);");
        console.log(result)
        await client.end()
        response.send("Successfully connected to postgres instance")
    } catch (err) {
        console.error("Failed to connect to PostgreSQL instance", err);
        process.exit(1);
      }
})
    
app.listen(port, async () => {
    console.log('listening on localhost', port)
})



    
