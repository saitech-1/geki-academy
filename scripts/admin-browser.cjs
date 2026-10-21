const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:3000/signin");
  await page.getByText("Local test sign-in", { exact: true }).waitFor();
  await page.getByRole("link", { name: /Use real Firebase sign-in/ }).waitFor();
  await page.getByLabel("Account / guardian email").fill("admin@geki.local");
  await page.locator("input[name=password]").fill("GekiLocal!2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard");
  await page.goto("http://127.0.0.1:3000/admin/courses");
  await page
    .getByRole("button", { name: "Create course", exact: true })
    .click();
  async function centered() {
    await page.waitForFunction(() => {
      const d = document.querySelector("dialog[open]");
      if (!d) return false;
      const r = d.getBoundingClientRect();
      return (
        Math.abs(r.x + r.width / 2 - innerWidth / 2) < 2 &&
        Math.abs(r.y + r.height / 2 - innerHeight / 2) < 2
      );
    });
  }
  await centered();
  await page.screenshot({ path: ".local/admin-course-modal-laptop.png" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await centered();
  await page.setViewportSize({ width: 1024, height: 768 });
  await centered();
  await page.setViewportSize({ width: 1280, height: 800 });
  const name = "Browser CRUD " + Date.now();
  await page.getByLabel("Course title", { exact: true }).fill(name);
  await page
    .getByLabel("Description", { exact: true })
    .fill("A temporary browser verification course.");
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  await page.waitForURL(/\/admin\/courses\/[^/]+$/);
  const courseUrl = page.url();
  await page
    .getByLabel("English title", { exact: true })
    .fill(name + " edited");
  await page
    .getByLabel("Course category", { exact: true })
    .selectOption("Kata");
  await page.getByRole("button", { name: "Save course", exact: true }).click();
  await page.getByText("Saved to the database.", { exact: true }).waitFor();
  await page.reload();
  assert.equal(
    await page.getByLabel("English title", { exact: true }).inputValue(),
    name + " edited",
  );
  await page.goto("http://127.0.0.1:3000/admin/videos");
  await page.getByRole("button", { name: "Add video", exact: true }).click();
  await centered();
  await page
    .getByLabel(/Choose video from your computer/)
    .setInputFiles(".local/verification.webm");
  const create = page.getByRole("button", {
    name: "Create & upload video",
    exact: true,
  });
  await create.waitFor();
  await page.getByLabel("Title", { exact: true }).fill(name + " video");
  await create.click();
  await page
    .getByText(
      "Source uploaded. Preview it, then review your subtitle tracks.",
      { exact: true },
    )
    .waitFor();
  await centered();
  await page
    .getByRole("button", { name: "Preview uploaded video", exact: true })
    .click();
  await page.locator("dialog video").waitFor();
  await page.waitForFunction(() => {
    const video = document.querySelector("dialog video");
    return video && video.readyState >= 2;
  });
  await page
    .getByLabel("Video title", { exact: true })
    .fill(name + " video edited");
  await page
    .getByRole("button", { name: "Save video details", exact: true })
    .click();
  await page.getByText("Video details saved.", { exact: true }).waitFor();
  await page.screenshot({ path: ".local/admin-video-editor-laptop.png" });
  const english = page
    .locator("dialog form")
    .filter({
      has: page.getByRole("heading", {
        name: "English subtitles",
        exact: true,
      }),
    });
  await english.locator("input[type=checkbox]").check();
  await english
    .getByRole("button", { name: "Save track", exact: true })
    .click();
  const toast = page.locator(".geki-toast.is-error:popover-open");
  await toast.waitFor();
  await page.waitForTimeout(250);
  assert.match(await toast.innerText(), /actual caption text/);
  const toastBounds = await toast.boundingBox();
  assert.ok(toastBounds.x >= 0 && toastBounds.x + toastBounds.width <= 1280);
  assert.ok(
    await toast.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x + 20, r.y + 20));
    }),
  );
  await page.screenshot({ path: ".local/admin-error-toast-laptop.png" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await toast.evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  await toast.getByRole("button", { name: "Dismiss notification" }).click();
  await toast.waitFor({ state: "hidden" });
  await english
    .getByRole("button", { name: "Save track", exact: true })
    .click();
  await toast.waitFor();
  await toast.getByRole("button", { name: "Dismiss notification" }).click();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "Delete video", exact: true }).click();
  await centered();
  await page
    .getByLabel("Reason", { exact: true })
    .fill("Remove browser verification fixture");
  await page.getByRole("button", { name: "Delete video", exact: true }).click();
  await page.locator("dialog[open]").waitFor({ state: "hidden" });
  await page.goto("http://127.0.0.1:3000/admin/courses");
  await page.getByLabel("Search admin courses").fill(name);
  const row = page.getByRole("row").filter({ hasText: name + " edited" });
  await row.getByRole("button", { name: "Delete", exact: true }).click();
  await page
    .getByLabel("Reason", { exact: true })
    .fill("Remove browser verification course");
  await page
    .getByRole("button", { name: "Delete course", exact: true })
    .click();
  await page.locator("dialog[open]").waitFor({ state: "hidden" });
  await page.goto("http://127.0.0.1:3000/admin");
  await page
    .getByRole("heading", { name: "Keep the academy moving." })
    .waitFor();
  assert.notEqual(
    await page
      .locator(".page-enter")
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page
      .locator(".page-enter")
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    ".local/admin-browser-report.json",
    JSON.stringify(
      {
        modalCenters: [1024, 1280, 1440],
        courseCRUD: "passed",
        videoUploadPreviewEditDelete: "passed",
        motionAndReducedMotion: "passed",
        errorToastAboveModalAndRetry: "passed",
        browserErrors: errors,
      },
      null,
      2,
    ),
  );
  console.log(fs.readFileSync(".local/admin-browser-report.json", "utf8"));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
