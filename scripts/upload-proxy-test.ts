import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { config } from "../apps/api/src/config.js";
if (
  config.production ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099"
)
  throw new Error("Local emulator only.");
const auth = (await fetch(
  "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@geki.local",
      password: "GekiLocal!2026",
      returnSecureToken: true,
    }),
  },
).then((r) => r.json())) as { idToken: string };
assert.ok(auth.idToken);
const headers = { Authorization: "Bearer " + auth.idToken };
const root = "http://127.0.0.1:3000/api/admin/videos";
const created = await fetch(root, {
  method: "POST",
  headers: { ...headers, "Content-Type": "application/json" },
  body: JSON.stringify({
    title: "Large proxy transport verification",
    duration: 3,
  }),
});
assert.equal(created.status, 201);
const video = (await created.json()) as { id: string };
try {
  // Header-valid transport fixture padded beyond the old 10 MB proxy limit.
  const fixture = await readFile(".local/verification.webm");
  const bytes = Buffer.concat([fixture, Buffer.alloc(12 * 1024 * 1024)]);
  const body = new FormData();
  body.append(
    "file",
    new Blob([bytes], { type: "video/webm" }),
    "proxy-fixture.webm",
  );
  body.append("duration", "3");
  const response = await fetch(root + "/" + video.id + "/upload", {
    method: "POST",
    headers,
    body,
  });
  assert.equal(response.status, 200, await response.clone().text());
  const uploaded = (await response.json()) as { localPath: string };
  assert.equal(
    (await stat(resolve(config.uploadDir, uploaded.localPath))).size,
    bytes.length,
  );
  console.log(
    JSON.stringify({ proxyUploadOver10MB: "passed", bytes: bytes.length }),
  );
} finally {
  const deleted = await fetch(root + "/" + video.id, {
    method: "DELETE",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      reason: "Remove temporary proxy transport fixture",
    }),
  });
  assert.equal(deleted.status, 200);
}
