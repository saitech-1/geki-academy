import { config } from "dotenv";
import pg from "pg";
config({ path: ".env.production.local", quiet: true });
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});
try {
  await client.connect();
  const result = await client.query(
    "SELECT current_database(), current_user, count(*)::int as tables FROM information_schema.tables WHERE table_schema=$1 GROUP BY 1,2",
    ["geki"],
  );
  console.log(JSON.stringify(result.rows));
} catch (e) {
  console.log(
    JSON.stringify({
      connected: false,
      code: e.code,
      message: e.message?.replace(/postgresql:\/\/[^\s]+/g, "[redacted]"),
    }),
  );
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
