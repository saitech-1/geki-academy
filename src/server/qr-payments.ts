import { createEndpoints, type Request, type Response } from "./http";
import {
  createReceiptUpload,
  readReceiptUpload,
  receiptDownload,
  receiptStorageConfigured,
  ensurePrivateReceiptStorage,
} from "./receipt-storage";
import { receiveUpload } from "./uploads";
import { rateLimit } from "./rate-limit";
import { createHash } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import {
  priceForCheckout,
  lockCourse,
  assertPriceReservation,
} from "./course-pricing";
import { db, lockUser } from "./db";
import { config } from "./config";
import { HttpError, requireCondition } from "./domain";
import { sendLocalMedia } from "./media";
import { ReasonInput } from "@geki/contracts";

export const qrCheckout = createEndpoints();
export const learnerPayments = createEndpoints();
export const adminPayments = createEndpoints();
const qrImage = "/images/payments/kbzpay-9f2c51401cd1.jpg";
const recipient = "Sai Zay Bhone Hlyan (ending 8829)";
const select = {
  id: true,
  courseId: true,
  amountMinor: true,
  currency: true,
  status: true,
  transactionId: true,
  submittedAt: true,
  reviewedAt: true,
  reviewReason: true,
  createdAt: true,
  updatedAt: true,
  qrImage: true,
  recipient: true,
  course: { select: { title: true, slug: true } },
} as const;
const receiptLimit = rateLimit({
  windowMs: 3600000,
  limit: 10,
  keyGenerator: (req) => req.account.id,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({
      code: "PAYMENT_RATE_LIMIT",
      error: "Too many receipt uploads. Try again later or contact GEKI.",
    }),
});
const id = (req: Request) => z.string().min(1).parse(req.params.id);
function requireBuyer(req: Request) {
  requireCondition(
    req.identity.email_verified,
    403,
    "EMAIL_UNVERIFIED",
    "Verify your email before making a payment.",
  );
  requireCondition(
    req.account.onboarded,
    403,
    "PROFILE_REQUIRED",
    "Complete your learner or guardian profile first.",
  );
}
qrCheckout.post("/", async (req, res) => {
  requireBuyer(req);
  if (receiptStorageConfigured()) await ensurePrivateReceiptStorage();
  requireCondition(
    !process.env.VERCEL || receiptStorageConfigured(),
    503,
    "RECEIPT_STORAGE_UNAVAILABLE",
    "Payment is temporarily unavailable while private receipt storage is configured. Please contact GEKI before paying.",
  );
  const { courseId } = z
    .object({ courseId: z.string().min(1) })
    .strict()
    .parse(req.body);
  const order = await db.$transaction(async (tx) => {
    await lockUser(tx, req.account.id);
    await lockCourse(tx, courseId);
    const course = await tx.course.findUnique({ where: { id: courseId } });
    requireCondition(
      course?.status === "PUBLISHED",
      404,
      "NOT_FOUND",
      "Course unavailable.",
    );
    requireCondition(
      course.kbzPayEnabled && course.currency === "MMK" && course.priceMinor,
      409,
      "QR_NOT_AVAILABLE",
      "KBZPay checkout is not available for this course yet.",
    );
    const owned = await tx.coursePurchase.findUnique({
      where: { userId_courseId: { userId: req.account.id, courseId } },
    });
    requireCondition(
      !owned,
      409,
      "ALREADY_PURCHASED",
      owned?.revokedAt
        ? "This course purchase needs support review. Contact GEKI before paying again."
        : "You already own this course. Open it in My Courses.",
    );
    const existing = await tx.paymentOrder.findUnique({
      where: { userId_courseId: { userId: req.account.id, courseId } },
    });
    if (existing && ["SUBMITTED", "APPROVED"].includes(existing.status))
      return tx.paymentOrder.findUniqueOrThrow({
        where: { id: existing.id },
        select,
      });
    if (existing && existing.updatedAt.getTime() > Date.now() - 24 * 3600000)
      return tx.paymentOrder.findUniqueOrThrow({
        where: { id: existing.id },
        select,
      });
    const price = await priceForCheckout(tx, course, existing?.id);
    return tx.paymentOrder.upsert({
      where: { userId_courseId: { userId: req.account.id, courseId } },
      create: {
        userId: req.account.id,
        courseId,
        amountMinor: price.amountMinor,
        currency: course.currency,
        qrImage,
        recipient,
      },
      update: { amountMinor: price.amountMinor, updatedAt: new Date() },
      select,
    });
  });
  res.json({
    ...order,
    receiptUpload:
      receiptStorageConfigured() || process.env.VERCEL ? "direct" : "local",
  });
});
qrCheckout.get("/quote/:courseId", async (req, res) => {
  const courseId = z.string().min(1).parse(req.params.courseId);
  const quote = await db.$transaction(async (tx) => {
    await lockCourse(tx, courseId);
    const course = await tx.course.findUnique({ where: { id: courseId } });
    requireCondition(
      course?.status === "PUBLISHED" && course.priceMinor,
      404,
      "NOT_FOUND",
      "Course unavailable.",
    );
    return priceForCheckout(tx, course);
  });
  res.json(quote);
});
learnerPayments.get("/", async (req, res) =>
  res.json(
    (
      await db.paymentOrder.findMany({
        where: { userId: req.account.id },
        orderBy: { createdAt: "desc" },
        select,
      })
    ).map((order) => ({
      ...order,
      receiptUpload:
        receiptStorageConfigured() || process.env.VERCEL ? "direct" : "local",
    })),
  ),
);
learnerPayments.get("/:id", async (req, res) => {
  const order = await db.paymentOrder.findFirst({
    where: { id: id(req), userId: req.account.id },
    select,
  });
  requireCondition(order, 404, "NOT_FOUND", "Payment request not found.");
  res.json({
    ...order,
    receiptUpload:
      receiptStorageConfigured() || process.env.VERCEL ? "direct" : "local",
  });
});
learnerPayments.post("/:id/upload", receiptLimit, async (req, res) => {
  requireBuyer(req);
  const order = await db.paymentOrder.findFirst({
    where: { id: id(req), userId: req.account.id },
  });
  requireCondition(
    order && ["AWAITING_PAYMENT", "REJECTED"].includes(order.status),
    409,
    "PAYMENT_LOCKED",
    "Open an available payment order first.",
  );
  assertPriceReservation(order);
  res.json(await createReceiptUpload(req.account.id, order.id));
});
learnerPayments.post(
  "/:id/proof",
  receiptLimit,
  async (req, _res, next) => {
    requireBuyer(req);
    const order = await db.paymentOrder.findFirst({
      where: { id: id(req), userId: req.account.id },
    });
    requireCondition(order, 404, "NOT_FOUND", "Payment request not found.");
    requireCondition(
      ["AWAITING_PAYMENT", "REJECTED"].includes(order.status),
      409,
      "PAYMENT_LOCKED",
      "This payment has already been submitted. Wait for review before sending another receipt.",
    );
    if (req.body.uploadToken) {
      req.receipt = await readReceiptUpload(
        z.string().max(2000).parse(req.body.uploadToken),
        req.account.id,
        order.id,
      );
      next();
      return;
    }
    requireCondition(
      !process.env.VERCEL && !receiptStorageConfigured(),
      400,
      "DIRECT_UPLOAD_REQUIRED",
      "Use the secure receipt photo upload.",
    );
    await receiveUpload(req, {
      field: "proof",
      directory: resolve(config.uploadDir, "payment-proofs"),
    });
    next();
  },
  async (req, res) => {
    requireCondition(
      req.file || req.receipt,
      400,
      "PROOF_REQUIRED",
      "Attach a PNG or JPEG payment receipt.",
    );
    let keep = false;
    try {
      // Older clients may still supply a reference; a receipt alone is sufficient.
      const transactionId = req.body.transactionId
        ? z
            .string()
            .trim()
            .transform((v) => v.toUpperCase().replace(/[\s-]/g, ""))
            .pipe(z.string().regex(/^[A-Z0-9]{6,64}$/))
            .parse(req.body.transactionId)
        : null;
      const bytes = req.receipt?.bytes || (await readFile(req.file!.path));
      const png = bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      requireCondition(
        png || jpeg,
        400,
        "INVALID_RECEIPT",
        "The receipt must be a valid PNG or JPEG image.",
      );
      const proofSha = createHash("sha256").update(bytes).digest("hex");
      const order = await db.$transaction(async (tx) => {
        await lockUser(tx, req.account.id);
        const old = await tx.paymentOrder.findFirst({
          where: { id: id(req), userId: req.account.id },
        });
        requireCondition(
          old && ["AWAITING_PAYMENT", "REJECTED"].includes(old.status),
          409,
          "PAYMENT_LOCKED",
          "This payment has already been submitted.",
        );
        requireCondition(
          old.submissions < 5,
          409,
          "REVIEW_LIMIT",
          "Contact GEKI for help after repeated payment rejections.",
        );
        await lockCourse(tx, old.courseId);
        assertPriceReservation(old);
        const duplicate = await tx.paymentOrder.findFirst({
          where: {
            id: { not: old.id },
            OR: [...(transactionId ? [{ transactionId }] : []), { proofSha }],
          },
        });
        const used = transactionId
          ? await tx.coursePurchase.findFirst({
              where: {
                paymentReference: {
                  in: [transactionId, "KBZPAY:" + transactionId],
                },
              },
            })
          : null;
        const claimedBefore = await tx.auditEvent.findFirst({
          where: {
            action: "PAYMENT_PROOF_SUBMITTED",
            target: { not: old.id },
            OR: [
              ...(transactionId
                ? [{ data: { path: ["transactionId"], equals: transactionId } }]
                : []),
              { data: { path: ["proofSha"], equals: proofSha } },
            ],
          },
        });
        requireCondition(
          !duplicate && !used && !claimedBefore,
          409,
          "PAYMENT_EVIDENCE_USED",
          "That receipt or payment reference has already been submitted. Contact GEKI if you need help.",
        );
        const updated = await tx.paymentOrder.update({
          where: { id: old.id },
          data: {
            status: "SUBMITTED",
            transactionId,
            proofSha,
            proofPath:
              req.receipt?.path || "payment-proofs/" + req.file!.filename,
            proofMime: png ? "image/png" : "image/jpeg",
            submittedAt: new Date(),
            reviewedAt: null,
            reviewerId: null,
            reviewReason: null,
            submissions: { increment: 1 },
          },
          select,
        });
        await tx.auditEvent.create({
          data: {
            actorId: req.account.id,
            action: "PAYMENT_PROOF_SUBMITTED",
            target: old.id,
            reason: "Learner submitted KBZPay evidence for manual verification",
            data: {
              transactionId,
              proofSha,
              previousTransactionId: old.transactionId,
              previousProofPath: old.proofPath,
            },
          },
        });
        return updated;
      });
      keep = true;
      res.json({
        ...order,
        receiptUpload:
          receiptStorageConfigured() || process.env.VERCEL ? "direct" : "local",
      });
    } finally {
      if (!keep && req.file) await unlink(req.file.path).catch(() => {});
    }
  },
);
async function proof(req: Request, res: Response) {
  const order = await db.paymentOrder.findFirst({
    where: {
      id: id(req),
      ...(req.account.role === "STUDENT" || !req.identity.email_verified
        ? { userId: req.account.id }
        : {}),
    },
  });
  requireCondition(order?.proofPath, 404, "NOT_FOUND", "Receipt not found.");
  if (order.proofPath.startsWith("supabase:")) {
    res.type(order.proofMime || "image/jpeg");
    res.setHeader("Cache-Control", "private, no-store");
    res.send(await receiptDownload(order.proofPath));
    return;
  }
  await sendLocalMedia(
    req,
    res,
    order.proofPath,
    order.proofMime || "image/jpeg",
    true,
  );
}
learnerPayments.get("/:id/proof", proof);
adminPayments.get("/", async (req, res) => {
  const status = z
    .enum(["SUBMITTED", "APPROVED", "REJECTED", "AWAITING_PAYMENT", "ALL"])
    .default("SUBMITTED")
    .parse(req.query.status);
  res.json(
    await db.paymentOrder.findMany({
      where: status === "ALL" ? {} : { status },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        ...select,
        user: { select: { email: true, displayName: true } },
      },
    }),
  );
});
adminPayments.get("/:id/proof", proof);
adminPayments.post("/:id/review", async (req, res) => {
  const input = ReasonInput.extend({
    decision: z.enum(["APPROVE", "REJECT"]),
    verifiedInKbzPay: z.boolean().default(false),
    bankReference: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase().replace(/[\s-]/g, ""))
      .pipe(z.string().regex(/^[A-Z0-9]{6,64}$/))
      .optional(),
  })
    .strict()
    .parse(req.body);
  requireCondition(
    input.decision !== "APPROVE" || input.verifiedInKbzPay,
    400,
    "VERIFICATION_REQUIRED",
    "Verify the incoming transaction, recipient, amount and transaction ID in your own KBZPay account before approving.",
  );
  const existing = await db.paymentOrder.findUnique({ where: { id: id(req) } });
  requireCondition(existing, 404, "NOT_FOUND", "Payment request not found.");
  requireCondition(
    existing.userId !== req.account.id,
    403,
    "SELF_REVIEW_DENIED",
    "Another administrator must review your payment.",
  );
  const order = await db.$transaction(async (tx) => {
    await lockUser(tx, existing.userId);
    await lockCourse(tx, existing.courseId);
    const current = await tx.paymentOrder.findUniqueOrThrow({
      where: { id: existing.id },
    });
    if (current.status === "APPROVED" && input.decision === "APPROVE")
      return tx.paymentOrder.findUniqueOrThrow({
        where: { id: current.id },
        select,
      });
    requireCondition(
      current.status === "SUBMITTED" && current.proofPath,
      409,
      "PAYMENT_NOT_PENDING",
      "This payment is not waiting for review. Refresh the review queue.",
    );
    if (input.decision === "APPROVE") {
      const purchase = await tx.coursePurchase.findUnique({
        where: {
          userId_courseId: {
            userId: current.userId,
            courseId: current.courseId,
          },
        },
      });
      requireCondition(
        !purchase,
        409,
        "PURCHASE_EXISTS",
        "This learner already has a course purchase. Check for duplicate payment before taking action.",
      );
      const bankReference = input.bankReference || current.transactionId;
      requireCondition(
        bankReference,
        400,
        "BANK_REFERENCE_REQUIRED",
        "Read the payment reference in your own KBZPay account and record it before approving.",
      );
      requireCondition(
        !(await tx.coursePurchase.findUnique({
          where: { paymentReference: "KBZPAY:" + bankReference },
        })),
        409,
        "PAYMENT_EVIDENCE_USED",
        "This incoming KBZPay payment has already been used for a course purchase.",
      );
      await tx.coursePurchase.create({
        data: {
          userId: current.userId,
          courseId: current.courseId,
          paymentReference: "KBZPAY:" + bankReference,
          amountMinor: current.amountMinor,
          currency: current.currency,
        },
      });
    }
    const updated = await tx.paymentOrder.update({
      where: { id: current.id },
      data: {
        status: input.decision === "APPROVE" ? "APPROVED" : "REJECTED",
        reviewedAt: new Date(),
        reviewerId: req.account.id,
        reviewReason: input.reason,
      },
      select,
    });
    await tx.notification.create({
      data: {
        userId: current.userId,
        title:
          input.decision === "APPROVE"
            ? "Payment confirmed — your course is unlocked"
            : "Payment needs attention",
        body:
          input.decision === "APPROVE"
            ? "Your KBZPay payment was verified. You now have ongoing access to your course."
            : input.reason,
        href:
          input.decision === "APPROVE"
            ? "/purchases"
            : "/checkout/" + updated.course.slug,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorId: req.account.id,
        action: "PAYMENT_" + updated.status,
        target: current.id,
        reason: input.reason,
        data: {
          transactionId: current.transactionId,
          amountMinor: current.amountMinor,
          currency: current.currency,
        },
      },
    });
    return updated;
  });
  res.json({
    ...order,
    receiptUpload:
      receiptStorageConfigured() || process.env.VERCEL ? "direct" : "local",
  });
});
