import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../src/server/db.js";
import { config } from "../src/server/config.js";
import {
  deliverPaymentEmails,
  PAYMENT_EMAIL,
  queuePaymentEmail,
} from "../src/server/payment-email.js";
assert.equal(
  new URL(config.databaseUrl).hostname,
  "127.0.0.1",
  "Email fixtures require local PostgreSQL",
);
assert.notEqual(process.env.NODE_ENV, "production");
const key = randomUUID();
const user = await db.user.create({
  data: {
    firebaseUid: key,
    email: `email-${key}@example.com`,
    displayName: "Email test",
    language: "mm",
  },
});
const course = await db.course.create({
  data: {
    slug: `email-${key}`,
    title: "Kihon email test",
    description: "Local fixture only",
  },
});
let orderId = "";
try {
  const order = await db.paymentOrder.create({
    data: {
      userId: user.id,
      courseId: course.id,
      amountMinor: 3500000,
      status: "SUBMITTED",
      submissions: 1,
      qrImage: "fixture",
      recipient: "fixture",
    },
  });
  orderId = order.id;
  const scope = {
    kind: PAYMENT_EMAIL,
    payload: { path: ["orderId"], equals: order.id },
  };
  const worker = (opts: Parameters<typeof deliverPaymentEmails>[1]) =>
    deliverPaymentEmails(db, { ...opts, orderId: order.id, limit: 10 });
  await db.$transaction(async (tx) => {
    await queuePaymentEmail(tx, order.id, "SUBMITTED");
    await queuePaymentEmail(tx, order.id, "SUBMITTED");
  });
  assert.equal(await db.job.count({ where: scope }), 2);
  await assert.rejects(
    db.$transaction(async (tx) => {
      await queuePaymentEmail(tx, order.id, "APPROVED");
    }),
    /not been persisted/,
  );
  await assert.rejects(
    db.$transaction(async (tx) => {
      await tx.paymentOrder.update({
        where: { id: order.id },
        data: { status: "APPROVED" },
      });
      await queuePaymentEmail(tx, order.id, "APPROVED");
      throw Error("Rollback fixture");
    }),
  );
  assert.equal(await db.job.count({ where: scope }), 2);
  assert.equal(
    (await db.paymentOrder.findUniqueOrThrow({ where: { id: order.id } }))
      .status,
    "SUBMITTED",
  );
  const now = new Date(Date.now() + 1000);
  const rejectSend = async () => {
    throw Object.assign(Error("secret never stored"), { code: "RESEND_429" });
  };
  assert.equal((await worker({ now, send: rejectSend })).failed, 2);
  let jobs = await db.job.findMany({ where: scope });
  assert.ok(
    jobs.every(
      (j) =>
        j.status === "PENDING" &&
        j.attempts === 1 &&
        j.lastError === "RESEND_429",
    ),
  );
  let sends = 0;
  const send = async () => {
    sends++;
    await new Promise((r) => setTimeout(r, 30));
    return "fixture-provider";
  };
  await worker({ now, send });
  assert.equal(sends, 0);
  const due = new Date(now.getTime() + 61000);
  await Promise.all([worker({ now: due, send }), worker({ now: due, send })]);
  assert.equal(sends, 2);
  assert.equal(await db.job.count({ where: { ...scope, status: "SENT" } }), 2);
  await db.$transaction(async (tx) => {
    await tx.paymentOrder.update({
      where: { id: order.id },
      data: { status: "APPROVED" },
    });
    await tx.coursePurchase.create({
      data: {
        userId: user.id,
        courseId: course.id,
        paymentReference: `fixture-${key}`,
        amountMinor: 3500000,
        currency: "MMK",
      },
    });
    await queuePaymentEmail(tx, order.id, "APPROVED");
    await queuePaymentEmail(tx, order.id, "APPROVED");
  });
  assert.equal(await db.job.count({ where: scope }), 4);
  await worker({ now: due, send: rejectSend });
  assert.equal(
    (await db.paymentOrder.findUniqueOrThrow({ where: { id: order.id } }))
      .status,
    "APPROVED",
  );
  assert.equal(
    await db.coursePurchase.count({ where: { userId: user.id } }),
    1,
    "Email failure must preserve approved enrollment",
  );
  await worker({
    now: new Date(due.getTime() + 61000),
    send: async (message) => {
      if (message.audience === "student") {
        assert.equal(message.to, user.email);
        assert.match(message.html, /အတည်ပြု/);
      }
    },
  });
  jobs = await db.job.findMany({ where: scope });
  const first = jobs[0]!;
  const second = jobs[1]!;
  await db.job.update({
    where: { id: first.id },
    data: { status: "PROCESSING", attempts: 6, runAt: now },
  });
  await worker({ now, send });
  assert.equal(
    (await db.job.findUniqueOrThrow({ where: { id: first.id } })).status,
    "FAILED",
  );
  await db.job.update({
    where: { id: second.id },
    data: {
      status: "PROCESSING",
      attempts: 2,
      runAt: now,
      payload: {
        ...(second.payload as object),
        firstAttemptAt: new Date(now.getTime() - 24 * 3600000).toISOString(),
      },
    },
  });
  await worker({ now, send });
  assert.equal(
    (await db.job.findUniqueOrThrow({ where: { id: second.id } })).lastError,
    "PROVIDER_REVIEW_REQUIRED",
  );
  console.log(
    "Email integration passed: state validation, rollback, six-template outbox, retries, concurrent deduplication, preserved approval on failure and expired-idempotency protection.",
  );
} finally {
  if (orderId)
    await db.job.deleteMany({
      where: {
        kind: PAYMENT_EMAIL,
        payload: { path: ["orderId"], equals: orderId },
      },
    });
  await db.coursePurchase.deleteMany({ where: { userId: user.id } });
  await db.paymentOrder.deleteMany({ where: { userId: user.id } });
  await db.course.delete({ where: { id: course.id } });
  await db.user.delete({ where: { id: user.id } });
  await db.$disconnect();
}
