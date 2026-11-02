import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import { db } from "../src/server/db.js";
import { config } from "../src/server/config.js";
import { firebaseAdmin } from "../src/server/auth.js";
assert.equal(new URL(config.databaseUrl).hostname, "127.0.0.1");
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, "127.0.0.1:9099");
const email = `thumbnail-${randomUUID()}@geki.local`;
const identity = await firebaseAdmin.createUser({
  email,
  password: "GekiLocal!2026",
  emailVerified: true,
});
const user = await db.user.create({
  data: {
    firebaseUid: identity.uid,
    email,
    displayName: "Thumbnail fixture",
    role: "ADMIN",
    onboarded: true,
    consentAt: new Date(),
  },
});
const course = await db.course.create({
  data: {
    slug: `thumbnail-${randomUUID()}`,
    title: "Thumbnail upload fixture",
    description: "Local test",
    thumbnail: "/images/hero.jpg",
  },
});
let browser;
try {
  const root = "http://127.0.0.1:3000",
    path = `/api/admin/courses/${course.id}/thumbnail`;
  assert.equal(
    (
      await fetch(root + path, {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: "invalid",
      })
    ).status,
    401,
  );
  browser = await chromium.launch({
    ...(process.env.CI ? {} : { channel: "chrome" }),
    headless: true,
    args: [
      "--disable-gpu",
      "--renderer-process-limit=1",
      "--js-flags=--max-old-space-size=160",
    ],
  });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 850 },
    reducedMotion: "reduce",
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(root + "/signin");
  await page.getByLabel("Account / guardian email").fill(email);
  await page.locator("input[name=password]").fill("GekiLocal!2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard");
  await page.goto(root + "/admin/courses/" + course.id);
  await page
    .getByLabel("Upload course thumbnail", { exact: true })
    .setInputFiles({
      name: "course-cover.jpg",
      mimeType: "image/jpeg",
      buffer: await readFile("public/images/hero.jpg"),
    });
  await page
    .getByText("Image uploaded. Save the course to apply it.", { exact: true })
    .waitFor();
  const uploaded = await page
    .getByAltText("Course thumbnail preview")
    .getAttribute("src");
  assert.match(uploaded!, /^\/api\/course-thumbnails\/[a-f0-9-]+\.webp$/);
  const publicImage = await fetch(root + uploaded);
  assert.equal(publicImage.status, 200);
  assert.match(publicImage.headers.get("content-type")!, /image\/webp/);
  await page.getByRole("button", { name: "Save course", exact: true }).click();
  await page.getByText("Saved to the database.", { exact: true }).waitFor();
  await page.reload();
  await page.getByAltText("Course thumbnail preview").waitFor();
  assert.equal(
    await page.getByAltText("Course thumbnail preview").getAttribute("src"),
    uploaded,
  );
  assert.equal(
    (await db.course.findUniqueOrThrow({ where: { id: course.id } })).thumbnail,
    uploaded,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page
    .locator(".thumbnail-upload")
    .screenshot({ path: ".local/course-thumbnail-mobile.png" });
  await page
    .getByLabel("Upload course thumbnail", { exact: true })
    .setInputFiles({
      name: "fake.png",
      mimeType: "image/png",
      buffer: Buffer.from("not an image"),
    });
  await page
    .getByText("Choose a valid, non-animated JPG, PNG or WebP image.", {
      exact: true,
    })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "Thumbnail upload passed: admin-only API, device image selection, public optimized image, preview, database save/reload, invalid image rejection and mobile layout.",
  );
} finally {
  await browser?.close();
  await db.course.delete({ where: { id: course.id } });
  await db.user.delete({ where: { id: user.id } });
  await firebaseAdmin.deleteUser(identity.uid);
  await db.$disconnect();
}
