import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { db } from "../src/server/db.js";
import { config } from "../src/server/config.js";
import { firebaseAdmin } from "../src/server/auth.js";
assert.equal(new URL(config.databaseUrl).hostname, "127.0.0.1");
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, "127.0.0.1:9099");
const email = `direct-browser-${randomUUID()}@geki.local`;
const identity = await firebaseAdmin.createUser({
  email,
  password: "GekiLocal!2026",
  emailVerified: true,
});
const user = await db.user.create({
  data: {
    firebaseUid: identity.uid,
    email,
    displayName: "Direct upload fixture",
    role: "STUDENT",
    onboarded: true,
    consentAt: new Date(),
  },
});
let browser,
  videoId = "",
  phase = "NONE",
  transfers = 0,
  legacyRequests = 0,
  created = 0;
const sessionId = randomUUID();
try {
  const root = "http://127.0.0.1:3000";
  assert.equal(
    (
      await fetch(root + "/api/admin/videos/fixture/upload-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
    ).status,
    401,
  );
  const login = (await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: "GekiLocal!2026",
        returnSecureToken: true,
      }),
    },
  ).then((r) => r.json())) as { idToken: string };
  assert.equal(
    (
      await fetch(root + "/api/admin/videos/fixture/upload-session", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + login.idToken,
          "Content-Type": "application/json",
        },
        body: "{}",
      })
    ).status,
    403,
  );
  await db.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  browser = await chromium.launch({
    ...(process.env.CI ? {} : { channel: "chrome" }),
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 850 },
    reducedMotion: "reduce",
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (req) => {
    const path = new URL(req.url()).pathname;
    if (req.method() === "POST" && path.endsWith("/upload")) legacyRequests++;
    if (req.method() === "POST" && path === "/api/admin/videos") created++;
  });
  await page.route("**/api/admin/streaming", (route) =>
    route.fulfill({ json: { enabled: true, configured: true } }),
  );
  await page.route("**/api/admin/videos/*/upload-session**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    const id = path.split("/")[4]!;
    videoId = id;
    if (request.method() === "GET") {
      if (phase === "READY")
        await db.video.update({ where: { id }, data: { status: "REVIEW" } });
      return route.fulfill({
        json: {
          status: phase,
          sessionId,
          filename: "Large training.webm",
          size: 6 * 1024 * 1024,
        },
      });
    }
    assert.ok(
      request.postData()!.length < 1000,
      "App requests must contain metadata only",
    );
    if (path.endsWith("/complete")) {
      phase = "PROCESSING";
      const video = await db.video.update({
        where: { id },
        data: { status: "PROCESSING", providerAssetId: "fixture-direct-asset" },
        include: {
          subtitles: true,
          _count: { select: { lessons: true, progress: true } },
        },
      });
      return route.fulfill({ json: { status: phase, sessionId, video } });
    }
    phase = "UPLOADING";
    await db.video.update({ where: { id }, data: { status: "PROCESSING" } });
    return route.fulfill({
      json: {
        status: phase,
        sessionId,
        clientPayload: {
          uploadLink: "https://fixture.s3.amazonaws.com/",
          key: "restricted-fixture",
          policy: "fixture",
          "x-amz-signature": "fixture",
        },
      },
    });
  });
  await page.route("https://fixture.s3.amazonaws.com/**", async (route) => {
    if (route.request().method() === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST,OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    transfers++;
    assert.ok(route.request().postDataBuffer()!.length > 6 * 1024 * 1024);
    assert.equal(route.request().headers().authorization, undefined);
    return route.fulfill({
      status: transfers === 1 ? 500 : 201,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: "",
    });
  });
  await page.goto(root + "/signin");
  await page.getByLabel("Account / guardian email").fill(email);
  await page.locator("input[name=password]").fill("GekiLocal!2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard");
  await page.goto(root + "/admin/videos");
  await page.getByRole("button", { name: "Add video", exact: true }).click();
  const source = await readFile("tests/fixtures/verification.webm");
  const large = Buffer.concat([
    source,
    Buffer.alloc(6 * 1024 * 1024 - source.length),
  ]);
  await page
    .getByLabel("Choose video from your computer")
    .setInputFiles({
      name: "Large training.webm",
      mimeType: "video/webm",
      buffer: large,
    });
  await page
    .getByRole("button", { name: "Create & upload video", exact: true })
    .click();
  await page
    .getByText(
      "The video provider rejected the file transfer. Retry or check your provider dashboard.",
      { exact: true },
    )
    .waitFor();
  await page
    .getByRole("button", { name: "Retry selected file", exact: true })
    .click();
  await page
    .getByText(
      "File transferred. Provider verification and protected encoding are in progress.",
      { exact: true },
    )
    .waitFor();
  await page
    .getByText("File received — protected encoding in progress", {
      exact: true,
    })
    .waitFor();
  await page.screenshot({ path: ".local/direct-video-upload-processing.png" });
  phase = "READY";
  await page
    .getByRole("button", { name: "Check upload status", exact: true })
    .click();
  await page
    .getByText("Protected video ready — subtitle review required", {
      exact: true,
    })
    .waitFor();
  assert.equal(transfers, 2);
  assert.equal(legacyRequests, 0);
  assert.equal(created, 1);
  assert.deepEqual(errors, []);
  console.log(
    "Direct upload browser passed: 6 MB file, no legacy upload request, metadata-only authorization, injected transfer failure, retry without duplicate video, separate processing/ready states, admin-only authorization and no browser errors. Provider transport injected.",
  );
} finally {
  await browser?.close();
  if (videoId) await db.video.delete({ where: { id: videoId } });
  await db.user.delete({ where: { id: user.id } });
  await firebaseAdmin.deleteUser(identity.uid);
  await db.$disconnect();
}
