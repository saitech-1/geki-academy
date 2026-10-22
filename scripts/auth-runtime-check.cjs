// Match runtimes where native CommonJS require(ESM) is unavailable. A build or
// emulator-only test can otherwise miss Firebase Admin failing at module load.
const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const { createServer } = require("node:http");
const { generateKeyPairSync, sign, verify } = require("node:crypto");
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

async function main() {
  const app = initializeApp(
    { projectId: "demo-geki-runtime-check" },
    "runtime-check",
  );
  assert.equal(getAuth(app).app.options.projectId, "demo-geki-runtime-check");
  const requireFromAdmin = createRequire(require.resolve("firebase-admin/app"));
  const jwksClient = requireFromAdmin("jwks-rsa");
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const jwk = {
    ...publicKey.export({ format: "jwk" }),
    kid: "geki-test-key",
    alg: "RS256",
    use: "sig",
  };
  const server = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ keys: [jwk] }));
  });
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const client = jwksClient({
      jwksUri: `http://127.0.0.1:${server.address().port}/keys`,
      cache: false,
      rateLimit: false,
    });
    const key = await client.getSigningKey(jwk.kid);
    const message = Buffer.from("GEKI runtime signature verification fixture");
    const signature = sign("RSA-SHA256", message, privateKey);
    assert.equal(
      verify("RSA-SHA256", message, key.getPublicKey(), signature),
      true,
    );
    assert.equal(
      verify(
        "RSA-SHA256",
        Buffer.from("tampered message"),
        key.getPublicKey(),
        signature,
      ),
      false,
    );
    console.log(
      "Firebase Admin loads and RSA key verification passes without native require(ESM).",
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await deleteApp(app);
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
