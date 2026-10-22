const assert = require("node:assert/strict");
const fs = require("fs");
const { chromium } = require("playwright");
const { execFileSync } = require("node:child_process");
(async () => {
  const base = process.env.TEST_WEB_URL || "http://127.0.0.1:3002";
  assert.equal(
    (await fetch("http://127.0.0.1:3000/api/health").then((r) => r.json()))
      .authMode,
    "emulator",
  );
  execFileSync(process.execPath, [
    "--import",
    "tsx",
    "scripts/prepare-locked-lessons.ts",
  ]);
  execFileSync(process.execPath, [
    "--import",
    "tsx",
    "scripts/prepare-browser-test.ts",
  ]);
  const f = JSON.parse(fs.readFileSync(".local/locked-lesson-fixture.json"));
  const buyer = JSON.parse(fs.readFileSync(".local/browser-account.json"));
  const b = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: [
      "--disable-gpu",
      "--renderer-process-limit=1",
      "--js-flags=--max-old-space-size=128",
    ],
  });
  const errors = [];
  try {
    let p = await b.newPage({ viewport: { width: 1280, height: 850 } });
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(base + "/pricing");
    await p.waitForURL("**/courses");
    assert.equal(
      await p
        .getByRole("link", { name: "Course Packages", exact: true })
        .count(),
      0,
    );
    let paidCalls = 0;
    p.on("request", (r) => {
      if (
        r.url().includes("/api/me/playback/") ||
        r.url().includes("/api/lessons/" + f.paidLessonId + "/preview")
      )
        paidCalls++;
    });
    await p.goto(base + "/lessons/" + f.paidLessonId);
    await p.getByRole("region", { name: "Locked lesson" }).waitFor();
    assert.equal(
      await p
        .getByRole("button", { name: "Start lesson", exact: true })
        .count(),
      0,
    );
    await p.screenshot({
      path: ".local/locked-lesson-guest-desktop.png",
      fullPage: true,
    });
    await p.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await p.screenshot({
      path: ".local/locked-lesson-mobile.png",
      fullPage: true,
    });
    await p.getByRole("link", { name: "Pay course fee", exact: true }).click();
    await p.waitForURL("**/checkout/" + f.slug);
    await p.getByRole("link", { name: "Sign in to continue" }).waitFor();
    await p.goto(base + "/preview/" + f.paidLessonId);
    await p.getByRole("region", { name: "Locked lesson" }).waitFor();
    assert.equal(paidCalls, 0);
    await p.goto(base + "/lessons/" + f.lessonId);
    await p.getByRole("button", { name: "Start lesson", exact: true }).click();
    await p.locator("video").waitFor();
    assert.equal(
      await p.locator("video").evaluate((el) => el.play().then(() => true)),
      true,
    );
    await p.close();
    async function signedIn(email) {
      const page = await b.newPage({ viewport: { width: 1280, height: 850 } });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base + "/signin");
      await page.getByLabel("Account / guardian email").fill(email);
      await page.locator("input[name=password]").fill("GekiLocal!2026");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.waitForURL("**/dashboard");
      return page;
    }
    p = await signedIn(f.unpaidEmail);
    await p.goto(base + "/lessons/" + f.paidLessonId);
    await p.getByRole("region", { name: "Locked lesson" }).waitFor();
    assert.equal(
      await p
        .getByRole("button", { name: "Start lesson", exact: true })
        .count(),
      0,
    );
    await p.close();
    p = await signedIn(buyer.email);
    await p.goto(base + "/lessons/" + f.paidLessonId);
    await p.getByRole("button", { name: "Start lesson", exact: true }).click();
    await p.locator("video").waitFor();
    assert.equal(
      await p.getByRole("region", { name: "Locked lesson" }).count(),
      0,
    );
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        singleCourseRoute: "passed",
        guestPaidLessonLocked: "passed",
        unpaidStudentLocked: "passed",
        previewRouteCannotBypassLock: "passed",
        lockedPageRequestsNoVideo: "passed",
        freeGuestPreview: "passed",
        purchasedCoursePlayback: "passed",
        mobileOverflow: false,
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
