import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";

assert.ok(
  process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY,
  "Set SUPABASE_URL and SUPABASE_SECRET_KEY in the private environment file first.",
);
const client = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const name = "geki-payment-receipts";
const existing = await client.storage.getBucket(name);
if (!existing.data) {
  const created = await client.storage.createBucket(name, {
    public: false,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/png", "image/jpeg"],
  });
  assert.equal(
    created.error,
    null,
    "Could not create private receipt bucket. Check the project URL, server secret key and Storage quota.",
  );
}
const bucket = await client.storage.getBucket(name);
assert.equal(bucket.data?.public, false, "Receipt bucket must be private.");
assert.equal(bucket.error, null);
const settings = await client.storage.updateBucket(name, {
  public: false,
  fileSizeLimit: 5 * 1024 * 1024,
  allowedMimeTypes: ["image/png", "image/jpeg"],
});
assert.equal(settings.error, null, "Could not set receipt file restrictions.");
const path = `verification/${randomUUID()}.png`;
const bytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9J0AAAAASUVORK5CYII=",
  "base64",
);
const api = client.storage.from(name);
try {
  const signed = await api.createSignedUploadUrl(path, { upsert: false });
  assert.equal(signed.error, null);
  assert.ok(signed.data);
  const upload = await fetch(signed.data.signedUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/png" },
    body: bytes,
  });
  assert.ok(upload.ok, "Signed receipt upload failed.");
  const downloaded = await api.download(path);
  assert.equal(downloaded.error, null);
  assert.deepEqual(Buffer.from(await downloaded.data!.arrayBuffer()), bytes);
  const publicUrl = api.getPublicUrl(path).data.publicUrl;
  assert.equal(
    (await fetch(publicUrl)).ok,
    false,
    "Anonymous receipt access must be denied.",
  );
  console.log(
    "Private receipt storage verified: signed upload, authorized read, anonymous access denied.",
  );
} finally {
  const cleanup = await api.remove([path]);
  assert.equal(cleanup.error, null, "Verification object cleanup failed.");
}
