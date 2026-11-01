export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Lazy loading keeps database/auth runtime configuration out of static builds.
async function handle(request: Request) {
  const { handleApi } = await import("@/server/app");
  const response = await handleApi(request);
  const path = new URL(request.url).pathname;
  if (
    response.ok &&
    (path.startsWith("/api/me/payment-orders") ||
      path.startsWith("/api/admin/payment-orders"))
  ) {
    after(async () => {
      const { safelyDeliverPaymentEmails } = await import(
        "@/server/payment-email"
      );
      const { safelyDeliverPushMessages } = await import("@/server/push");
      await Promise.allSettled([
        safelyDeliverPaymentEmails(),
        safelyDeliverPushMessages(),
      ]);
    });
  }
  return response;
}
export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
  handle as HEAD,
  handle as OPTIONS,
};
import { after } from "next/server";
