const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require("playwright");
(async () => {
  const root = "http://127.0.0.1:3000";
  assert.equal(
    (await fetch(root + "/api/health").then((r) => r.json())).authMode,
    "emulator",
  );
  const f = JSON.parse(
    fs.readFileSync(".local/academy-library-fixture.json", "utf8"),
  );
  const browser = await chromium.launch({
    ...(process.env.CI ? {} : { channel: "chrome" }),
    headless: true,
    args: [
      "--disable-gpu",
      "--renderer-process-limit=1",
      "--js-flags=--max-old-space-size=160",
    ],
  });
  const errors = [];
  try {
    const p = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    p.on("pageerror", (e) => errors.push(e.message));
    await p.route("https://fonts.googleapis.com/**", (r) => r.abort());
    await p.goto(root + "/signin");
    await p.getByLabel("Account / guardian email").fill(f.email);
    await p.locator("input[name=password]").fill(f.password);
    await p.getByRole("button", { name: "Sign in", exact: true }).click();
    await p.waitForURL("**/dashboard");
    await p.goto(root + "/my-learning");
    await p.locator(".academy-course-card[data-access=ENROLLED]").waitFor();
    assert.equal(await p.locator(".academy-course-card").count(), 1);
    await p.getByText("50%", { exact: true }).waitFor();
    const resume = await p
      .getByRole("link", { name: "Continue Learning", exact: true })
      .getAttribute("href");
    assert.match(resume, /^\/lessons\//);
    await p.reload();
    await p.getByText("50%", { exact: true }).waitFor();
    await p.screenshot({
      path: ".local/academy-library-desktop.png",
      fullPage: true,
    });
    await p.goto(root + "/academy/courses");
    await p
      .locator(".academy-course-card[data-access=PENDING_PAYMENT]")
      .waitFor();
    assert.equal(
      await p
        .locator(".academy-course-card[data-access=PAYMENT_REJECTED]")
        .count(),
      1,
    );
    assert.ok(
      (await p.locator(".academy-course-card[data-access=LOCKED]").count()) > 0,
    );
    await p
      .getByLabel("Search courses", { exact: true })
      .fill("Kata: Precision");
    assert.ok((await p.locator(".academy-course-card").count()) >= 1);
    assert.equal(
      await p
        .getByRole("link", { name: "Continue Learning", exact: true })
        .count(),
      0,
    );
    await p
      .getByLabel("Search courses", { exact: true })
      .fill("no-such-course");
    await p
      .getByRole("heading", {
        name: "No courses match your search.",
        exact: true,
      })
      .waitFor();
    await p.getByRole("button", { name: "Clear filters", exact: true }).click();
    await p.getByRole("button", { name: "Kata", exact: true }).click();
    assert.ok((await p.locator(".academy-course-card").count()) >= 1);
    assert.ok(
      (await p.locator(".academy-course-card").allTextContents()).every(
        (text) => text.includes("Kata"),
      ),
      "Filtering must exclude unrelated courses even when local fixtures are repeated",
    );
    await p.getByRole("button", { name: "All", exact: true }).click();
    for (const width of [768, 390]) {
      await p.setViewportSize({ width, height: 950 });
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `Overflow at ${width}`,
      );
      await p.screenshot({
        path: `.local/academy-library-${width}.png`,
        fullPage: true,
      });
    }
    await p.route("**/api/me/course-library?scope=owned", (r) =>
      r.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Injected unavailable API",
          code: "FIXTURE",
        }),
      }),
    );
    await p.goto(root + "/my-learning");
    await p
      .getByRole("heading", {
        name: "Your courses could not be loaded.",
        exact: true,
      })
      .waitFor();
    await p.unroute("**/api/me/course-library?scope=owned");
    await p.getByRole("button", { name: "Try again", exact: true }).click();
    await p.getByText("50%", { exact: true }).waitFor();
    let release;
    const gate = new Promise((resolve) => (release = resolve));
    await p.route("**/api/me/course-library?scope=owned", async (r) => {
      await gate;
      await r.continue();
    });
    await p.reload();
    await p.locator(".academy-course-skeleton").first().waitFor();
    release();
    await p.getByText("50%", { exact: true }).waitFor();
    await p.unroute("**/api/me/course-library?scope=owned");
    await p.screenshot({
      path: ".local/academy-library-mobile.png",
      fullPage: true,
    });
    await p.goto(root + "/admin/payments");
    await p
      .getByText("Administrator access is required.", { exact: true })
      .waitFor();
    assert.equal(
      await p
        .getByRole("button", { name: "Review payment", exact: true })
        .count(),
      0,
    );
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        ownedLibrary: true,
        persistedProgress: true,
        resume: true,
        catalogStates: true,
        searchAndFilters: true,
        responsive: [1440, 768, 390],
        errorRetry: true,
        skeleton: true,
        browserErrors: errors,
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
