const { Client } = require("pg");
const express = require("express");
const app = express()

const port = process.env.PORT;

app.get("/", async (request, response) => {
    pgServiceCredentials = process.env.DATABASES_FOR_POSTGRESQL_CONNECTION
    if(pgServiceCredentials != "" && pgServiceCredentials != undefined){
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
                ssl: {
                    cert: cert,
                    rejectUnauthorized: false,
                },
            });
            await client.connect();
    
            // Run a simple command to verify that we connected to the postgres instance
            console.log("List tables");
            result = await client.query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE';");
            console.log(result)
            await client.end()
            response.send("Successfully connected to postgres instance")
        } catch (err) {
            console.error("Failed to connect to PostgreSQL instance", err);
            response.send("Could not connect to postgres instance")
          }
    }
    
    
})
    
app.listen(port, async () => {
    console.log('listening on localhost', port)
})



    
