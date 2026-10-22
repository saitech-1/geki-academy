import { createEndpoints, type Request, type Response } from "./http";
import { receiveUpload } from "./uploads";
import { rateLimit } from "./rate-limit";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, readFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
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
  qrImage: true,
  recipient: true,
  course: { select: { title: true, slug: true } },
} as const;
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
  const { courseId } = z
    .object({ courseId: z.string().min(1) })
    .strict()
    .parse(req.body);
  const order = await db.$transaction(async (tx) => {
    await lockUser(tx, req.account.id);
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
    return tx.paymentOrder.upsert({
      where: { userId_courseId: { userId: req.account.id, courseId } },
      create: {
        userId: req.account.id,
        courseId,
        amountMinor: course.priceMinor,
        currency: course.currency,
        qrImage,
        recipient,
      },
      update: {},
      select,
    });
  });
  res.json(order);
});
learnerPayments.get("/", async (req, res) =>
  res.json(
    await db.paymentOrder.findMany({
      where: { userId: req.account.id },
      orderBy: { createdAt: "desc" },
      select,
    }),
  ),
);
learnerPayments.get("/:id", async (req, res) => {
  const order = await db.paymentOrder.findFirst({
    where: { id: id(req), userId: req.account.id },
    select,
  });
  requireCondition(order, 404, "NOT_FOUND", "Payment request not found.");
  res.json(order);
});
learnerPayments.post(
  "/:id/proof",
  rateLimit({
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
  }),
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
    await receiveUpload(req, {
      field: "proof",
      directory: resolve(config.uploadDir, "payment-proofs"),
    });
    next();
  },
  async (req, res) => {
    requireCondition(
      req.file,
      400,
      "PROOF_REQUIRED",
      "Attach a PNG or JPEG payment receipt.",
    );
    let keep = false;
    try {
      const transactionId = z
        .string()
        .trim()
        .transform((v) => v.toUpperCase().replace(/[\s-]/g, ""))
        .pipe(
          z
            .string()
            .regex(
              /^[A-Z0-9]{6,64}$/,
              "Enter the transaction ID from your KBZPay receipt.",
            ),
        )
        .parse(req.body.transactionId);
      const bytes = await readFile(req.file.path);
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
        const duplicate = await tx.paymentOrder.findFirst({
          where: { id: { not: old.id }, OR: [{ transactionId }, { proofSha }] },
        });
        const used = await tx.coursePurchase.findFirst({
          where: {
            paymentReference: {
              in: [transactionId, "KBZPAY:" + transactionId],
            },
          },
        });
        const claimedBefore = await tx.auditEvent.findFirst({
          where: {
            action: "PAYMENT_PROOF_SUBMITTED",
            target: { not: old.id },
            OR: [
              { data: { path: ["transactionId"], equals: transactionId } },
              { data: { path: ["proofSha"], equals: proofSha } },
            ],
          },
        });
        requireCondition(
          !duplicate && !used && !claimedBefore,
          409,
          "PAYMENT_EVIDENCE_USED",
          "That transaction ID or receipt has already been submitted. Contact GEKI if you need help.",
        );
        const updated = await tx.paymentOrder.update({
          where: { id: old.id },
          data: {
            status: "SUBMITTED",
            transactionId,
            proofSha,
            proofPath: "payment-proofs/" + req.file!.filename,
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
      res.json(order);
    } finally {
      if (!keep) await unlink(req.file.path).catch(() => {});
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
    const current = await tx.paymentOrder.findUniqueOrThrow({
      where: { id: existing.id },
    });
    if (current.status === "APPROVED" && input.decision === "APPROVE")
      return tx.paymentOrder.findUniqueOrThrow({
        where: { id: current.id },
        select,
      });
    requireCondition(
      current.status === "SUBMITTED" &&
        current.transactionId &&
        current.proofPath,
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
      await tx.coursePurchase.create({
        data: {
          userId: current.userId,
          courseId: current.courseId,
          paymentReference: "KBZPAY:" + current.transactionId,
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
  res.json(order);
});
