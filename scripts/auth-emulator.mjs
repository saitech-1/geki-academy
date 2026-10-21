import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
const root = fileURLToPath(new URL("../", import.meta.url));
const snapshot = fileURLToPath(
  new URL("../.local/firebase-auth", import.meta.url),
);
const cli = fileURLToPath(
  new URL(
    "../node_modules/firebase-tools/lib/bin/firebase.js",
    import.meta.url,
  ),
);
const args = [
  cli,
  "emulators:start",
  "--only",
  "auth",
  "--project",
  "demo-geki-academy",
  "--export-on-exit",
  snapshot,
];
if (
  existsSync(
    new URL(
      "../.local/firebase-auth/firebase-export-metadata.json",
      import.meta.url,
    ),
  )
)
  args.push("--import", snapshot);
const child = spawn(process.execPath, args, {
  cwd: root,
  stdio: "inherit",
  windowsHide: true,
});
// Console Ctrl+C also reaches the CLI; wait for its export instead of exiting early.
process.on("SIGINT", () => {});
process.on("SIGTERM", () => child.kill("SIGTERM"));
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
