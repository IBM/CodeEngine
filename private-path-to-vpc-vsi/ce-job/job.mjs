import pkg from "pg";
import { LoremIpsum } from "lorem-ipsum";

const { Client } = pkg;

console.log("Connecting to PostgreSQL instance...");

const client = new Client({
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  port: process.env.PGPORT,
});
try {
  await client.connect();

  console.log("Creating guestbook table if it does not exist...");
  await client.query(
    "CREATE TABLE IF NOT EXISTS guestbook (id SERIAL PRIMARY KEY, name varchar(256) NOT NULL, created_at bigint NOT NULL, greeting text);"
  );

  console.log("Writing into guestbook table...");
  await client.query("INSERT INTO guestbook (name,created_at,greeting) VALUES ($1,$2,$3);", [
    process.env.HOSTNAME,
    Date.now(),
    new LoremIpsum().generateWords(5),
  ]);

  if (process.env.ACTION === "cleanup") {
    console.log("Cleaning up table content...");
    await client.query("DELETE FROM guestbook;");
  }

  await client.end();
  console.log("Done!");
} catch (err) {
  console.error("Failed to connect to PostgreSQL instance", err);

  if(client) {
    try {
    await client.end();
    } catch(error) {
      // just do it
    }
  }

  process.exit(1);
}
