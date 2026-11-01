import webpush from "web-push";
import { createHash, createECDH } from "node:crypto";
import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";
import { createEndpoints } from "./http";
import { db, lockUser } from "./db";
import { requireCondition } from "./domain";
import { rateLimit } from "./rate-limit";

export const PUSH_MESSAGE = "PUSH_MESSAGE";
export function pushSettings() {
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY || "";
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY || "";
  const subject =
    process.env.WEB_PUSH_SUBJECT || "mailto:saizaybhonehlawn@gmail.com";
  if (
    !/^[A-Za-z0-9_-]+$/.test(publicKey + privateKey) ||
    Buffer.from(publicKey, "base64url").length !== 65 ||
    Buffer.from(privateKey, "base64url").length !== 32
  )
    throw Error("PUSH_NOT_CONFIGURED");
  z.email().parse(subject.replace(/^mailto:/, ""));
  if (!subject.startsWith("mailto:")) throw Error("PUSH_NOT_CONFIGURED");
  const curve = createECDH("prime256v1");
  curve.setPrivateKey(Buffer.from(privateKey, "base64url"));
  if (!curve.getPublicKey().equals(Buffer.from(publicKey, "base64url")))
    throw Error("PUSH_KEY_MISMATCH");
  return {
    publicKey,
    privateKey,
    subject,
    keyId: createHash("sha256").update(publicKey).digest("hex").slice(0, 16),
  };
}
export function pushConfigured() {
  try {
    pushSettings();
    return true;
  } catch {
    return false;
  }
}
export function validPushEndpoint(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname;
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === "443") &&
      url.pathname.length > 1 &&
      (host === "fcm.googleapis.com" ||
        host === "updates.push.services.mozilla.com" ||
        host.endsWith(".push.services.mozilla.com") ||
        host.endsWith(".push.apple.com") ||
        host.endsWith(".notify.windows.com"))
    );
  } catch {
    return false;
  }
}
const subscriptionInput = z
  .object({
    endpoint: z
      .string()
      .max(2048)
      .refine(validPushEndpoint, "Unsupported push service"),
    keys: z
      .object({
        p256dh: z
          .string()
          .regex(/^[A-Za-z0-9_-]+$/)
          .max(100),
        auth: z
          .string()
          .regex(/^[A-Za-z0-9_-]+$/)
          .max(40),
      })
      .strict(),
  })
  .strict();
export const pushEndpoints = createEndpoints();
pushEndpoints.get("/status", async (req, res) => {
  const secret = req.headers["x-device-key"] || "";
  const subscription = await db.pushSubscription.findFirst({
    where: {
      device: {
        userId: req.account.id,
        secretHash: createHash("sha256").update(secret).digest("hex"),
        revokedAt: null,
      },
    },
    select: { keyId: true },
  });
  const settings = pushConfigured() ? pushSettings() : null;
  res.json({
    configured: !!settings,
    enabled: !!subscription && subscription.keyId === settings?.keyId,
    publicKey: settings?.publicKey || null,
    keyId: settings?.keyId || null,
  });
});
pushEndpoints.post(
  "/subscription",
  rateLimit({
    windowMs: 60000,
    limit: 10,
    keyGenerator: (req) => req.account.id,
  }),
  async (req, res) => {
    requireCondition(
      req.identity.email_verified,
      403,
      "EMAIL_UNVERIFIED",
      "Verify your email before enabling notifications.",
    );
    requireCondition(
      pushConfigured(),
      503,
      "PUSH_NOT_CONFIGURED",
      "Background notifications are not configured yet.",
    );
    const input = subscriptionInput.parse(req.body);
    const pub = Buffer.from(input.keys.p256dh, "base64url"),
      auth = Buffer.from(input.keys.auth, "base64url");
    requireCondition(
      pub.length === 65 && pub[0] === 4 && auth.length === 16,
      400,
      "INVALID_SUBSCRIPTION",
      "Invalid browser subscription.",
    );
    try {
      const curve = createECDH("prime256v1");
      curve.generateKeys();
      curve.computeSecret(pub);
    } catch {
      requireCondition(
        false,
        400,
        "INVALID_SUBSCRIPTION",
        "Invalid browser subscription.",
      );
    }
    const secret = z
      .string()
      .min(32)
      .max(150)
      .parse(req.headers["x-device-key"]);
    await db.$transaction(async (tx) => {
      await lockUser(tx, req.account.id);
      const device = await tx.device.findFirst({
        where: {
          userId: req.account.id,
          secretHash: createHash("sha256").update(secret).digest("hex"),
          revokedAt: null,
        },
      });
      const deviceLimitReached =
        !device &&
        (await tx.device.count({
          where: { userId: req.account.id, revokedAt: null },
        })) >= 2;
      requireCondition(
        device,
        403,
        deviceLimitReached ? "DEVICE_LIMIT" : "DEVICE_REQUIRED",
        deviceLimitReached
          ? "You already have two devices registered. Please remove one in My Devices before continuing."
          : "Register this browser in My Devices before enabling notifications.",
      );
      const existing = await tx.pushSubscription.findUnique({
        where: { endpoint: input.endpoint },
      });
      requireCondition(
        !existing || existing.deviceId === device.id,
        409,
        "PUSH_OWNER_CONFLICT",
        "Reset browser notifications before using this account.",
      );
      const values = {
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        keyId: pushSettings().keyId,
      };
      await tx.pushSubscription.upsert({
        where: { deviceId: device.id },
        create: { deviceId: device.id, ...values },
        update: values,
      });
    });
    res.json({ enabled: true });
  },
);
pushEndpoints.delete("/subscription", async (req, res) => {
  const endpoint = z.string().max(2048).parse(req.body.endpoint);
  await db.pushSubscription.deleteMany({
    where: { endpoint, device: { userId: req.account.id } },
  });
  res.json({ enabled: false });
});

