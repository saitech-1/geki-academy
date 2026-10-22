import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// These tests create purchases and users. Never accept a hosted database or live Auth.
const database = new URL(process.env.DATABASE_URL || "postgresql://invalid");
assert.equal(database.hostname, "127.0.0.1", "CI requires loopback PostgreSQL");
assert.equal(
  database.pathname,
  "/geki_ci",
  "CI requires its disposable geki_ci database",
);
assert.equal(process.env.FIREBASE_PROJECT_ID, "demo-geki-academy");
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, "127.0.0.1:9099");
assert.equal(process.env.NODE_ENV, "test");
assert.equal(process.env.MEDIA_MODE, "local");
assert.equal(process.env.UPLOAD_DIR, ".local/ci-uploads");
assert.equal(process.env.PORT, "3000");
assert.equal(process.env.HOST, "127.0.0.1");

const root = fileURLToPath(new URL("../", import.meta.url));
const health = "http://127.0.0.1:3000/api/health";
// Do not accidentally test another process or terminate an existing development API.
let occupied = false;
try {
  await fetch(health, { signal: AbortSignal.timeout(1000) });
  occupied = true;
} catch {}
assert.equal(occupied, false, "Port 3000 must be free before starting CI");

function start(script) {
  return spawn(process.execPath, ["--import", "tsx", script], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  });
}
function finished(child) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Test process failed (${signal || code})`));
    });
  });
}

await mkdir(new URL("../.local/ci-uploads", import.meta.url), {
  recursive: true,
});
await copyFile(
  new URL("../tests/fixtures/verification.webm", import.meta.url),
  new URL("../.local/verification.webm", import.meta.url),
);
await finished(start("scripts/seed.ts"));
const api = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3000",
  ],
  {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: "development",
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: "inherit",
    windowsHide: true,
  },
);
let startupError;
api.once("error", (error) => {
  startupError = error;
});
try {
  let ready = false;
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (startupError) throw startupError;
    if (api.exitCode !== null)
      throw new Error("CI API exited before becoming healthy");
    try {
      const response = await fetch(health, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(ready, "Next.js API did not become healthy within 120 seconds");
  await finished(start("scripts/integration-test.ts"));
  await finished(start("scripts/qr-payments-test.ts"));
} finally {
  if (api.exitCode === null) {
    const closed = new Promise((resolve) => api.once("exit", resolve));
    api.kill("SIGTERM");
    const force = setTimeout(() => api.kill("SIGKILL"), 5000);
    await closed;
    clearTimeout(force);
  }
}
