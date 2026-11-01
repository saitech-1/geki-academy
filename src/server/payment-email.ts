import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  emailConfigured,
  emailSettings,
  sendResendEmail,
} from "./email-service";
import { paymentEmail, type PaymentEvent } from "./payment-email-templates";
export { emailConfigured, emailSettings, paymentEmail };
export const PAYMENT_EMAIL = "PAYMENT_EMAIL";
const messageSchema = z
  .object({
    to: z.email(),
    subject: z.string().max(300),
    text: z.string(),
    html: z.string(),
    audience: z.string().optional(),
    firstAttemptAt: z.string().optional(),
  })
  .passthrough();
export type PaymentEmail = z.infer<typeof messageSchema>;

export async function queuePaymentEmail(
  tx: Prisma.TransactionClient,
  orderId: string,
  event: PaymentEvent,
  internalReason?: string,
) {
  const order = await tx.paymentOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: { user: true, course: true },
  });
  if (order.status !== event)
    throw Error("Cannot notify a payment state that has not been persisted");
  // Provider configuration is checked by the worker, never inside payment approval.
  let origin = "https://geki-academy.vercel.app";
  try {
    origin = emailSettings().origin;
  } catch {
    /* Invalid mail config must not roll back a payment. */
  }
  const admin =
    process.env.ADMIN_NOTIFICATION_EMAIL || "saizaybhonehlawn@gmail.com";
  const purchase =
    event === "APPROVED"
      ? await tx.coursePurchase.findUnique({
          where: {
            userId_courseId: { userId: order.userId, courseId: order.courseId },
          },
          select: { paymentReference: true },
        })
      : null;
  for (const audience of ["admin", "student"] as const) {
    const key = [order.id, event, order.submissions, audience].join(":");
    const id = "mail_" + createHash("sha256").update(key).digest("hex");
    const payload = {
      ...paymentEmail({
        event,
        audience,
        to: audience === "admin" ? admin : order.user.email,
        learner: order.user.displayName,
        learnerEmail: order.user.email,
        course:
          audience === "student" &&
          order.user.language === "mm" &&
          order.course.titleMm
            ? order.course.titleMm
            : order.course.title,
        slug: order.course.slug,
        amountMinor: order.amountMinor,
        currency: order.currency,
        orderId,
        language: order.user.language,
        origin,
        timestamp: (event === "SUBMITTED"
          ? order.submittedAt
          : order.reviewedAt
        )?.toISOString(),
        reference: purchase?.paymentReference || order.transactionId,
        reason:
          audience === "admin"
            ? internalReason || order.reviewReason || undefined
            : order.reviewReason || undefined,
      }),
      orderId,
      event,
      audience,
      revision: order.submissions,
    };
    await tx.job.upsert({
      where: { id },
      create: { id, kind: PAYMENT_EMAIL, payload },
      update: {},
    });
  }
}
export async function sendPaymentEmail(message: PaymentEmail, id: string) {
  return sendResendEmail(message, id, message.audience);
}

function safeError(error: unknown) {
  // Provider diagnostics can contain credentials, addresses or message contents.
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "EMAIL_SEND_FAILED";
  return /^[A-Z0-9_]{2,40}$/.test(code) ? code : "EMAIL_SEND_FAILED";
}

export async function deliverPaymentEmails(
  db: PrismaClient,
  options: {
    limit?: number;
    send?: (message: PaymentEmail, id: string) => Promise<void | string>;
    now?: Date;
    orderId?: string;
  } = {},
) {
  if (!options.send && !emailConfigured())
    return { sent: 0, failed: 0, configured: false };
  const now = options.now || new Date();
  await db.job.updateMany({
    where: {
      kind: PAYMENT_EMAIL,
      status: "PROCESSING",
      runAt: { lte: now },
      attempts: { gte: 6 },
      ...(options.orderId
        ? { payload: { path: ["orderId"], equals: options.orderId } }
        : {}),
    },
    data: { status: "FAILED", lastError: "PROVIDER_REVIEW_REQUIRED" },
  });
  const jobs = await db.job.findMany({
    where: {
      kind: PAYMENT_EMAIL,
      status: { in: ["PENDING", "PROCESSING"] },
      runAt: { lte: now },
      attempts: { lt: 6 },
      ...(options.orderId
        ? { payload: { path: ["orderId"], equals: options.orderId } }
        : {}),
    },
    orderBy: { createdAt: "asc" },
    take: Math.min(options.limit ?? 3, 10),
  });
  let sent = 0,
    failed = 0;
  for (const job of jobs) {
    const raw = job.payload as Record<string, Prisma.InputJsonValue>;
    const started =
      typeof raw.firstAttemptAt === "string"
        ? raw.firstAttemptAt
        : now.toISOString();
    if (
      typeof raw.firstAttemptAt === "string" &&
      now.getTime() - new Date(started).getTime() >= 23 * 3600000
    ) {
      await db.job.updateMany({
        where: { id: job.id, status: job.status, attempts: job.attempts },
        data: { status: "FAILED", lastError: "PROVIDER_REVIEW_REQUIRED" },
      });
      continue;
    }
    const lease = new Date(now.getTime() + 5 * 60000);
    const claim = await db.job.updateMany({
      where: {
        id: job.id,
        status: job.status,
        runAt: job.runAt,
        attempts: job.attempts,
      },
      data: {
        status: "PROCESSING",
        runAt: lease,
        attempts: { increment: 1 },
        payload: { ...raw, firstAttemptAt: started },
      },
    });
    if (!claim.count) continue;
    let providerId: void | string;
    try {
      providerId = await (options.send || sendPaymentEmail)(
        messageSchema.parse(job.payload),
        job.id,
      );
    } catch (error) {
      failed++;
      await db.job.updateMany({
        where: { id: job.id, status: "PROCESSING", runAt: lease },
        data: {
          status: job.attempts + 1 >= 6 ? "FAILED" : "PENDING",
          runAt: new Date(
            now.getTime() + Math.min(3600000, 60000 * 2 ** job.attempts),
          ),
          lastError: safeError(error),
        },
      });
      console.error(
        JSON.stringify({
          event: "payment_email_failed",
          jobId: job.id,
          code: safeError(error),
        }),
      );
      continue;
    }
    // Never treat a DB acknowledgement failure as SMTP rejection: retain the lease.
    await db.job.updateMany({
      where: { id: job.id, status: "PROCESSING", runAt: lease },
      data: {
        status: "SENT",
        lastError: null,
        payload: {
          ...raw,
          firstAttemptAt: started,
          providerId: providerId || "test-transport",
          acceptedAt: new Date().toISOString(),
        },
      },
    });
    sent++;
  }
  return { sent, failed, configured: true };
}

export async function safelyDeliverPaymentEmails() {
  try {
    const { db } = await import("./db");
    return await deliverPaymentEmails(db);
  } catch {
    console.error(JSON.stringify({ event: "payment_email_worker_failed" }));
  }
}
