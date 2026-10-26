const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
process.env.TEST_WEB_URL = "http://127.0.0.1:3005";
const { checkHydration } = require("./hydration-browser.cjs");

(async () => {
  let occupied = false;
  try {
    await fetch(process.env.TEST_WEB_URL, {
      signal: AbortSignal.timeout(1000),
    });
    occupied = true;
  } catch {}
  assert.equal(
    occupied,
    false,
    "Port 3005 must be free for the production preview check",
  );
  const server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3005",
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: "production" },
      stdio: "inherit",
      windowsHide: true,
    },
  );
  let startupError;
  server.once("error", (error) => {
    startupError = error;
  });
  try {
    let ready = false;
    const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      if (startupError) throw startupError;
      if (server.exitCode !== null)
        throw Error("Production preview exited before becoming ready");
      try {
        const response = await fetch(process.env.TEST_WEB_URL, {
          signal: AbortSignal.timeout(1000),
        });
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.ok(ready, "Production preview failed to become ready");
    await checkHydration();
  } finally {
    if (server.exitCode === null) {
      const closed = new Promise((resolve) => server.once("exit", resolve));
      server.kill("SIGTERM");
      const force = setTimeout(() => server.kill("SIGKILL"), 5000);
      await closed;
      clearTimeout(force);
    }
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
