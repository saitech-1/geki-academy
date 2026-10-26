"use client";
import { useLocale } from "./locale";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { api, apiBlob, json } from "@/lib/api";
import type { Course } from "@/lib/types";
import { useAuth, useData } from "./providers";
import { Heading, Button, Badge, Message, Modal, Loading, Empty } from "./ui";
type Order = {
  id: string;
  courseId: string;
  amountMinor: number;
  currency: string;
  status: string;
  transactionId: string | null;
  receiptUpload?: "direct" | "local";
  qrImage: string;
  recipient: string;
  reviewReason: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  course: { title: string; slug: string };
  user?: { email: string; displayName: string };
};
const money = (o: { amountMinor: number; currency: string }) =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency: o.currency,
    maximumFractionDigits: 0,
  }).format(o.amountMinor / 100);
const stateLabel = (state: string) =>
  ({
    AWAITING_PAYMENT: "Awaiting payment",
    SUBMITTED: "Under review",
    APPROVED: "Payment confirmed",
    REJECTED: "Needs attention",
  })[state] || state;
export function PendingPayments() {
  const { t } = useLocale();

  const { account } = useAuth();
  const { data, error } = useData<Order[]>(
    account ? "/me/payment-orders" : null,
  );
  const pending = data?.filter((o) => o.status !== "APPROVED");
  return (
    <>
      {error ? <Message error>{error}</Message> : null}
      {pending?.length ? (
        <section className="panel stack">
          <h3>{t("Your payment requests")}</h3>
          {pending.map((o) => (
            <div className="row between wrap" key={o.id}>
              <div>
                <strong>{o.course.title}</strong>
                <p>
                  {money(o)} · {t(stateLabel(o.status))}
                </p>
              </div>
              <Button secondary href={"/checkout/" + o.course.slug}>
                {o.status === "SUBMITTED"
                  ? t("View payment status")
                  : t("Continue payment")}
              </Button>
            </div>
          ))}
        </section>
      ) : null}
    </>
  );
}
export function ReceiptImage({
  orderId,
  admin = false,
}: {
  orderId: string;
  admin?: boolean;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    const controller = new AbortController();
    setUrl("");
    setError("");
    apiBlob(
      `${admin ? "/admin" : "/me"}/payment-orders/${orderId}/proof`,
      controller.signal,
    )
      .then((blob) => {
        if (active) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [orderId, admin]);
  return error ? (
    <Message error>{error}</Message>
  ) : url ? (
    <a href={url} target="_blank" rel="noreferrer">
      <img
        className="payment-receipt"
        src={url}
        alt="Submitted KBZPay payment receipt"
        onError={() =>
          setError(
            "The receipt image could not be displayed. Submit a valid PNG or JPEG, or ask the learner for a clearer receipt.",
          )
        }
      />
    </a>
  ) : (
    <Loading />
  );
}
export function KbzPayCheckout({ course }: { course: Course }) {
  const { t } = useLocale();

  const { account, refresh } = useAuth();
  const { data: orders, reload } = useData<Order[]>(
    account ? "/me/payment-orders" : null,
  );
  const { data: quote } = useData<{
    amountMinor: number;
    regularAmountMinor: number;
    currency: string;
    founding: boolean;
  }>(account ? "/checkout/quote/" + course.id : null);
  const [current, setCurrent] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const opened = useRef("");
  const order = current || orders?.find((o) => o.courseId === course.id);
  const owned = account?.purchases.some(
    (p) => p.courseId === course.id && !p.revokedAt,
  );
  useEffect(() => {
    if (order?.status !== "SUBMITTED") return;
    let active = true;
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      api<Order>("/me/payment-orders/" + order.id)
        .then((o) => {
          if (active) {
            setCurrent(o);
            if (o.status === "APPROVED") void refresh();
          }
        })
        .catch(() => {});
    }, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [order?.id, order?.status, refresh]);
  const begin = useCallback(async () => {
    setFailure("");
    setBusy(true);
    try {
      setCurrent(
        await api<Order>("/checkout", {
          method: "POST",
          body: json({ courseId: course.id }),
        }),
      );
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Could not open checkout.");
    } finally {
      setBusy(false);
    }
  }, [course.id]);
  useEffect(() => {
    const key = account?.id + ":" + course.id;
    if (
      !account?.emailVerified ||
      !account.onboarded ||
      !orders ||
      order ||
      owned ||
      !course.priceMinor ||
      !course.kbzPayEnabled ||
      opened.current === key
    )
      return;
    opened.current = key;
    void begin();
  }, [
    account,
    course.id,
    course.priceMinor,
    course.kbzPayEnabled,
    orders,
    order,
    owned,
    begin,
  ]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!order) return;
    setFailure("");
    const form = new FormData(e.currentTarget);
    const proof = form.get("proof");
    if (proof instanceof File && proof.size > 5 * 1024 * 1024) {
      setFailure("Choose a PNG or JPEG receipt smaller than 5 MB.");
      return;
    }
    setBusy(true);
    try {
      let body: FormData | string = form;
      if (order.receiptUpload === "direct") {
        const upload = await api<{ signedUrl: string; uploadToken: string }>(
          `/me/payment-orders/${order.id}/upload`,
          { method: "POST" },
        );
        const uploaded = await fetch(upload.signedUrl, {
          method: "PUT",
          body: proof as File,
          headers: { "Content-Type": (proof as File).type },
        });
        if (!uploaded.ok)
          throw new Error(
            "Photo upload failed. Choose a PNG or JPEG up to 5 MB and try again.",
          );
        body = json({ uploadToken: upload.uploadToken });
      }
      setCurrent(
        await api<Order>(`/me/payment-orders/${order.id}/proof`, {
          method: "POST",
          body,
        }),
      );
      reload();
    } catch (e) {
      setFailure(
        e instanceof Error ? e.message : "Receipt could not be submitted.",
      );
    } finally {
      setBusy(false);
    }
  }
  const total =
    order ||
    quote ||
    (course.priceMinor
      ? { amountMinor: course.priceMinor, currency: course.currency }
      : null);
  const founding =
    total?.amountMinor === 3500000 &&
    course.slug === "geki-kihon-package" &&
    course.priceMinor === 5000000;
  const expired =
    order &&
    ["AWAITING_PAYMENT", "REJECTED"].includes(order.status) &&
    Date.now() - new Date(order.updatedAt).getTime() >= 24 * 3600000;
  return (
    <>
      <Heading
        eyebrow={t("COURSE PAYMENT")}
        title={course.title}
        description={t("Pay once. Keep ongoing course access.")}
      />
      {failure ? <Message error>{failure}</Message> : null}
      {owned || order?.status === "APPROVED" ? (
        <section className="panel stack">
          <Badge tone="green">{t("Payment confirmed")}</Badge>
          <h2>{t("Your course is ready.")}</h2>
          <Button href={"/courses/" + course.slug}>
            {t("Start your course")}
          </Button>
        </section>
      ) : (
        <div className="qr-checkout-grid">
          <section className="panel stack qr-payment-panel">
            <div className="eyebrow">{t("1. SCAN PAYMENT QR")}</div>
            <div className="payment-total">
              {total ? money(total) : t("Price to be announced")}
            </div>
            {founding ? (
              <div className="stack">
                <Badge>{t("Founding learner · 30% off")}</Badge>
                <p>
                  <s>50,000 MMK</s> {t("· First 50 paying Kihon learners.")}
                </p>
              </div>
            ) : null}
            {order && !expired && order.status !== "SUBMITTED" ? (
              <>
                <img
                  className="payment-qr"
                  src={order.qrImage}
                  alt="GEKI Academy KBZPay payment QR"
                />
                <a
                  className="text-link"
                  href={order.qrImage}
                  download="GEKI-KBZPay-QR.jpg"
                >
                  {t("Save QR image ↓")}
                </a>
                <p>
                  {t("Amount")}: <strong>{money(order)}</strong>
                </p>
                <p>
                  {t("Recipient")}: <strong>{order.recipient}</strong>
                </p>
                {order.status !== "SUBMITTED" ? (
                  <small>
                    {t(
                      "Complete payment and upload your receipt within 24 hours of opening this order. Your quoted price is reserved during this window.",
                    )}
                  </small>
                ) : null}
              </>
            ) : (
              <p>
                {order?.status === "SUBMITTED"
                  ? t(
                      "Screenshot submitted. Please do not pay again while your payment is under review.",
                    )
                  : expired
                    ? t(
                        "This payment window expired. Refresh the price before paying. If you already paid, contact GEKI before paying again.",
                      )
                    : t(
                        "Open your order to reserve the exact price and view the payment QR.",
                      )}
              </p>
            )}
            {!account ? (
              <Button
                href={
                  "/signin?next=" +
                  encodeURIComponent("/checkout/" + course.slug)
                }
              >
                {t("Sign in to pay")}
              </Button>
            ) : !order || expired ? (
              <Button
                disabled={busy || !course.priceMinor || !course.kbzPayEnabled}
                onClick={() => void begin()}
              >
                {busy
                  ? t("Preparing…")
                  : expired
                    ? t("Refresh payment price")
                    : t("Show payment QR")}
              </Button>
            ) : null}
            {!course.kbzPayEnabled ? (
              <small>
                {t("QR payment is not available for this course yet.")}
              </small>
            ) : null}
          </section>
          <section className="panel stack">
            {order?.status === "SUBMITTED" ? (
              <>
                <Badge tone="amber">{t("Under review")}</Badge>
                <h3>{t("Receipt received.")}</h3>
                <p>
                  {t(
                    "GEKI will check the incoming payment and unlock your course after approval. You’ll receive a notification.",
                  )}
                </p>
                <ReceiptImage orderId={order.id} />
              </>
            ) : (
              <>
                <div className="eyebrow">
                  {t("2. UPLOAD PAYMENT SCREENSHOT")}
                </div>
                <h3>{t("Upload your payment screenshot")}</h3>
                <p>
                  {t(
                    "Scan the QR, pay the exact amount, then upload the successful payment receipt.",
                  )}
                </p>
                {order?.status === "REJECTED" ? (
                  <Message error>
                    {order.reviewReason ||
                      t("Please upload a clearer receipt.")}{" "}
                    {t("Don’t pay twice for a successful transfer.")}
                  </Message>
                ) : null}
                {order && !expired ? (
                  <form className="stack" onSubmit={submit}>
                    <label>
                      {t("Payment screenshot")}
                      <input
                        name="proof"
                        type="file"
                        accept="image/jpeg,image/png"
                        required
                      />
                    </label>
                    <small>
                      {t(
                        "PNG or JPEG, up to 5 MB. Keep the amount, recipient and successful payment details visible. No transaction ID to type.",
                      )}
                    </small>
                    <Button type="submit" disabled={busy}>
                      {busy
                        ? t("Uploading…")
                        : t("Submit screenshot for review")}
                    </Button>
                  </form>
                ) : (
                  <p>
                    {t(
                      "Your receipt upload will appear after you open a payment order.",
                    )}
                  </p>
                )}
                <small>
                  {t("Your course unlocks after GEKI verifies the payment.")}
                </small>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}

export function AdminPaymentReviews() {
  const { t } = useLocale();

  const { account } = useAuth();
  const [filter, setFilter] = useState("SUBMITTED");
  const { data, error, loading, reload } = useData<Order[]>(
    account && account.role !== "STUDENT"
      ? "/admin/payment-orders?status=" + filter
      : null,
  );
  const [selected, setSelected] = useState<Order | null>(null);
  const [reason, setReason] = useState("");
  const [verified, setVerified] = useState(false);
  const [bankReference, setBankReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  async function review(decision: string) {
    if (!selected) return;
    setBusy(true);
    setFailure("");
    try {
      await api("/admin/payment-orders/" + selected.id + "/review", {
        method: "POST",
        body: json({
          decision,
          verifiedInKbzPay: verified,
          ...(bankReference.trim()
            ? { bankReference: bankReference.trim() }
            : {}),
          reason,
        }),
      });
      setSelected(null);
      reload();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Payment review failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow={t("PAYMENT OPERATIONS")}
        title={t("Verify. Then unlock.")}
        description={t(
          "Confirm incoming KBZPay transfers before granting course access.",
        )}
      />
      <label>
        {t("Payment status")}
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          {["SUBMITTED", "APPROVED", "REJECTED", "AWAITING_PAYMENT", "ALL"].map(
            (s) => (
              <option key={s} value={s}>
                {s === "ALL" ? t("All payments") : t(stateLabel(s))}
              </option>
            ),
          )}
        </select>
      </label>
      {error ? <Message error>{error}</Message> : null}
      {loading ? (
        <Loading />
      ) : data?.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {[
                  "Learner",
                  "Course",
                  "Expected amount",
                  "Transaction",
                  "Status",
                  "Review",
                ].map((h) => (
                  <th key={h}>{t(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((o) => (
                <tr key={o.id}>
                  <td>
                    {o.user?.displayName}
                    <small className="block">{o.user?.email}</small>
                  </td>
                  <td>{o.course.title}</td>
                  <td>{money(o)}</td>
                  <td>{o.transactionId || "See receipt"}</td>
                  <td>
                    <Badge tone={o.status === "APPROVED" ? "green" : "amber"}>
                      {t(stateLabel(o.status))}
                    </Badge>
                  </td>
                  <td>
                    <Button
                      secondary
                      onClick={() => {
                        setSelected(o);
                        setReason("");
                        setVerified(false);
                        setBankReference("");
                        setFailure("");
                      }}
                    >
                      {t("Review payment")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title={t("No payments in this queue.")} />
      )}
      {selected ? (
        <Modal
          title={t("Verify KBZPay payment")}
          dismissible={!busy}
          onClose={() => setSelected(null)}
        >
          <div className="stack">
            <Badge>{t(stateLabel(selected.status))}</Badge>
            <h3>{selected.course.title}</h3>
            <div className="payment-total">{money(selected)}</div>
            <p>{selected.user?.email}</p>
            <p>
              {t("Recipient:")} {selected.recipient}
            </p>
            <p>
              {t("Transaction ID:")}{" "}
              <strong>
                {selected.transactionId ||
                  "Shown on receipt — no typed ID required"}
              </strong>
            </p>
            {selected.submittedAt ? (
              <>
                <small>
                  {t("Submitted")}{" "}
                  {new Date(selected.submittedAt).toLocaleString()}
                </small>
                <ReceiptImage orderId={selected.id} admin />
              </>
            ) : null}
            {selected.status === "SUBMITTED" ? (
              <>
                <div className="notice">
                  {t(
                    "Open your own KBZPay incoming transactions. Match the exact transaction ID, received amount, recipient and successful status. Do not approve based only on the screenshot.",
                  )}
                </div>
                <label className="consent">
                  <input
                    type="checkbox"
                    checked={verified}
                    onChange={(e) => setVerified(e.target.checked)}
                  />
                  <span>
                    {t(
                      "I verified this successful incoming transaction in KBZPay and the amount and recipient match this order.",
                    )}
                  </span>
                </label>
                {!selected.transactionId ? (
                  <label>
                    {t("Incoming KBZPay reference (admin only)")}
                    <input
                      value={bankReference}
                      onChange={(e) => setBankReference(e.target.value)}
                      placeholder={t(
                        "Reference from your own incoming payment record",
                      )}
                    />
                  </label>
                ) : null}
                <label>
                  {t("Review reason")}
                  <textarea
                    required
                    minLength={8}
                    maxLength={500}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={t(
                      "Record your check, or explain what the student must correct.",
                    )}
                  />
                </label>
                <div className="row wrap">
                  <Button
                    disabled={
                      busy ||
                      !verified ||
                      reason.trim().length < 8 ||
                      (!selected.transactionId &&
                        !/^[A-Za-z0-9\s-]{6,64}$/.test(bankReference.trim()))
                    }
                    onClick={() => void review("APPROVE")}
                  >
                    {t("Confirm payment & unlock course")}
                  </Button>
                  <Button
                    secondary
                    disabled={busy || reason.trim().length < 8}
                    onClick={() => void review("REJECT")}
                  >
                    {t("Request correction")}
                  </Button>
                </div>
              </>
            ) : (
              <p>
                {selected.reviewReason ||
                  "Waiting for the learner to submit evidence."}
              </p>
            )}
            {failure ? <Message error>{failure}</Message> : null}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
