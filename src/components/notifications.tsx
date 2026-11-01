"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  bindPushOwner,
  clearPushRegistration,
  enablePush,
} from "@/lib/push-client";
import type { Notification as AcademyNotification } from "@/lib/types";
import { useAuth, useData } from "./providers";
import { useLocale } from "./locale";
import { Badge, Button, Icon, Message, Modal, Toast } from "./ui";

export function PushNotificationControl({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { account, deviceLimitReached } = useAuth();
  const { t } = useLocale();
  const { data, reload } = useData<{
    configured: boolean;
    enabled: boolean;
    publicKey: string | null;
  }>(account ? "/me/push/status" : null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [install, setInstall] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setInstall(
      ios &&
        !matchMedia("(display-mode: standalone)").matches &&
        !(navigator as Navigator & { standalone?: boolean }).standalone,
    );
    setSupported(
      isSecureContext &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window,
    );
  }, []);
  useEffect(() => {
    let active = true;
    if (!account || !supported || !data) return;
    void navigator.serviceWorker
      .getRegistration("/")
      .then(async (reg) => {
        const sub = await reg?.pushManager.getSubscription();
        const current =
          !!sub &&
          data.enabled &&
          Notification.permission === "granted" &&
          localStorage.getItem("geki-push-owner") === account.id;
        if (current && reg) await bindPushOwner(reg, account.id);
        if (active) setEnabled(current);
      })
      .catch(() => {
        if (active) setEnabled(false);
      });
    return () => {
      active = false;
    };
  }, [account, supported, data]);
  const disabled =
    !account?.emailVerified ||
    !data?.configured ||
    !supported ||
    install ||
    busy;
  const description = deviceLimitReached
    ? "You already have two devices registered. Please remove one in My Devices before continuing."
    : install
      ? "On iPhone or iPad, add GEKI to your Home Screen in Safari, then enable notifications."
      : supported === false
        ? "Open GEKI in Chrome, Edge, Firefox or Safari to enable background alerts."
        : enabled
          ? "Background alerts are on for this device. You stay in control."
          : "Get payment updates on this device, even when GEKI is closed.";
  return (
    <section
      className={`push-optin ${compact ? "compact" : ""}`}
      aria-label={t("Background notifications")}
    >
      <span className={`push-optin-icon ${enabled ? "enabled" : ""}`}>
        <Icon name={enabled ? "check" : "bell"} />
      </span>
      <div className="push-optin-copy">
        <strong>{t("Payment updates, wherever you are.")}</strong>
        <p>{t(description)}</p>
        {data && !data.configured && (
          <small>{t("Background notifications are not configured yet.")}</small>
        )}
      </div>
      <Button
        href={deviceLimitReached ? "/devices" : undefined}
        secondary={enabled}
        disabled={disabled}
        onClick={async () => {
          if (!account || !data?.publicKey) return;
          setBusy(true);
          setError("");
          try {
            if (enabled) await clearPushRegistration();
            else await enablePush(account.id, data.publicKey);
            setEnabled(!enabled);
            reload();
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "Could not update notification preferences.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {t(
          deviceLimitReached
            ? "Manage devices"
            : busy
              ? "Saving…"
              : enabled
                ? "Turn off alerts"
                : "Enable notifications",
        )}
      </Button>
      {error && <Message error>{t(error)}</Message>}
    </section>
  );
}

export function NotificationBell() {
  const { account } = useAuth();
  const { t } = useLocale();
  const { data: response, reload } = useData<{
    userId: string;
    items: AcademyNotification[];
    unread: number;
  }>(
    account
      ? "/me/notifications?account=" + encodeURIComponent(account.id)
      : null,
  );
  const data = response?.userId === account?.id ? response : null;
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [actionError, setActionError] = useState("");
  const muteUntil = useRef(0);
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    seen.current = null;
    setToast("");
  }, [account?.id]);
  useEffect(() => {
    if (!account) return;
    const refresh = () => {
      if (document.visibilityState === "visible") reload();
    };
    const push = (event: MessageEvent) => {
      if (event.data?.type === "GEKI_NOTIFICATION") refresh();
    };
    const review = () => {
      muteUntil.current = Date.now() + 5000;
      refresh();
    };
    const timer = setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    window.addEventListener("geki:payment-updated", review);
    window.addEventListener("geki:notifications-read", refresh);
    navigator.serviceWorker?.addEventListener("message", push);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("geki:payment-updated", review);
      window.removeEventListener("geki:notifications-read", refresh);
      navigator.serviceWorker?.removeEventListener("message", push);
    };
  }, [account?.id, reload]);
  useEffect(() => {
    if (!data) return;
    if (seen.current) {
      const fresh = data.items.find(
        (n) => !n.readAt && !seen.current!.has(n.id),
      );
      if (fresh && Date.now() >= muteUntil.current) setToast(fresh.title);
    }
    seen.current = new Set(data.items.map((n) => n.id));
  }, [data]);
  return (
    <>
      <button
        type="button"
        className="icon-btn notification-bell"
        aria-label={t("Notifications")}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Icon name="bell" />
        {!!data?.unread && (
          <span className="notification-count">
            {data.unread > 9 ? "9+" : data.unread}
          </span>
        )}
      </button>
      {toast && <Toast success>{t(toast)}</Toast>}
      {actionError && <Message error>{t(actionError)}</Message>}
      {open && (
        <Modal title={t("Notifications")} onClose={() => setOpen(false)}>
          <div className="notification-center">
            <div className="row between">
              <Badge>
                {data?.unread || 0} {t("unread")}
              </Badge>
              <Button
                secondary
                onClick={async () => {
                  try {
                    await api("/me/notifications/read-all", { method: "POST" });
                    setToast("");
                    window.dispatchEvent(new Event("geki:notifications-read"));
                    reload();
                  } catch {
                    setActionError(
                      "Could not update notification preferences.",
                    );
                  }
                }}
              >
                {t("Mark all read")}
              </Button>
            </div>
            <PushNotificationControl compact />
            {data?.items.length ? (
              data.items.map((n) => (
                <article
                  key={n.id}
                  className={`notification-center-item ${n.readAt ? "" : "unread"}`}
                >
                  <span className="notification-dot" />
                  <div>
                    <strong>{t(n.title)}</strong>
                    <p>{t(n.body)}</p>
                    <small>{new Date(n.createdAt).toLocaleString()}</small>
                    <Link
                      href={n.href}
                      onClick={() => {
                        void api("/me/notifications/" + n.id, {
                          method: "PATCH",
                        })
                          .then(() => {
                            window.dispatchEvent(
                              new Event("geki:notifications-read"),
                            );
                            reload();
                          })
                          .catch(() =>
                            setActionError(
                              "Could not update notification preferences.",
                            ),
                          );
                        setOpen(false);
                      }}
                    >
                      {t("View details")} →
                    </Link>
                  </div>
                </article>
              ))
            ) : (
              <p className="notification-center-empty">
                {t("You’re all caught up.")}
              </p>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
