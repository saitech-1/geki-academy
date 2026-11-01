import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { db } from "../src/server/db.js";
import { config } from "../src/server/config.js";
import { firebaseAdmin } from "../src/server/auth.js";

assert.equal(new URL(config.databaseUrl).hostname, "127.0.0.1");
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, "127.0.0.1:9099");
const email = `device-entry-${randomUUID()}@geki.local`;
const identity = await firebaseAdmin.createUser({
  email,
  password: "GekiLocal!2026",
  emailVerified: true,
});
const user = await db.user.create({
  data: {
    firebaseUid: identity.uid,
    email,
    displayName: "Device entry fixture",
    onboarded: true,
    consentAt: new Date(),
  },
});
const course = await db.course.create({
  data: {
    slug: `device-entry-${randomUUID()}`,
    title: "Device entry fixture",
    description: "Local fixture",
    status: "PUBLISHED",
    kbzPayEnabled: true,
    priceMinor: 5000000,
    currency: "MMK",
  },
});
let browser;
try {
  for (const label of ["Windows · Previous browser", "Android · Chrome"])
    await db.device.create({
      data: {
        userId: user.id,
        label,
        secretHash: createHash("sha256").update(randomUUID()).digest("hex"),
      },
    });
  browser = await chromium.launch({
    ...(process.env.CI ? {} : { channel: "chrome" }),
    headless: true,
  });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 850 },
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const root = "http://127.0.0.1:3000",
    destination = "/checkout/" + course.slug;
  await page.goto(root + "/signin?next=" + encodeURIComponent(destination));
  await page.getByLabel("Account / guardian email").fill(email);
  await page.locator("input[name=password]").fill("GekiLocal!2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("heading", {
      name: "Your two device slots are full.",
      exact: true,
    })
    .waitFor();
  assert.equal(
    await page.getByAltText("GEKI Academy KBZPay payment QR").count(),
    0,
    "Checkout must wait for a free device slot",
  );
  assert.equal(
    await db.device.count({ where: { userId: user.id, revokedAt: null } }),
    2,
  );
  await page.getByRole("link", { name: "Manage devices", exact: true }).click();
  await page.waitForURL("**/devices?next=**");
  await page
    .getByRole("button", { name: "Remove", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Remove device", exact: true })
    .click();
  await page.waitForURL(root + destination);
  await page.getByAltText("GEKI Academy KBZPay payment QR").waitFor();
  assert.equal(
    await db.device.count({ where: { userId: user.id, revokedAt: null } }),
    2,
    "Replacement must not create a third active device",
  );
  assert.equal(
    await db.device.count({
      where: { userId: user.id, revokedAt: { not: null } },
    }),
    1,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Device entry passed: third browser blocked before checkout, clear removal prompt, old device revoked, new browser registered, original checkout restored and two-device limit preserved.",
  );
} finally {
  await browser?.close();
  await db.paymentOrder.deleteMany({ where: { userId: user.id } });
  await db.user.delete({ where: { id: user.id } });
  await db.course.delete({ where: { id: course.id } });
  await firebaseAdmin.deleteUser(identity.uid);
  await db.$disconnect();
}
