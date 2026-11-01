"use client";
import { api, json } from "./api";
const ownerKey = "geki-push-owner";
export async function bindPushOwner(
  registration: ServiceWorkerRegistration,
  userId: string | null,
) {
  const worker = registration.active;
  if (!worker)
    throw Error("Notifications are still starting. Please try again.");
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      channel.port1.close();
      reject(Error("Could not save notification preferences."));
    }, 3000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      channel.port1.close();
      event.data?.ok
        ? resolve()
        : reject(Error("Could not save notification preferences."));
    };
    worker.postMessage({ type: "GEKI_PUSH_OWNER", userId }, [channel.port2]);
  });
  if (userId) localStorage.setItem(ownerKey, userId);
  else localStorage.removeItem(ownerKey);
}
export async function clearPushRegistration() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration) {
    localStorage.removeItem(ownerKey);
    return;
  }
  await bindPushOwner(registration, null).catch(() => {});
  const sub = await registration.pushManager?.getSubscription();
  if (sub) {
    await sub.unsubscribe().catch(() => false);
    await api("/me/push/subscription", {
      method: "DELETE",
      body: json({ endpoint: sub.endpoint }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
  }
}
export async function resetPushForOtherAccount(userId: string | null) {
  const previous = localStorage.getItem(ownerKey);
  if (previous && previous !== userId) await clearPushRegistration();
}
export async function enablePush(userId: string, publicKey: string) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw Error(
      "Notifications are blocked. You can change this in your browser settings.",
    );
  await resetPushForOtherAccount(userId);
  await navigator.serviceWorker.register("/geki-sw.js", { scope: "/" });
  const registration = await navigator.serviceWorker.ready;
  await bindPushOwner(registration, userId);
  let subscription = await registration.pushManager.getSubscription();
  const bytes = Uint8Array.from(
    atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
  if (
    subscription?.options.applicationServerKey &&
    !new Uint8Array(subscription.options.applicationServerKey).every(
      (v, i) => v === bytes[i],
    )
  ) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ||= await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: bytes,
  });
  const keys = subscription.toJSON().keys;
  if (!keys) throw Error("This browser could not register notifications.");
  try {
    await api("/me/push/subscription", {
      method: "POST",
      body: json({ endpoint: subscription.endpoint, keys }),
    });
  } catch (error) {
    await subscription.unsubscribe().catch(() => false);
    await bindPushOwner(registration, null).catch(() => {});
    throw error;
  }
}
