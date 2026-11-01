import { afterEach, describe, expect, it, vi } from "vitest";
import {
  emailConfigured,
  emailSettings,
  routePaymentEmail,
  sendResendEmail,
} from "./email-service";
import { paymentEmail } from "./payment-email-templates";
import { GET } from "../app/api/internal/payment-emails/route";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const input = {
  event: "SUBMITTED" as const,
  audience: "admin" as const,
  to: "student@example.com",
  learner: '<script>alert("x")</script>',
  learnerEmail: "student@example.com",
  course: "Kihon & basics",
  slug: "kihon-basics",
  amountMinor: 3500000,
  currency: "MMK",
  orderId: "order-1",
  language: "en",
  origin: "https://geki-academy.vercel.app",
};
describe("Resend payment notifications", () => {
  it("escapes untrusted text and preserves exact amounts and manual review", () => {
    const mail = paymentEmail(input);
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.text).toContain("35,000");
    expect(mail.text).toContain("does not approve");
    expect(mail.html).toContain("/admin/payments");
  });
  it("produces all six event and audience templates", () => {
    for (const event of ["SUBMITTED", "APPROVED", "REJECTED"] as const)
      for (const audience of ["admin", "student"] as const) {
        const mail = paymentEmail({ ...input, event, audience });
        expect(mail.subject).toContain("GEKI Academy");
        expect(mail.text).toContain("Order: order-1");
        if (audience === "student") {
          expect(mail.text).not.toContain("Reference:");
          expect(mail.text).not.toContain("admin/payments");
        }
      }
  });
  it("links approved learners to their library with Burmese content", () => {
    const mail = paymentEmail({
      ...input,
      audience: "student",
      event: "APPROVED",
      language: "mm",
    });
    expect(mail.html).toContain('lang="my"');
    expect(mail.html).toContain("အတည်ပြု");
    expect(mail.html).toContain("/my-learning");
  });
  it("routes both templates to the testing inbox and labels intended recipients", () => {
    vi.stubEnv("PAYMENT_NOTIFICATION_MODE", "testing");
    vi.stubEnv("ADMIN_NOTIFICATION_EMAIL", "owner@example.com");
    for (const audience of ["admin", "student"]) {
      const mail = routePaymentEmail(paymentEmail(input), audience);
      expect(mail.to).toBe("owner@example.com");
      expect(mail.text).toContain("Intended recipient: student@example.com");
      expect(mail.subject).toContain("TEST");
    }
  });
  it("rejects Gmail senders and the test sender in production", () => {
    vi.stubEnv("RESEND_FROM_EMAIL", "saizaybhonehlawn@gmail.com");
    expect(() => emailSettings()).toThrow();
    vi.stubEnv("RESEND_FROM_EMAIL", "GEKI <onboarding@resend.dev>");
    vi.stubEnv("PAYMENT_NOTIFICATION_MODE", "production");
    expect(() => emailSettings()).toThrow("verified");
  });
  it("fails closed on an invalid mode and header injection", () => {
    vi.stubEnv("PAYMENT_NOTIFICATION_MODE", "typo");
    expect(() => emailSettings()).toThrow();
    vi.stubEnv("PAYMENT_NOTIFICATION_MODE", "testing");
    expect(() =>
      routePaymentEmail(
        { ...paymentEmail(input), to: "a@example.com\r\nBcc:b@example.com" },
        "student",
      ),
    ).toThrow();
  });
  it("requires HTTPS and isolates fixture sends", () => {
    vi.stubEnv("EMAIL_APP_URL", "http://example.com");
    expect(() => emailSettings()).toThrow("HTTPS");
    vi.stubEnv("EMAIL_APP_URL", "https://example.com");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("EMAIL_DELIVERY_ENABLED", "");
    vi.stubEnv("RESEND_API_KEY", "fake-only");
    expect(emailConfigured()).toBe(false);
  });
  it("uses Resend idempotency and never sends to students in testing mode", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-only");
    vi.stubEnv("PAYMENT_NOTIFICATION_MODE", "testing");
    vi.stubEnv("ADMIN_NOTIFICATION_EMAIL", "owner@example.com");
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "provider-1" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetch);
    expect(
      await sendResendEmail(paymentEmail(input), "message-1", "student"),
    ).toBe("provider-1");
    const [url, options] = fetch.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(options.headers["Idempotency-Key"]).toBe("message-1:testing");
    expect(JSON.parse(options.body).to).toEqual(["owner@example.com"]);
  });
  it("returns safe errors without exposing provider response contents", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-only");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response("sensitive response", { status: 429 })),
    );
    await expect(
      sendResendEmail(paymentEmail(input), "message-1"),
    ).rejects.toMatchObject({ code: "RESEND_429", message: "RESEND_429" });
  });
  it("protects the cron before importing database configuration", async () => {
    vi.stubEnv("CRON_SECRET", "private-secret");
    expect(
      (
        await GET(
          new Request("https://example.com/api/internal/payment-emails"),
        )
      ).status,
    ).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    expect(
      (
        await GET(
          new Request("https://example.com/api/internal/payment-emails", {
            headers: { authorization: "Bearer " },
          }),
        )
      ).status,
    ).toBe(401);
  });
});
