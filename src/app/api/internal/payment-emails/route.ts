import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const expected = Buffer.from(`Bearer ${secret || ""}`);
  const actual = Buffer.from(request.headers.get("authorization") || "");
  if (
    !secret ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { db } = await import("@/server/db");
    const { deliverPaymentEmails } = await import("@/server/payment-email");
    const { deliverPushMessages } = await import("@/server/push");
    const [email, push] = await Promise.all([
      deliverPaymentEmails(db, { limit: 5 }),
      deliverPushMessages(db, { limit: 5 }),
    ]);
    return Response.json({ email, push });
  } catch {
    return Response.json(
      { error: "Notification queue temporarily unavailable" },
      { status: 503 },
    );
  }
}
