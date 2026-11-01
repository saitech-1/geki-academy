/* Notification-only service worker. No pages, API responses or videos are cached. */
function store(mode, action) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("geki-push", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("settings");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result,
        tx = db.transaction("settings", mode),
        settings = tx.objectStore("settings");
      let value;
      action(settings, (result) => {
        value = result;
      });
      tx.oncomplete = () => {
        db.close();
        resolve(value);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("message", (event) => {
  if (event.data?.type !== "GEKI_PUSH_OWNER") return;
  const id = event.data.userId;
  if (id !== null && (typeof id !== "string" || id.length > 100)) return;
  event.waitUntil(
    store("readwrite", (s, done) => {
      s.put(id, "owner");
      done(true);
    })
      .then(async () => {
        if (!id)
          for (const n of await self.registration.getNotifications()) n.close();
        event.ports[0]?.postMessage({ ok: true });
      })
      .catch(() => event.ports[0]?.postMessage({ ok: false })),
  );
});
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let payload;
      try {
        payload = event.data?.json();
      } catch {
        return;
      }
      if (
        !payload ||
        typeof payload.notificationId !== "string" ||
        typeof payload.userId !== "string"
      )
        return;
      const owner = await store("readonly", (s, done) => {
        const r = s.get("owner");
        r.onsuccess = () => done(r.result);
      });
      if (owner !== payload.userId) return;
      const allowed = ["/admin/payments", "/my-learning"];
      const href = allowed.includes(payload.href)
        ? payload.href
        : "/notifications";
      const fresh = await store("readwrite", (s, done) => {
        const r = s.get("seen");
        r.onsuccess = () => {
          const seen = Array.isArray(r.result) ? r.result : [];
          if (seen.includes(payload.notificationId)) {
            done(false);
            return;
          }
          s.put([...seen, payload.notificationId].slice(-100), "seen");
          done(true);
        };
      });
      if (!fresh) return;
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      if (
        windows.some(
          (client) => client.focused && client.visibilityState === "visible",
        )
      ) {
        for (const client of windows)
          client.postMessage({ type: "GEKI_NOTIFICATION" });
        return;
      }
      await self.registration.showNotification(
        String(payload.title || "GEKI Academy").slice(0, 150),
        {
          body: String(payload.body || "You have a new update.").slice(0, 350),
          icon: "/icons/geki-192.png",
          badge: "/icons/geki-192.png",
          tag: `geki-${payload.notificationId}`,
          renotify: false,
          data: { href, notificationId: payload.notificationId },
        },
      );
      for (const client of await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      }))
        client.postMessage({ type: "GEKI_NOTIFICATION" });
    })(),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const path = event.notification.data?.href;
      const href = new URL(
        ["/admin/payments", "/my-learning", "/notifications"].includes(path)
          ? path
          : "/notifications",
        self.location.origin,
      ).href;
      for (const client of await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      })) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.navigate(href);
          await client.focus();
          return;
        }
      }
      await self.clients.openWindow(href);
    })(),
  );
});
