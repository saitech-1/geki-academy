import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { db } from "../src/server/db.js";
import { config } from "../src/server/config.js";
import { firebaseAdmin } from "../src/server/auth.js";
assert.equal(new URL(config.databaseUrl).hostname, "127.0.0.1");
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, "127.0.0.1:9099");
const email = `notification-read-${randomUUID()}@geki.local`;
const identity = await firebaseAdmin.createUser({
  email,
  password: "GekiLocal!2026",
  emailVerified: true,
});
const user = await db.user.create({
  data: {
    firebaseUid: identity.uid,
    email,
    displayName: "Notification fixture",
    onboarded: true,
    consentAt: new Date(),
  },
});
let browser;
try {
  await db.notification.createMany({
    data: [1, 2].map((i) => ({
      userId: user.id,
      title: `Read fixture ${i}`,
      body: "Local verification only",
      href: "/notifications",
    })),
  });
  browser = await chromium.launch({
    ...(process.env.CI ? {} : { channel: "chrome" }),
    headless: true,
  });
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:3000/signin");
  await page.getByLabel("Account / guardian email").fill(email);
  await page.locator("input[name=password]").fill("GekiLocal!2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard");
  await page.goto("http://127.0.0.1:3000/notifications");
  await page.locator(".notification").first().waitFor();
  assert.equal(await page.locator(".notification").count(), 2);
  await page
    .getByRole("button", { name: "Mark read", exact: true })
    .first()
    .click();
  await page.waitForFunction(
    () => document.querySelectorAll(".notification").length === 1,
  );
  await page.locator(".notification-count").filter({ hasText: "1" }).waitFor();
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mark all read", exact: true })
    .click();
  await page.locator(".notification-center-empty").waitFor();
  await page.locator(".notification-count").waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("heading", { name: "You’re all caught up.", exact: true })
    .waitFor();
  await page.reload();
  await page
    .getByRole("heading", { name: "You’re all caught up.", exact: true })
    .waitFor();
  assert.equal(
    await db.notification.count({
      where: { userId: user.id, readAt: { not: null } },
    }),
    2,
    "Read records should stay stored while disappearing from the inbox",
  );
  console.log(
    "Notification read flow passed: individual removal, mark-all clearing, badge synchronization, empty state and persistence after reload.",
  );
} finally {
  await browser?.close();
  await db.notification.deleteMany({ where: { userId: user.id } });
  await db.user.delete({ where: { id: user.id } });
  await firebaseAdmin.deleteUser(identity.uid);
  await db.$disconnect();
}
