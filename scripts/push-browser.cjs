const assert = require("node:assert/strict");
const { chromium } = require("playwright");
(async () => {
  const root = "http://127.0.0.1:3000";
  const browser = await chromium.launch({
    // Persistent notification APIs need the full browser's new headless mode,
    // matching local Chrome rather than Playwright's separate headless shell.
    channel: process.env.CI ? "chromium" : "chrome",
    headless: true,
  });
  try {
    const context = await browser.newContext({
      permissions: ["notifications"],
    });
    const page = await context.newPage();
    await page.goto(root + "/signin");
    const session = await context.newCDPSession(page);
    let registrationId;
    session.on(
      "ServiceWorker.workerRegistrationUpdated",
      ({ registrations }) => {
        for (const r of registrations)
          if (r.scopeURL === root + "/") registrationId = r.registrationId;
      },
    );
    await session.send("ServiceWorker.enable");
    // Isolated browser context only: exercise the real worker, IndexedDB and native notification API.
    await page.evaluate(async () => {
      await navigator.serviceWorker.register("/geki-sw.js", { scope: "/" });
      const registration = await navigator.serviceWorker.ready;
      await new Promise((resolve, reject) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = (e) =>
          e.data.ok ? resolve() : reject(Error("owner binding failed"));
        registration.active.postMessage(
          { type: "GEKI_PUSH_OWNER", userId: "push-fixture" },
          [channel.port2],
        );
      });
    });
    for (let i = 0; !registrationId && i < 30; i++)
      await page.waitForTimeout(100);
    assert.ok(registrationId);
    const worker = context
      .serviceWorkers()
      .find((w) => new URL(w.url()).pathname === "/geki-sw.js");
    assert.ok(worker, "GEKI notification worker must be running");
    // Observe the real push handler's waitUntil promise in this isolated test.
    // CDP delivery acknowledgment does not mean asynchronous push work finished.
    await worker.evaluate(() => {
      const original = ExtendableEvent.prototype.waitUntil;
      ExtendableEvent.prototype.waitUntil = function (promise) {
        const result = original.call(this, promise);
        if (this.type === "push")
          Promise.resolve(promise).then(
            () => globalThis.__gekiPushResolve?.(),
            (error) => globalThis.__gekiPushReject?.(error),
          );
        return result;
      };
    });
    await page.goto("about:blank");
    const message = {
      notificationId: "fixture-1",
      userId: "push-fixture",
      title: "Your course is ready",
      body: "Payment approved.",
      href: "/my-learning",
    };
    const deliver = async (data) => {
      await worker.evaluate(() => {
        globalThis.__gekiPushDone = new Promise((resolve, reject) => {
          globalThis.__gekiPushResolve = resolve;
          globalThis.__gekiPushReject = reject;
        });
      });
      await session.send("ServiceWorker.deliverPushMessage", {
        origin: root,
        registrationId,
        data: JSON.stringify(data),
      });
      await worker.evaluate(async () => {
        let timer;
        try {
          await Promise.race([
            globalThis.__gekiPushDone,
            new Promise((_, reject) => {
              timer = setTimeout(
                () =>
                  reject(
                    Error("GEKI push handler did not finish within 10 seconds"),
                  ),
                10000,
              );
            }),
          ]);
        } finally {
          clearTimeout(timer);
        }
      });
    };
    await deliver(message);
    const notifications = () =>
      worker.evaluate(async () =>
        (await self.registration.getNotifications()).map((n) => ({
          title: n.title,
          tag: n.tag,
          href: n.data.href,
        })),
      );
    const found = await notifications();
    assert.equal(found.length, 1);
    assert.equal(found[0].href, "/my-learning");
    await deliver(message);
    await deliver({
      ...message,
      notificationId: "wrong-owner",
      userId: "other-account",
    });
    assert.equal(
      (await notifications()).length,
      1,
      "Duplicates and other accounts must not display",
    );
    await page.goto(root + "/signin");
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      await new Promise((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = resolve;
        registration.active.postMessage(
          { type: "GEKI_PUSH_OWNER", userId: null },
          [channel.port2],
        );
      });
    });
    assert.equal(
      (await notifications()).length,
      0,
      "Sign-out must clear displayed alerts",
    );
    await page.goto("about:blank");
    await deliver({ ...message, notificationId: "after-logout" });
    assert.equal(
      (await notifications()).length,
      0,
      "Signed-out devices must ignore push",
    );
    console.log(
      "Push browser passed: real service worker background display, account binding, duplicate suppression and sign-out cleanup. Provider transport injected through Chrome DevTools; real phone delivery not asserted.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
