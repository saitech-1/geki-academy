"use client";
import { useEffect, useState, type FormEvent } from "react";
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
          <h3>Your payment requests</h3>
          {pending.map((o) => (
            <div className="row between wrap" key={o.id}>
              <div>
                <strong>{o.course.title}</strong>
                <p>
                  {money(o)} · {stateLabel(o.status)}
                </p>
              </div>
              <Button secondary href={"/checkout/" + o.course.slug}>
                {o.status === "SUBMITTED"
                  ? "View payment status"
                  : "Continue payment"}
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
  async function begin() {
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
  }
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
        eyebrow="COURSE PAYMENT"
        title={course.title}
        description="Pay once. Keep ongoing course access."
      />
      {failure ? <Message error>{failure}</Message> : null}
      {owned || order?.status === "APPROVED" ? (
        <section className="panel stack">
          <Badge tone="green">Payment confirmed</Badge>
          <h2>Your course is ready.</h2>
          <Button href={"/courses/" + course.slug}>Start your course</Button>
        </section>
      ) : (
        <div className="qr-checkout-grid">
          <section className="panel stack qr-payment-panel">
            <div className="eyebrow">KBZPAY · ONE-TIME PAYMENT</div>
            <div className="payment-total">
              {total ? money(total) : "Price to be announced"}
            </div>
            {founding ? (
              <div className="stack">
                <Badge>Founding learner · 30% off</Badge>
                <p>
                  <s>50,000 MMK</s> · First 50 paying Kihon learners.
                </p>
              </div>
            ) : null}
            {order && !expired ? (
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
                  Save QR image ↓
                </a>
                <p>
                  Pay <strong>{money(order)}</strong> to{" "}
                  <strong>{order.recipient}</strong>.
                </p>
                {order.status !== "SUBMITTED" ? (
                  <small>
                    Complete payment and upload your receipt within 24 hours of
                    opening this order. Your quoted price is reserved during
                    this window.
                  </small>
                ) : null}
              </>
            ) : (
              <p>
                {expired
                  ? "This payment window expired. Refresh the price before paying. If you already paid, contact GEKI before paying again."
                  : "Open your order to reserve the exact price and view the payment QR."}
              </p>
            )}
            {!account ? (
              <Button
                href={
                  "/signin?next=" +
                  encodeURIComponent("/checkout/" + course.slug)
                }
              >
                Sign in to pay
              </Button>
            ) : !order || expired ? (
              <Button
                disabled={busy || !course.priceMinor || !course.kbzPayEnabled}
                onClick={() => void begin()}
              >
                {busy
                  ? "Preparing…"
                  : expired
                    ? "Refresh payment price"
                    : "Continue to payment"}
              </Button>
            ) : null}
            {!course.kbzPayEnabled ? (
              <small>QR payment is not available for this course yet.</small>
            ) : null}
          </section>
          <section className="panel stack">
            {order?.status === "SUBMITTED" ? (
              <>
                <Badge tone="amber">Under review</Badge>
                <h3>Receipt received.</h3>
                <p>
                  GEKI will check the incoming payment and unlock your course
                  after approval. You’ll receive a notification.
                </p>
                <ReceiptImage orderId={order.id} />
              </>
            ) : (
              <>
                <h3>Upload your payment photo</h3>
                <p>
                  Scan the QR, pay the exact amount, then upload the successful
                  payment receipt.
                </p>
                {order?.status === "REJECTED" ? (
                  <Message error>
                    {order.reviewReason || "Please upload a clearer receipt."}{" "}
                    Don’t pay twice for a successful transfer.
                  </Message>
                ) : null}
                {order && !expired ? (
                  <form className="stack" onSubmit={submit}>
                    <label>
                      Receipt photo
                      <input
                        name="proof"
                        type="file"
                        accept="image/jpeg,image/png"
                        required
                      />
                    </label>
                    <small>
                      PNG or JPEG, up to 5 MB. Keep the amount, recipient and
                      successful payment details visible. No transaction ID to
                      type.
                    </small>
                    <Button type="submit" disabled={busy}>
                      {busy ? "Uploading…" : "Submit payment photo"}
                    </Button>
                  </form>
                ) : (
                  <p>
                    Your receipt upload will appear after you open a payment
                    order.
                  </p>
                )}
                <small>
                  Your course unlocks after GEKI verifies the payment.
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
        eyebrow="PAYMENT OPERATIONS"
        title="Verify. Then unlock."
        description="Confirm incoming KBZPay transfers before granting course access."
      />
      <label>
        Payment status
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          {["SUBMITTED", "APPROVED", "REJECTED", "AWAITING_PAYMENT", "ALL"].map(
            (s) => (
              <option key={s} value={s}>
                {s === "ALL" ? "All payments" : stateLabel(s)}
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
                  <th key={h}>{h}</th>
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
                      {stateLabel(o.status)}
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
                      Review payment
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="No payments in this queue." />
      )}
      {selected ? (
        <Modal
          title="Verify KBZPay payment"
          dismissible={!busy}
          onClose={() => setSelected(null)}
        >
          <div className="stack">
            <Badge>{stateLabel(selected.status)}</Badge>
            <h3>{selected.course.title}</h3>
            <div className="payment-total">{money(selected)}</div>
            <p>{selected.user?.email}</p>
            <p>Recipient: {selected.recipient}</p>
            <p>
              Transaction ID:{" "}
              <strong>
                {selected.transactionId ||
                  "Shown on receipt — no typed ID required"}
              </strong>
            </p>
            {selected.submittedAt ? (
              <>
                <small>
                  Submitted {new Date(selected.submittedAt).toLocaleString()}
                </small>
                <ReceiptImage orderId={selected.id} admin />
              </>
            ) : null}
            {selected.status === "SUBMITTED" ? (
              <>
                <div className="notice">
                  Open your own KBZPay incoming transactions. Match the exact
                  transaction ID, received amount, recipient and successful
                  status. Do not approve based only on the screenshot.
                </div>
                <label className="consent">
                  <input
                    type="checkbox"
                    checked={verified}
                    onChange={(e) => setVerified(e.target.checked)}
                  />
                  <span>
                    I verified this successful incoming transaction in KBZPay
                    and the amount and recipient match this order.
                  </span>
                </label>
                {!selected.transactionId ? (
                  <label>
                    Incoming KBZPay reference (admin only)
                    <input
                      value={bankReference}
                      onChange={(e) => setBankReference(e.target.value)}
                      placeholder="Reference from your own incoming payment record"
                    />
                  </label>
                ) : null}
                <label>
                  Review reason
                  <textarea
                    required
                    minLength={8}
                    maxLength={500}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Record your check, or explain what the student must correct."
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
                    Confirm payment & unlock course
                  </Button>
                  <Button
                    secondary
                    disabled={busy || reason.trim().length < 8}
                    onClick={() => void review("REJECT")}
                  >
                    Request correction
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
