const assert = require("node:assert/strict");
const fs = require("fs");
const { chromium } = require("playwright");
(async () => {
  const h = await fetch("http://127.0.0.1:3000/api/health").then((r) =>
    r.json(),
  );
  assert.equal(h.authMode, "emulator");
  const f = JSON.parse(fs.readFileSync(".local/qr-payment-fixture.json"));
  const root = process.env.TEST_WEB_URL || "http://127.0.0.1:3000";
  const b = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: [
      "--disable-gpu",
      "--renderer-process-limit=1",
      "--js-flags=--max-old-space-size=128",
    ],
  });
  try {
    let student = await b.newPage({
      viewport: { width: 1280, height: 850 },
      reducedMotion: "reduce",
    });
    const errors = [];
    await student.route("https://fonts.googleapis.com/**", (r) => r.abort());
    student.on("pageerror", (e) => errors.push(e.message));
    async function login(p, email) {
      await p.route("https://fonts.googleapis.com/**", (r) => r.abort());
      await p.goto(root + "/signin");
      await p.getByLabel("Account / guardian email").fill(email);
      await p.locator("input[name=password]").fill("GekiLocal!2026");
      await p.getByRole("button", { name: "Sign in", exact: true }).click();
      await p.waitForURL("**/dashboard");
    }
    await login(student, f.email);
    await student.goto(root + "/checkout/" + f.slug);
    await student.getByAltText("GEKI Academy KBZPay payment QR").waitFor();
    assert.equal(
      await student.locator('input[name="transactionId"]').count(),
      0,
    );
    await student
      .getByLabel("Payment screenshot", { exact: true })
      .setInputFiles({
        name: "local-receipt-fixture.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.concat([
          fs.readFileSync("public/images/hero.jpg"),
          Buffer.from("local-fixture-" + Date.now()),
        ]),
      });
    await student
      .getByRole("button", { name: "Submit screenshot for review" })
      .click();
    await student.getByRole("heading", { name: "Receipt received." }).waitFor();
    await student.reload();
    await student.getByRole("heading", { name: "Receipt received." }).waitFor();
    await student.screenshot({
      path: ".local/qr-pending-desktop.png",
      fullPage: true,
    });
    await student.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await student.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await student.screenshot({
      path: ".local/qr-payment-mobile.png",
      fullPage: true,
    });
    await student.close();
    const admin = await b.newPage({
      viewport: { width: 1280, height: 850 },
      reducedMotion: "reduce",
    });
    admin.on("pageerror", (e) => errors.push(e.message));
    await login(admin, "admin@geki.local");
    await admin.goto(root + "/admin/payments");
    const row = admin.getByRole("row").filter({ hasText: f.email });
    await row.getByRole("button", { name: "Review payment" }).click();
    await admin.getByAltText("Submitted KBZPay payment receipt").waitFor();
    const approve = admin.getByRole("button", {
      name: "Confirm payment & unlock course",
    });
    assert.equal(await approve.isDisabled(), true);
    await admin
      .getByLabel(
        "I verified this successful incoming transaction in KBZPay and the amount and recipient match this order.",
      )
      .check();
    await admin
      .getByLabel("Incoming KBZPay reference (admin only)")
      .fill("BROWSERQR" + Date.now());
    await admin
      .getByLabel("Review reason", { exact: true })
      .fill("Local test fixture only; no real money received or transferred.");
    await admin.screenshot({ path: ".local/qr-admin-review.png" });
    await approve.click();
    await admin.locator("dialog[open]").waitFor({ state: "hidden" });
    await admin.close();
    student = await b.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    student.on("pageerror", (e) => errors.push(e.message));
    await login(student, f.email);
    await student.goto(root + "/checkout/" + f.slug);
    await student
      .getByRole("heading", { name: "Your course is ready." })
      .waitFor({ timeout: 15000 });
    await student.goto(root + "/purchases");
    await student
      .getByRole("link", { name: "Open course", exact: true })
      .waitFor();
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        qrCheckout: "passed",
        receiptUploadAndReload: "passed",
        mobileOverflow: false,
        verifiedAdminReview: "passed",
        approvalUnlock: "passed",
        browserErrors: errors,
      }),
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
