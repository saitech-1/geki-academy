const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require("playwright");
const fixture = require("../.local/qr-payment-fixture.json");
const root = "http://127.0.0.1:3000";
(async () => {
  const health = await fetch(root + "/api/health").then((r) => r.json());
  assert.equal(health.authMode, "emulator", "Local accounts only");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [];
  const page = await browser.newPage({
    viewport: { width: 390, height: 900 },
    reducedMotion: "reduce",
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (/hydrat/i.test(m.text())) errors.push(m.text());
  });
  await page.route("https://fonts.googleapis.com/**", (r) => r.abort());
  try {
    await page.goto(root);
    await page.getByLabel("Interface language").selectOption("mm");
    await page
      .getByRole("heading", { level: 1 })
      .filter({ hasText: "ပညာရပ်ကို ကျွမ်းကျင်ပါစေ။" })
      .waitFor();
    assert.equal(await page.locator("html").getAttribute("lang"), "my");
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: ".local/burmese-home-mobile.png",
      fullPage: true,
    });
    await page.goto(root + "/signin");
    await page
      .getByLabel("အကောင့် / အုပ်ထိန်းသူ၏ အီးမေးလ်")
      .fill(fixture.deviceEmail);
    await page.locator("input[name=password]").fill(fixture.password);
    await page
      .getByRole("button", { name: "အကောင့်ဝင်ရန်", exact: true })
      .click();
    await page.waitForURL("**/dashboard");
    await page.getByLabel("Interface language").selectOption("mm");
    await page
      .getByRole("heading", { name: "ကျွမ်းကျင်မှုဆီသို့ ဆက်လက်လေ့လာပါ။" })
      .waitFor();
    await page.goto(root + "/checkout/" + fixture.slug);
    await page.getByAltText("GEKI Academy KBZPay payment QR").waitFor();
    assert.equal(await page.locator('input[name="transactionId"]').count(), 0);
    await page
      .getByLabel("ငွေလွှဲပြေစာပုံ", { exact: true })
      .setInputFiles({
        name: "receipt.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.concat([
          fs.readFileSync("public/images/hero.jpg"),
          Buffer.from("burmese-fixture-" + Date.now()),
        ]),
      });
    await page
      .getByRole("button", {
        name: "ပြေစာပုံကို စစ်ဆေးရန် ပေးပို့မည်",
        exact: true,
      })
      .click();
    await page
      .getByRole("heading", { name: "ပြေစာပုံ လက်ခံရရှိပါပြီ။" })
      .waitFor();
    assert.equal(
      await page.getByAltText("GEKI Academy KBZPay payment QR").count(),
      0,
      "Hide payment QR after screenshot submission to prevent duplicate payment",
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: ".local/burmese-payment-mobile.png",
      fullPage: true,
    });
    await page.goto(root + "/devices");
    await page
      .getByRole("heading", { name: "သင့်စက်ပစ္စည်းများဖြင့် လေ့လာပါ။" })
      .waitFor();
    await page.getByText("ယခုအသုံးပြုနေသော စက်", { exact: true }).waitFor();
    await page.reload();
    await page
      .getByRole("heading", { name: "သင့်စက်ပစ္စည်းများဖြင့် လေ့လာပါ။" })
      .waitFor();
    assert.equal(await page.locator("html").getAttribute("lang"), "my");
    await page.setViewportSize({ width: 1440, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.deepEqual(errors, []);
    console.log(
      "Burmese public/auth/dashboard/checkout/devices passed; language persisted; QR + screenshot only; no transaction-ID field, overflow or hydration errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
