import pkg from "pg";
import { LoremIpsum } from "lorem-ipsum";

const { Client } = pkg;

console.log("Connecting to PostgreSQL instance...");
try {
  const client = new Client({
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    port: process.env.PGPORT,
  });
  await client.connect();

  console.log("Creating myfriendships table if it does not exist...");
  await client.query("CREATE TABLE IF NOT EXISTS myfriendships (id SERIAL PRIMARY KEY, name varchar(256) NOT NULL, created_at bigint NOT NULL, greeting text);");

  console.log("Writing into myfriendships table...");
  await client.query("INSERT INTO myfriendships (name,created_at,greeting) VALUES ($1,$2,$3);", [
    process.env.HOSTNAME,
    Date.now(),
    new LoremIpsum().generateWords(5),
  ]);

  await client.end();
  console.log("Done!");
} catch (err) {
  console.error("Failed to connect to PostgreSQL instance", err);
  process.exit(1);
}
