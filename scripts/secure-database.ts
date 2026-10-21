import { readFile } from "node:fs/promises";
import pg from "pg";
import { config } from "../apps/api/src/config.js";
const client = new pg.Client({ connectionString: config.databaseUrl });
try {
  await client.connect();
  await client.query(
    await readFile(
      new URL("../database-security.sql", import.meta.url),
      "utf8",
    ),
  );
  console.log("Private application schema secured.");
} finally {
  await client.end();
}
