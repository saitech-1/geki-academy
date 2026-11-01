import { z } from "zod";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};
export class EmailDeliveryError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
export function emailSettings() {
  const mode = z
    .enum(["testing", "production"])
    .parse(process.env.PAYMENT_NOTIFICATION_MODE || "testing");
  const admin = z
    .email()
    .parse(
      process.env.ADMIN_NOTIFICATION_EMAIL || "saizaybhonehlawn@gmail.com",
    );
  const from =
    process.env.RESEND_FROM_EMAIL || "GEKI Academy <onboarding@resend.dev>";
  if (/[\r\n]/.test(from)) throw Error("Invalid sender");
  const address = z.email().parse(from.match(/<([^<>]+)>$/)?.[1] || from);
  const domain = address.split("@")[1]!.toLowerCase();
  if (["gmail.com", "googlemail.com"].includes(domain))
    throw Error("Resend cannot authenticate a personal Gmail sender");
  if (mode === "production" && domain === "resend.dev")
    throw Error("Production requires a verified Resend sending domain");
  const origin = new URL(
    process.env.EMAIL_APP_URL || "https://geki-academy.vercel.app",
  );
  if (
    origin.protocol !== "https:" &&
    !(
      origin.protocol === "http:" &&
      ["127.0.0.1", "localhost"].includes(origin.hostname)
    )
  )
    throw Error("EMAIL_APP_URL must use HTTPS");
  return {
    mode,
    admin,
    from,
    origin: origin.origin,
    apiKey: process.env.RESEND_API_KEY?.trim(),
  };
}
export function emailConfigured() {
  try {
    return (
      !!emailSettings().apiKey &&
      (process.env.NODE_ENV === "production" ||
        process.env.EMAIL_DELIVERY_ENABLED === "true")
    );
  } catch {
    return false;
  }
}
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function routePaymentEmail(message: EmailMessage, audience: string) {
  const settings = emailSettings();
  z.email().parse(message.to);
  if (settings.mode === "production")
    return { ...message, from: settings.from };
  const label = `TESTING · ${audience.toUpperCase()} template · Intended recipient: ${message.to}`;
  return {
    ...message,
    from: settings.from,
    to: settings.admin,
    subject: `[TEST ${audience.toUpperCase()}] ${message.subject}`,
    text: `${label}\n\n${message.text}`,
    html: `<div style="padding:16px;background:#fff3cd;color:#332b00;font:14px Arial">${escape(label)}</div>${message.html}`,
  };
}
export async function sendResendEmail(
  message: EmailMessage,
  id: string,
  audience = "notification",
) {
  const settings = emailSettings();
  if (!settings.apiKey) throw new EmailDeliveryError("EMAIL_NOT_CONFIGURED");
  const envelope = routePaymentEmail(message, audience);
  let response: globalThis.Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `${id}:${settings.mode}`,
      },
      body: JSON.stringify({
        from: envelope.from,
        to: [envelope.to],
        subject: envelope.subject,
        text: envelope.text,
        html: envelope.html,
      }),
    });
  } catch {
    throw new EmailDeliveryError("EMAIL_NETWORK");
  }
  if (!response.ok) throw new EmailDeliveryError(`RESEND_${response.status}`);
  const result = await response.json().catch(() => null);
  if (typeof result?.id !== "string")
    throw new EmailDeliveryError("DELIVERY_UNCONFIRMED");
  return result.id as string;
}
