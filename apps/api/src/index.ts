import { app } from "./app.js";
import { config } from "./config.js";
import { db } from "./db.js";
const server = app.listen(config.port, config.host, () =>
  console.log(`GEKI API listening on http://${config.host}:${config.port}`),
);
server.requestTimeout = 30 * 60 * 1000;
async function shutdown() {
  server.close();
  await db.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
