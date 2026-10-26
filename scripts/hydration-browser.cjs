const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const fs = require("node:fs");
const root = process.env.TEST_WEB_URL || "http://127.0.0.1:3000";
assert.equal(new URL(root).hostname, "127.0.0.1", "Use a local preview");

async function checkHydration() {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CI ? {} : { channel: "chrome" }),
  });
  const problems = [];
  const results = [];
  async function context(options = {}) {
    const ctx = await browser.newContext(options);
    await ctx.route("https://fonts.googleapis.com/**", (r) => r.abort());
    if (process.env.HYDRATION_MOCK_CATALOG === "1") {
      // CI checks rendering without production database credentials. Auth/data
      // authorization has its own real Postgres + Firebase integration job.
      await ctx.route("**/api/catalog", (r) => r.fulfill({ json: [] }));
    }
    ctx.on("page", (page) => {
      page.on("pageerror", (e) => problems.push(e.message));
      page.on("console", (msg) => {
        if (
          ["error", "warning"].includes(msg.type()) &&
          /hydrat|did not match|server.rendered/i.test(msg.text())
        )
          problems.push(msg.text());
      });
    });
    return ctx;
  }
  try {
    for (const width of [1440, 390]) {
      const ctx = await context({ viewport: { width, height: 900 } });
      // Exercise delayed client chunks: no provider may mutate unhydrated HTML.
      await ctx.route("**/*.js", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        await route.continue();
      });
      const page = await ctx.newPage();
      await page.goto(root, { waitUntil: "domcontentloaded" });
      await page.locator("#about[data-scroll-reveal]").waitFor();
      const sections = page.locator("main > section.section");
      assert.equal(await sections.count(), 3);
      assert.deepEqual(
        await sections.evaluateAll((es) => es.map((e) => e.className)),
        ["section shell", "section shell", "section shell"],
      );
      await sections.last().scrollIntoViewIfNeeded();
      await page.waitForFunction(
        () =>
          Array.from(document.querySelectorAll("main > section.section")).at(-1)
            ?.dataset.scrollReveal === "visible",
      );
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.waitForFunction(() =>
        Array.from(document.querySelectorAll("main > section.section")).every(
          (e) =>
            !e.hasAttribute("data-scroll-reveal") &&
            getComputedStyle(e).opacity === "1",
        ),
      );
      await page
        .getByRole("navigation")
        .first()
        .getByRole("link", { name: "GEKI Academy home", exact: true })
        .click();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page
        .locator('a[href="/courses"]')
        .filter({ hasText: "Explore your training" })
        .click();
      await page.waitForURL("**/courses");
      await page.goBack();
      await page.locator("#about").waitFor();
      await page.reload();
      await page.locator("#about").waitFor();
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.locator("#about[data-scroll-reveal]").waitFor();
      await page.evaluate(() => window.scrollTo(0, 0));
      const overflow = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
        elements: Array.from(document.querySelectorAll("body *"))
          .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
          .slice(0, 12)
          .map((e) => ({
            tag: e.tagName,
            className: String(e.className),
            right: e.getBoundingClientRect().right,
          })),
      }));
      assert.equal(
        overflow.scroll > overflow.width,
        false,
        JSON.stringify(overflow),
      );
      fs.mkdirSync(".local/production-preview", { recursive: true });
      await page.screenshot({
        path: `.local/production-preview/home-${width}.png`,
        animations: "disabled",
      });
      results.push(
        `${width}px: delayed hydration, scroll reveal, preference change, navigation and reload passed`,
      );
      await ctx.close();
    }
    const noObserver = await context();
    await noObserver.addInitScript(() => {
      delete window.IntersectionObserver;
    });
    const fallback = await noObserver.newPage();
    await fallback.goto(root);
    assert.equal(
      await fallback
        .locator("#about")
        .evaluate((e) => getComputedStyle(e).opacity),
      "1",
    );
    assert.equal(await fallback.locator("[data-scroll-reveal]").count(), 0);
    await noObserver.close();
    const noJs = await context({ javaScriptEnabled: false });
    const ssr = await noJs.newPage();
    await ssr.goto(root);
    assert.equal(
      await ssr.locator("#about").getAttribute("class"),
      "section shell",
    );
    assert.equal(
      await ssr.locator("#about").evaluate((e) => getComputedStyle(e).opacity),
      "1",
    );
    await noJs.close();
    assert.deepEqual(
      problems,
      [],
      "Hydration and browser console must stay clean",
    );
    console.log(
      JSON.stringify({
        results,
        serverRendering: "visible without JavaScript",
        missingObserver: "visible fallback",
        hydrationErrors: problems,
      }),
    );
  } finally {
    await browser.close();
  }
}
module.exports = { checkHydration };
if (require.main === module)
  checkHydration().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
