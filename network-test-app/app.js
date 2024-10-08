const { Client } = require("pg");
const express = require("express");
const app = express()
const timeoutMs = 15000 // timeout in 15 seconds
const port = process.env.PORT;

app.get("/", async (request, response) => {
    pgServiceCredentials = process.env.DATABASES_FOR_POSTGRESQL_CONNECTION
    if(!!pgServiceCredentials){
        /* 
            Postgres service credentials have been configured properly, 
            continue with attempting to connect to service
        */
        try {
            // Use env variables loaded from service binding to connect to our postgres instance
            console.log("Connecting to PostgreSQL instance...");
            
            postgresSetup = JSON.parse(pgServiceCredentials);
            cli = postgresSetup.cli;
            postgres = postgresSetup.postgres;
            cert = Buffer.from(postgres.certificate.certificate_base64, 'base64').toString('utf8');

            const client = new Client({
                user: postgres.authentication.username,
                password: cli.environment.PGPASSWORD,
                host: postgres.hosts[0].hostname,
                database: postgres.database,
                port: postgres.hosts[0].port,
                statement_timeout: timeoutMs,
                query_timeout: timeoutMs,
                lock_timeout: timeoutMs,
                application_name: "network-test-app",
                connectionTimeoutMillis: timeoutMs,
                ssl: {
                    ca: cert,
                    rejectUnauthorized: true,
                },
            });
            await client.connect();
    
            // Run a simple command to verify that we connected to the postgres instance
            console.log("List tables");
            result = await client.query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE';");
            console.log(result)
            await client.end()
            response.status(200).send("Successfully connected to postgres instance");
        } catch (err) {
            console.error("Failed to connect to PostgreSQL instance", err);
            response.status(500).send("Could not connect to postgres instance:", err);
          }
    } else {
        response.status(500).send("Could not connect to postgres instance: no postgres instance configured");
    }
    
    
})
    
const server = app.listen(port, async () => {
    console.log('listening on localhost', port)
})

process.on('SIGTERM', () => {
    console.info('SIGTERM signal received.');
    server.close(() => {
        console.log('Http server closed.');
    });
});



    
