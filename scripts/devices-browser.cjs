const assert = require("node:assert/strict");
const { chromium, devices } = require("playwright");
const fixture = require("../.local/qr-payment-fixture.json");
const root = "http://127.0.0.1:3000";
(async () => {
  const health = await fetch(root + "/api/health").then((r) => r.json());
  assert.equal(health.authMode, "emulator", "Local Auth only");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const desktop = await browser.newContext({
      viewport: { width: 1280, height: 850 },
      reducedMotion: "reduce",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36",
    });
    const phone = await browser.newContext({
      ...devices["iPhone 13"],
      reducedMotion: "reduce",
    });
    const third = await browser.newContext({ reducedMotion: "reduce" });
    async function login(context) {
      await context.route("https://fonts.googleapis.com/**", (r) => r.abort());
      const page = await context.newPage();
      await page.goto(root + "/signin");
      await page
        .getByLabel("Account / guardian email")
        .fill(fixture.deviceEmail);
      await page.locator("input[name=password]").fill(fixture.password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.waitForURL("**/dashboard");
      await page.goto(root + "/devices");
      await page.locator(".device-card").first().waitFor();
      return page;
    }
    const windowsPage = await login(desktop);
    assert.equal(await windowsPage.locator(".device-card").count(), 1);
    const phonePage = await login(phone);
    assert.equal(await phonePage.locator(".device-card").count(), 2);
    await phonePage.getByText("Current device", { exact: true }).waitFor();
    assert.match(
      await phonePage
        .locator(".device-card")
        .allTextContents()
        .then((es) => es.join(" ")),
      /iPhone/,
    );
    await windowsPage.reload();
    await windowsPage
      .locator(".device-card")
      .filter({ hasText: "iPhone" })
      .waitFor();
    assert.equal(await windowsPage.locator(".device-card").count(), 2);
    const thirdPage = await login(third);
    await thirdPage
      .getByText(
        "Two devices are already registered. Remove one to continue.",
        { exact: true },
      )
      .waitFor();
    assert.equal(await thirdPage.locator(".device-card").count(), 2);
    await phonePage.screenshot({
      path: ".local/devices-phone.png",
      fullPage: true,
    });
    console.log(
      "Device checks passed: Windows + iPhone visible at sign-in without playing video; current device marked; third browser cannot register.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
