import type { Prisma } from "@prisma/client";
import { requireCondition } from "./domain";

export const FOUNDING_LIMIT = 50;
export const RESERVATION_MS = 24 * 3600000;
export async function lockCourse(
  tx: Prisma.TransactionClient,
  courseId: string,
) {
  await tx.$queryRaw`SELECT id FROM "geki"."Course" WHERE id=${courseId} FOR UPDATE`;
}
export async function priceForCheckout(
  tx: Prisma.TransactionClient,
  course: {
    id: string;
    slug: string;
    priceMinor: number | null;
    currency: string;
  },
  excludeOrderId?: string,
) {
  const regularAmountMinor = course.priceMinor!;
  const eligible =
    course.slug === "geki-kihon-package" &&
    course.currency === "MMK" &&
    regularAmountMinor === 5000000;
  if (!eligible)
    return {
      amountMinor: regularAmountMinor,
      regularAmountMinor,
      currency: course.currency,
      founding: false,
    };
  // Paid places are permanent. Unpaid places expire; submitted transfers retain
  // their quoted amount until the team reviews the actual incoming payment.
  const paid = await tx.coursePurchase.count({
    where: { courseId: course.id },
  });
  const reserved = await tx.paymentOrder.count({
    where: {
      courseId: course.id,
      amountMinor: 3500000,
      ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}),
      OR: [
        { status: "SUBMITTED" },
        {
          status: { in: ["AWAITING_PAYMENT", "REJECTED"] },
          updatedAt: { gt: new Date(Date.now() - RESERVATION_MS) },
        },
      ],
    },
  });
  const founding = paid + reserved < FOUNDING_LIMIT;
  return {
    amountMinor: founding ? 3500000 : regularAmountMinor,
    regularAmountMinor,
    currency: course.currency,
    founding,
    placesAvailable: Math.max(0, FOUNDING_LIMIT - paid - reserved),
  };
}
export function assertPriceReservation(order: { updatedAt: Date }) {
  requireCondition(
    order.updatedAt.getTime() > Date.now() - RESERVATION_MS,
    409,
    "ORDER_EXPIRED",
    "Your payment window expired. Refresh your order to confirm the current price before paying. If you already paid, contact GEKI for review before paying again.",
  );
}
