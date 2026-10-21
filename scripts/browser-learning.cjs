const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require("playwright");
const { execFileSync } = require("node:child_process");
(async () => {
  execFileSync(process.execPath, [
    "--import",
    "tsx",
    "scripts/prepare-browser-test.ts",
  ]);
  const account = JSON.parse(
    fs.readFileSync(".local/browser-account.json", "utf8"),
  );
  const fixture = JSON.parse(
    fs.readFileSync(".local/integration-fixture.json", "utf8"),
  );
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:3000/signin");
  await page.getByLabel("Account / guardian email").fill(account.email);
  await page.locator("input[name=password]").fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard");
  await page.goto("http://127.0.0.1:3000/lessons/" + fixture.lessonId);
  await page.getByRole("button", { name: "Start lesson", exact: true }).click();
  const video = page.locator("video");
  await video.waitFor();
  const playing = await video.evaluate((el) => el.play().then(() => true));
  assert.equal(playing, true);
  await page.waitForFunction(() => document.querySelector("video")?.ended);
  await page.waitForResponse(
    (r) => r.url().includes("/heartbeat") && r.status() === 200,
  );
  await page.screenshot({ path: ".local/app-player.png", fullPage: true });
  await page.reload();
  await page.getByRole("button", { name: "Start lesson", exact: true }).click();
  await page.locator("video").waitFor();
  await page.waitForFunction(
    () => (document.querySelector("video")?.currentTime || 0) > 2,
  );
  await page.goto("http://127.0.0.1:3000/quizzes/" + fixture.quizId);
  await page.getByLabel("A development verification fixture").check();
  await page.getByRole("button", { name: "Submit quiz", exact: true }).click();
  await page.getByText("100%", { exact: true }).first().waitFor();
  await page.screenshot({ path: ".local/app-quiz.png", fullPage: true });
  await page.goto("http://127.0.0.1:3000/dashboard");
  await page.getByText("100%", { exact: true }).first().waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:3000/devices");
  await page.getByText("Desktop browser", { exact: true }).waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: ".local/app-devices-mobile.png",
    fullPage: true,
  });
  await page.getByLabel("Interface language").selectOption("mm");
  await page.waitForFunction(() => document.documentElement.lang === "my");
  await page.reload();
  await page.waitForFunction(() => document.documentElement.lang === "my");
  await page.getByRole("link", { name: "အကျဉ်းချုပ်", exact: true }).waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: ".local/app-devices-burmese.png",
    fullPage: true,
  });
  await page.getByLabel("Interface language").selectOption("en");
  await page.waitForFunction(() => document.documentElement.lang === "en");
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      videoPlayback: "passed",
      resumeAfterReload: "passed",
      quizAndDashboardPersistence: "passed",
      mobileDevices: "passed",
      savedLanguagePreference: "passed",
      browserErrors: errors,
    }),
  );
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