async function notify(
  tx: Prisma.TransactionClient,
  userId: string,
  eventKey: string,
  title: string,
  body: string,
  href: string,
  orderId: string,
  audience: "admin" | "learner",
  background: boolean,
  event: "SUBMITTED" | "APPROVED" | "REJECTED",
) {
  const notification = await tx.notification.upsert({
    where: { dedupeKey: eventKey },
    create: { userId, title, body, href, dedupeKey: eventKey },
    update: {},
  });
  if (!background) return;
  const subscriptions = await tx.pushSubscription.findMany({
    where: { device: { userId, revokedAt: null } },
    select: { id: true },
  });
  for (const sub of subscriptions) {
    const id =
      "push_" +
      createHash("sha256").update(`${notification.id}:${sub.id}`).digest("hex");
    await tx.job.upsert({
      where: { id },
      create: {
        id,
        kind: PUSH_MESSAGE,
        payload: {
          notificationId: notification.id,
          userId,
          subscriptionId: sub.id,
          title,
          body,
          href,
          orderId,
          audience,
          event,
        },
      },
      update: {},
    });
  }
}
export async function paymentPushNotifications(
  tx: Prisma.TransactionClient,
  orderId: string,
  event: "SUBMITTED" | "APPROVED" | "REJECTED",
  reviewerId?: string,
) {
  const order = await tx.paymentOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: { user: true, course: { select: { slug: true } } },
  });
  if (order.status !== event)
    throw Error("Cannot notify an uncommitted payment state");
  const prefix = `payment:${order.id}:${order.submissions}:${event}`;
  if (event === "SUBMITTED") {
    const admins = await tx.user.findMany({
      where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, suspended: false },
      select: { id: true, language: true },
    });
    for (const admin of admins)
      await notify(
        tx,
        admin.id,
        `${prefix}:admin:${admin.id}`,
        admin.language === "mm"
          ? "ငွေပေးချေမှုအသစ် စစ်ဆေးရန်"
          : "New payment to review",
        admin.language === "mm"
          ? "ငွေပေးချေမှု အထောက်အထားအသစ် ရရှိပါပြီ။ GEKI တွင် စစ်ဆေးနိုင်ပါသည်။"
          : "A payment screenshot is ready. Open GEKI to review it.",
        "/admin/payments",
        order.id,
        "admin",
        true,
        event,
      );
  } else {
    await notify(
      tx,
      order.userId,
      `${prefix}:learner`,
      event === "APPROVED"
        ? order.user.language === "mm"
          ? "သင့်သင်တန်း အဆင်သင့်ဖြစ်ပါပြီ"
          : "Your course is ready"
        : "Payment needs attention",
      event === "APPROVED"
        ? order.user.language === "mm"
          ? "ငွေပေးချေမှု အတည်ပြုပြီးပါပြီ။ GEKI တွင် စတင်လေ့လာနိုင်ပါပြီ။"
          : "Payment approved. Open your library to start learning."
        : order.reviewReason || "Check your payment update.",
      event === "APPROVED" ? "/my-learning" : "/checkout/" + order.course.slug,
      order.id,
      "learner",
      event === "APPROVED",
      event,
    );
    if (reviewerId)
      await notify(
        tx,
        reviewerId,
        `${prefix}:reviewer`,
        event === "APPROVED" ? "Payment confirmed" : "Payment review saved",
        event === "APPROVED"
          ? "You approved a payment. Course access is active."
          : "Your review was saved and the learner can see the update.",
        "/admin/payments",
        order.id,
        "admin",
        event === "APPROVED",
        event,
      );
  }
}

