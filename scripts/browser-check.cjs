const fs = require("node:fs");
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:3000");
  await page.screenshot({ path: ".local/app-home.png", fullPage: true });
  const data = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 360;
    const context = c.getContext("2d");
    const recorder = new MediaRecorder(c.captureStream(15), {
      mimeType: "video/webm",
    });
    const chunks = [];
    const stopped = new Promise((resolve) => {
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = resolve;
    });
    recorder.start();
    const start = performance.now();
    await new Promise((resolve) => {
      function draw() {
        const elapsed = performance.now() - start;
        context.fillStyle = "#0a0a0a";
        context.fillRect(0, 0, 640, 360);
        context.fillStyle = "#d71920";
        context.fillRect(35, 35, 40, 40);
        context.fillStyle = "#f5f4f0";
        context.font = "28px Arial";
        context.fillText("GEKI · Local playback verification", 35, 150);
        context.font = "17px Arial";
        context.fillText(
          "Development fixture. Not karate instruction.",
          35,
          195,
        );
        context.fillStyle = "#d71920";
        context.fillRect(35, 270, Math.min(570, (elapsed / 3000) * 570), 3);
        if (elapsed < 3000) requestAnimationFrame(draw);
        else resolve();
      }
      draw();
    });
    recorder.stop();
    await stopped;
    const bytes = new Uint8Array(
      await new Blob(chunks, { type: "video/webm" }).arrayBuffer(),
    );
    return Array.from(bytes);
  });
  fs.writeFileSync(".local/verification.webm", Buffer.from(data));
  await page.goto("http://127.0.0.1:3000/signin");
  await page.getByLabel("Account / guardian email").fill("admin@geki.local");
  await page.locator("input[name=password]").fill("GekiLocal!2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard");
  await page
    .getByRole("heading", { name: "Your journey to mastery continues." })
    .waitFor();
  await page.goto("http://127.0.0.1:3000/admin");
  await page
    .getByRole("heading", { name: "Keep the academy moving." })
    .waitFor();
  await page.screenshot({ path: ".local/app-admin.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:3000/dashboard");
  await page
    .getByRole("heading", { name: "Your journey to mastery continues." })
    .waitFor();
  await page.screenshot({
    path: ".local/app-dashboard-mobile.png",
    fullPage: true,
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  console.log(
    JSON.stringify({
      browserErrors: errors,
      mobileOverflow: overflow,
      signIn: "passed",
      adminAuthorization: "passed",
      fixtureBytes: data.length,
    }),
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
