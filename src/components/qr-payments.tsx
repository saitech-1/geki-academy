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
  qrImage: string;
  recipient: string;
  reviewReason: string | null;
  submittedAt: string | null;
  createdAt: string;
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
      setCurrent(
        await api<Order>(`/me/payment-orders/${order.id}/proof`, {
          method: "POST",
          body: form,
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
  return (
    <>
      <Heading
        eyebrow="SECURE YOUR NEXT CHAPTER"
        title={course.title}
        description="Pay once. Keep ongoing access to this course’s lessons and quiz."
      />
      {failure ? <Message error>{failure}</Message> : null}
      {owned || order?.status === "APPROVED" ? (
        <section className="panel stack">
          <Badge tone="green">Payment confirmed</Badge>
          <h2>Your course is ready.</h2>
          <p>Your purchase gives you ongoing access to {course.title}.</p>
          <Button href={"/courses/" + course.slug}>Start your course</Button>
        </section>
      ) : (
        <div className="qr-checkout-grid">
          <section className="panel stack">
            <div className="eyebrow">ONE COURSE. YOUR OWN PACE.</div>
            <h3>Order summary</h3>
            <div className="payment-total">
              {order
                ? money(order)
                : course.priceMinor
                  ? money({
                      amountMinor: course.priceMinor,
                      currency: course.currency,
                    })
                  : "Price to be announced"}
            </div>
            <p>{course.title} · One-time purchase</p>
            <p>
              Includes all lessons in this course, progress tracking and its
              final quiz.
            </p>
            {!account ? (
              <Button
                href={
                  "/signin?next=" +
                  encodeURIComponent("/checkout/" + course.slug)
                }
              >
                Sign in to continue
              </Button>
            ) : !order ? (
              <>
                <Button
                  disabled={busy || !course.priceMinor || !course.kbzPayEnabled}
                  onClick={() => void begin()}
                >
                  {busy ? "Preparing your order…" : "Pay with KBZPay"}
                </Button>
                {!course.kbzPayEnabled ? (
                  <p>QR payments are not enabled for this course yet.</p>
                ) : null}
              </>
            ) : (
              <>
                <Badge
                  tone={
                    order.status === "SUBMITTED"
                      ? "amber"
                      : order.status === "REJECTED"
                        ? "red"
                        : "free"
                  }
                >
                  {stateLabel(order.status)}
                </Badge>
                <small>Order {order.id}</small>
                {order.status === "SUBMITTED" ? (
                  <>
                    <h3>Thanks. We’re checking your payment.</h3>
                    <p>
                      Your receipt is submitted. GEKI will compare the
                      transaction with its incoming KBZPay records before
                      unlocking your course. You’ll receive an account
                      notification after review.
                    </p>
                    <p>Transaction ID: {order.transactionId}</p>
                    <Button
                      secondary
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const updated = await api<Order>(
                            "/me/payment-orders/" + order.id,
                          );
                          setCurrent(updated);
                          await refresh();
                        } catch (e) {
                          setFailure(
                            e instanceof Error
                              ? e.message
                              : "Could not refresh payment status.",
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Refresh payment status
                    </Button>
                    <ReceiptImage orderId={order.id} />
                  </>
                ) : (
                  <>
                    {order.status === "REJECTED" ? (
                      <div className="notice">
                        <strong>Payment needs attention</strong>
                        <p>{order.reviewReason}</p>
                        <p>
                          Check your transaction details before resubmitting.
                          Don’t pay a second time for a transfer that already
                          succeeded.
                        </p>
                      </div>
                    ) : null}
                    <form className="stack" onSubmit={submit}>
                      <h3>Submit your payment details</h3>
                      <label>
                        KBZPay transaction ID
                        <input
                          name="transactionId"
                          required
                          minLength={6}
                          maxLength={64}
                          autoComplete="off"
                          placeholder="Transaction ID from your successful payment"
                          defaultValue={order.transactionId || ""}
                        />
                      </label>
                      <label>
                        Payment receipt
                        <input
                          name="proof"
                          type="file"
                          accept="image/jpeg,image/png"
                          required
                        />
                      </label>
                      <small>
                        PNG or JPEG, up to 5 MB. Show the successful payment,
                        amount, recipient and transaction ID. Keep unrelated
                        balance and transactions out of the image.
                      </small>
                      <label className="consent">
                        <input type="checkbox" required />
                        <span>
                          I have paid the exact amount shown to the recipient on
                          this QR.
                        </span>
                      </label>
                      <Button type="submit" disabled={busy}>
                        {busy
                          ? "Submitting receipt…"
                          : "Submit for verification"}
                      </Button>
                      <small>
                        Receipt submission does not confirm payment or unlock
                        the course.
                      </small>
                    </form>
                  </>
                )}
              </>
            )}
          </section>
          <aside className="panel stack qr-payment-panel">
            <div className="eyebrow">KBZPAY / SCAN TO PAY</div>
            <h3>
              {order
                ? money(order)
                : course.priceMinor
                  ? money({
                      amountMinor: course.priceMinor,
                      currency: course.currency,
                    })
                  : "Price to be announced"}
            </h3>
            {order ? (
              <>
                <img
                  className="payment-qr"
                  src={order.qrImage}
                  alt="KBZPay QR code for Sai Zay Bhone Hlyan, account ending 8829"
                />
                <a
                  className="text-link"
                  href={order.qrImage}
                  download="GEKI-KBZPay-QR.jpg"
                >
                  Save QR image ↓
                </a>
                <p>
                  Recipient: <strong>{order.recipient}</strong>
                </p>
                <ol className="payment-steps">
                  <li>
                    Scan this QR in KBZPay, or save it and use image scanning.
                  </li>
                  <li>
                    Enter exactly <strong>{money(order)}</strong>. Check the
                    recipient before paying.
                  </li>
                  <li>
                    Save the successful receipt and submit it with the
                    transaction ID.
                  </li>
                </ol>
                <small>
                  Payments are checked by the GEKI team against incoming
                  transfers. A screenshot alone cannot verify a payment.
                </small>
              </>
            ) : (
              <p>
                Sign in and open your payment order to view the QR and exact
                payment instructions.
              </p>
            )}
          </aside>
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
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  async function review(decision: string) {
    if (!selected) return;
    setBusy(true);
    setFailure("");
    try {
      await api("/admin/payment-orders/" + selected.id + "/review", {
        method: "POST",
        body: json({ decision, verifiedInKbzPay: verified, reason }),
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
                  <td>{o.transactionId || "—"}</td>
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
              <strong>{selected.transactionId || "Not submitted"}</strong>
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
                    disabled={busy || !verified || reason.trim().length < 8}
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
