const assert = require("node:assert/strict");
const { chromium } = require("playwright");
(async () => {
  const root = "http://127.0.0.1:3000";
  const browser = await chromium.launch({
    ...(process.env.CI ? {} : { channel: "chrome" }),
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
    await page.goto("about:blank");
    const message = {
      notificationId: "fixture-1",
      userId: "push-fixture",
      title: "Your course is ready",
      body: "Payment approved.",
      href: "/my-learning",
    };
    const deliver = (data) =>
      session.send("ServiceWorker.deliverPushMessage", {
        origin: root,
        registrationId,
        data: JSON.stringify(data),
      });
    await deliver(message);
    await page.goto(root + "/signin");
    const notifications = () =>
      page.evaluate(async () =>
        (await (await navigator.serviceWorker.ready).getNotifications()).map(
          (n) => ({ title: n.title, tag: n.tag, href: n.data.href }),
        ),
      );
    let found;
    for (let i = 0; i < 30; i++) {
      found = await notifications();
      if (found.length) break;
      await page.waitForTimeout(100);
    }
    assert.equal(found.length, 1);
    assert.equal(found[0].href, "/my-learning");
    await deliver(message);
    await deliver({
      ...message,
      notificationId: "wrong-owner",
      userId: "other-account",
    });
    await page.waitForTimeout(300);
    assert.equal(
      (await notifications()).length,
      1,
      "Duplicates and other accounts must not display",
    );
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
    await deliver({ ...message, notificationId: "after-logout" });
    await page.waitForTimeout(300);
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
