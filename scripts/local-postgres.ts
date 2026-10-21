import EmbeddedPostgres from "embedded-postgres";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
if (process.env.NODE_ENV === "production")
  throw new Error("Embedded Postgres is for local development only.");
const databaseDir = resolve(".local/postgres");
mkdirSync(".local", { recursive: true });
const db = new EmbeddedPostgres({
  databaseDir,
  user: "geki",
  password: "geki_local_only",
  port: 5433,
  persistent: true,
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: (m) => console.error(String(m)),
});
if (!existsSync(resolve(databaseDir, "PG_VERSION"))) await db.initialise();
let alreadyRunning = false;
const probe = new pg.Client({
  host: "127.0.0.1",
  port: 5433,
  user: "geki",
  password: "geki_local_only",
  database: "postgres",
});
try {
  await probe.connect();
  alreadyRunning = true;
  await probe.end();
} catch {
  await probe.end().catch(() => {});
}
if (!alreadyRunning) await db.start();
const client = db.getPgClient();
await client.connect();
const result = await client.query(
  "SELECT 1 FROM pg_database WHERE datname='geki'",
);
if (!result.rowCount)
  await client.query(
    "CREATE DATABASE geki WITH TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'",
  );
await client.end();
console.log("Local PostgreSQL ready on 127.0.0.1:5433");
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    void db.stop().finally(() => process.exit(0));
  });
setInterval(() => {}, 60000);
