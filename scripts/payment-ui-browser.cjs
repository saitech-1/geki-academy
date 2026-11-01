const assert = require("node:assert/strict");
const { chromium } = require("playwright");
(async () => {
  const root = "http://127.0.0.1:3000";
  assert.equal(
    (await fetch(root + "/api/health").then((r) => r.json())).authMode,
    "emulator",
  );
  const browser = await chromium.launch({
    ...(process.env.CI ? {} : { channel: "chrome" }),
    headless: true,
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 850 },
      reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(root + "/signin");
    await page.getByLabel("Account / guardian email").fill("admin@geki.local");
    await page.locator("input[name=password]").fill("GekiLocal!2026");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL("**/dashboard");
    await page.goto(root + "/admin/payments");
    await page
      .locator(".payment-metric strong")
      .first()
      .filter({ hasText: /\d/ })
      .waitFor();
    await page
      .getByRole("button", { name: "Review payment", exact: true })
      .first()
      .waitFor();
    for (const width of [1280, 768, 390]) {
      await page.setViewportSize({ width, height: 850 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        "Page must fit its viewport",
      );
      assert.equal(
        await page.locator(".payment-review-table").evaluate((element) => {
          const boundary = element.getBoundingClientRect();
          return [...element.querySelectorAll("button")].every(
            (button) =>
              button.getBoundingClientRect().right <= boundary.right + 1,
          );
        }),
        true,
        `Review controls must stay visible, not clipped inside the table at ${width}px`,
      );
      await page.screenshot({
        path: `.local/payment-overview-${width}.png`,
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 1280, height: 850 });
    await page
      .getByRole("button", { name: "Notifications", exact: true })
      .click();
    await page.locator(".notification-center").waitFor();
    await page
      .getByRole("button", { name: "Mark all read", exact: true })
      .click();
    await page.locator(".notification-count").waitFor({ state: "hidden" });
    await page.locator(".notification-center-item").waitFor({ state: "hidden" });
    await page.getByText("You’re all caught up.", { exact: true }).waitFor();
    await page.screenshot({ path: ".local/payment-notifications-laptop.png" });
    assert.deepEqual(errors, []);
    console.log(
      "Payment UI passed: 1280/768/390 layouts, visible review actions, notification center, mark-all-read and no browser errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
