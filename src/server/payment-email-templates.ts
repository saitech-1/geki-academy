import type { EmailMessage } from "./email-service";
export type PaymentEvent = "SUBMITTED" | "APPROVED" | "REJECTED";
export type PaymentEmailInput = {
  event: PaymentEvent;
  audience?: "admin" | "student";
  to: string;
  learner: string;
  learnerEmail?: string;
  course: string;
  slug: string;
  amountMinor: number;
  currency: string;
  orderId: string;
  language: string;
  origin: string;
  timestamp?: string;
  reference?: string | null;
  reason?: string;
};
export const safeRejectionMessage =
  "We could not verify this payment. Please check the amount, recipient and successful payment screenshot, then resubmit or contact GEKI. Do not pay again before checking with us.";
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
function layout(
  title: string,
  content: string,
  url: string,
  cta: string,
  mm: boolean,
) {
  return `<!doctype html><html lang="${mm ? "my" : "en"}"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0a0a0a;color:#f5f4f0;font-family:Arial,'Myanmar Text',sans-serif"><table role="presentation" style="width:100%;border-collapse:collapse"><tr><td style="padding:24px 12px"><table role="presentation" style="width:100%;max-width:560px;margin:auto;border:1px solid #303030;border-radius:16px;background:#151515"><tr><td style="padding:28px"><p style="color:#f5f4f0;font-weight:700;letter-spacing:2px"><span style="color:#d71920">●</span> GEKI ACADEMY</p><h1 style="font-size:26px;line-height:1.5">${escape(title)}</h1>${content}<p style="margin:28px 0"><a href="${escape(url)}" style="display:inline-block;padding:14px 22px;border-radius:8px;background:#d71920;color:white;text-decoration:none;font-weight:700">${escape(cta)}</a></p><p style="font-size:12px;color:#aaa;line-height:1.7">GEKI Academy · Traditional Spirit. Modern Science.<br>${mm ? "သင့်အကောင့်သို့ ဝင်ရောက်ပြီး ဆက်လက်လုပ်ဆောင်နိုင်ပါသည်။" : "Sign in to your account to continue. Opening this email never approves a payment."}</p></td></tr></table></td></tr></table></body></html>`;
}
export function paymentEmail(input: PaymentEmailInput): EmailMessage {
  const audience =
    input.audience || (input.event === "SUBMITTED" ? "admin" : "student");
  const admin = audience === "admin",
    mm = !admin && input.language === "mm";
  const subjects = {
    SUBMITTED: admin
      ? "[GEKI Academy] New Payment Awaiting Review"
      : "GEKI Academy — Payment Received",
    APPROVED: admin
      ? "[GEKI Academy] Payment Approved"
      : "Welcome to GEKI Academy — Your Course Is Ready",
    REJECTED: admin
      ? "[GEKI Academy] Payment Rejected"
      : "GEKI Academy — Payment Update",
  };
  const title =
    input.event === "SUBMITTED"
      ? admin
        ? "A payment needs your review"
        : mm
          ? "ငွေပေးချေမှု အထောက်အထားကို လက်ခံရရှိပါပြီ"
          : "Your payment submission was received"
      : input.event === "APPROVED"
        ? admin
          ? "Payment approved"
          : mm
            ? "သင့်သင်တန်းကို စတင်လေ့လာနိုင်ပါပြီ"
            : "Your course is ready"
        : mm
          ? "ငွေပေးချေမှုကို ပြန်လည်စစ်ဆေးရန် လိုအပ်ပါသည်"
          : "Payment needs attention";
  const body =
    input.event === "SUBMITTED"
      ? admin
        ? "Compare the screenshot with the actual incoming KBZPay payment before approving. Opening this email or link does not approve the payment."
        : mm
          ? "သင့်ငွေပေးချေမှု အထောက်အထားကို ရရှိပါပြီ။ အတည်ပြုရန် စောင့်ဆိုင်းနေပါသည်။ ထပ်မံပေးချေရန် မလိုပါ။"
          : "We received your screenshot. Payment approval is pending; course access starts after GEKI verifies the incoming transfer. Please do not pay again."
      : input.event === "APPROVED"
        ? admin
          ? "The authorized administrator confirmed this payment and activated course access."
          : mm
            ? "သင့်ငွေပေးချေမှုကို အတည်ပြုပြီးပါပြီ။ ဝယ်ယူထားသော သင်တန်းကို သက်တမ်းကန့်သတ်ချက်မရှိ လေ့လာနိုင်ပါပြီ။"
            : "Your payment is approved and your enrollment is active. You now have ongoing access to your purchased course."
        : admin
          ? input.reason || safeRejectionMessage
          : mm && (!input.reason || input.reason === safeRejectionMessage)
            ? "ဤငွေပေးချေမှုကို အတည်မပြုနိုင်သေးပါ။ ပမာဏ၊ လက်ခံသူနှင့် အောင်မြင်သော ငွေပေးချေမှု အထောက်အထားကို စစ်ဆေးပြီး ပြန်လည်တင်သွင်းပါ သို့မဟုတ် GEKI သို့ ဆက်သွယ်ပါ။ အရင်ဆက်သွယ်စစ်ဆေးခြင်းမပြုဘဲ ထပ်မံမပေးချေပါနှင့်။"
            : input.reason || safeRejectionMessage;
  const amount = new Intl.NumberFormat("en", {
    style: "currency",
    currency: input.currency,
    maximumFractionDigits: 0,
  }).format(input.amountMinor / 100);
  const url = new URL(
    admin
      ? "/admin/payments"
      : input.event === "APPROVED"
        ? "/my-learning"
        : `/checkout/${encodeURIComponent(input.slug)}`,
    input.origin,
  ).href;
  const cta = admin
    ? "Review payment"
    : input.event === "APPROVED"
      ? mm
        ? "သင်တန်းကို စတင်လေ့လာမည်"
        : "Start Learning"
      : mm
        ? "ငွေပေးချေမှု အခြေအနေကို ကြည့်ရန်"
        : "View payment status";
  const rows = [
    input.course,
    amount,
    `Order: ${input.orderId}`,
    ...(admin
      ? [
          `Student: ${input.learner}`,
          `Email: ${input.learnerEmail || input.to}`,
          "Method: KBZPay QR",
          `Reference: ${input.reference || "Receipt only — confirm the incoming reference in KBZPay"}`,
          `Timestamp (UTC): ${input.timestamp || "Not recorded"}`,
        ]
      : []),
  ];
  const content = `<p style="line-height:1.8;color:#ddd">${escape(body)}</p>${rows.map((r) => `<p style="font-size:14px;line-height:1.7;overflow-wrap:anywhere">${escape(r)}</p>`).join("")}`;
  return {
    to: input.to,
    subject: subjects[input.event],
    text: `${title}\n\n${body}\n\n${rows.join("\n")}\n\n${cta}: ${url}\n\nGEKI Academy`,
    html: layout(title, content, url, cta, mm),
  };
}