const pushPayload = z.object({
  notificationId: z.string(),
  userId: z.string(),
  subscriptionId: z.string(),
  title: z.string().max(150),
  body: z.string().max(350),
  href: z.enum(["/admin/payments", "/my-learning"]),
  orderId: z.string(),
  audience: z.enum(["admin", "learner"]),
  event: z.enum(["SUBMITTED", "APPROVED"]),
});
export async function deliverPushMessages(
  database: PrismaClient,
  options: {
    now?: Date;
    limit?: number;
    orderId?: string;
    send?: typeof webpush.sendNotification;
  } = {},
) {
  if (!pushConfigured() && !options.send) return { configured: false, sent: 0 };
  if (
    !options.send &&
    process.env.NODE_ENV !== "production" &&
    process.env.PUSH_DELIVERY_ENABLED !== "true"
  )
    return { configured: true, sent: 0, paused: true };
  const now = options.now || new Date();
  await database.job.updateMany({
    where: {
      kind: PUSH_MESSAGE,
      status: "PROCESSING",
      attempts: { gte: 6 },
      runAt: { lte: now },
      ...(options.orderId
        ? { payload: { path: ["orderId"], equals: options.orderId } }
        : {}),
    },
    data: { status: "FAILED", lastError: "PUSH_DELIVERY_UNCONFIRMED" },
  });
  const jobs = await database.job.findMany({
    where: {
      kind: PUSH_MESSAGE,
      status: { in: ["PENDING", "PROCESSING"] },
      runAt: { lte: now },
      attempts: { lt: 6 },
      ...(options.orderId
        ? { payload: { path: ["orderId"], equals: options.orderId } }
        : {}),
    },
    orderBy: { createdAt: "asc" },
    take: Math.min(options.limit || 5, 10),
  });
  let sent = 0;
  for (const job of jobs) {
    const lease = new Date(now.getTime() + 120000);
    const claimed = await database.job.updateMany({
      where: {
        id: job.id,
        status: job.status,
        runAt: job.runAt,
        attempts: job.attempts,
      },
      data: { status: "PROCESSING", runAt: lease, attempts: { increment: 1 } },
    });
    if (!claimed.count) continue;
    try {
      const p = pushPayload.parse(job.payload);
      const sub = await database.pushSubscription.findFirst({
        where: {
          id: p.subscriptionId,
          device: {
            userId: p.userId,
            revokedAt: null,
            user: {
              suspended: false,
              ...(p.audience === "admin"
                ? { role: { in: ["ADMIN", "SUPER_ADMIN"] } }
                : {}),
            },
          },
        },
      });
      const order = await database.paymentOrder.findUnique({
        where: { id: p.orderId },
        select: { status: true, userId: true, courseId: true },
      });
      const unread = await database.notification.findFirst({
        where: { id: p.notificationId, userId: p.userId, readAt: null },
        select: { id: true },
      });
      const active =
        p.href === "/my-learning" && order
          ? await database.coursePurchase.findFirst({
              where: {
                userId: p.userId,
                courseId: order.courseId,
                revokedAt: null,
              },
            })
          : true;
      const pendingAlert = p.event === "SUBMITTED";
      if (
        !sub ||
        !unread ||
        !order ||
        !active ||
        (pendingAlert && order.status !== "SUBMITTED") ||
        (!pendingAlert && order.status !== "APPROVED") ||
        !validPushEndpoint(sub.endpoint) ||
        now.getTime() - job.createdAt.getTime() > 86400000 ||
        (!options.send && sub.keyId !== pushSettings().keyId)
      ) {
        await database.job.update({
          where: { id: job.id },
          data: { status: "SKIPPED", lastError: null },
        });
        continue;
      }
      const settings = pushSettings();
      await (options.send || webpush.sendNotification)(
        {
          endpoint: sub.endpoint,
          keys: { auth: sub.auth, p256dh: sub.p256dh },
        },
        JSON.stringify(p),
        {
          TTL: 3600,
          timeout: 10000,
          urgency: "normal",
          topic: createHash("sha256")
            .update(job.id)
            .digest("base64url")
            .slice(0, 32),
          vapidDetails: {
            subject: settings.subject,
            publicKey: settings.publicKey,
            privateKey: settings.privateKey,
          },
        },
      );
      await database.job.update({
        where: { id: job.id },
        data: { status: "SENT", lastError: null },
      });
      sent++;
    } catch (error) {
      const status =
        error && typeof error === "object" && "statusCode" in error
          ? Number(error.statusCode)
          : 0;
      if (status === 404 || status === 410) {
        const parsed = pushPayload.safeParse(job.payload);
        if (parsed.success)
          await database.pushSubscription.deleteMany({
            where: { id: parsed.data.subscriptionId },
          });
      }
      await database.job.update({
        where: { id: job.id },
        data: {
          status:
            status === 404 || status === 410
              ? "SKIPPED"
              : job.attempts >= 5
                ? "FAILED"
                : "PENDING",
          runAt: new Date(now.getTime() + 60000 * 2 ** job.attempts),
          lastError: status ? `PUSH_${status}` : "PUSH_SEND_FAILED",
        },
      });
    }
  }
  return { configured: true, sent };
}
export async function safelyDeliverPushMessages() {
  try {
    await deliverPushMessages(db);
  } catch {
    console.error(JSON.stringify({ event: "push_worker_failed" }));
  }
}
