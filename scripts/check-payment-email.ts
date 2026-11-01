import { emailSettings, sendResendEmail } from "../src/server/email-service.js";
import { randomUUID } from "node:crypto";
try {
  const settings = emailSettings();
  if (!settings.apiKey)
    throw Error("Save RESEND_API_KEY in the ignored environment file first.");
  console.log(`Resend configuration is valid. Mode: ${settings.mode}.`);
  if (process.argv.includes("--send-test")) {
    const id = await sendResendEmail(
      {
        to: settings.admin,
        subject: "GEKI Academy — email connection test",
        text: "Resend payment notifications are connected. Connection test only: no payment or course access changed.",
        html: "<h1>GEKI Academy</h1><p>Resend connection test only: no payment or course access changed.</p>",
      },
      "connection_" + randomUUID(),
      "admin",
    );
    console.log("Connection test accepted by Resend. Provider ID:", id);
  } else
    console.log(
      "No email sent. Add --send-test to test actual provider acceptance.",
    );
} catch (error) {
  console.error(error instanceof Error ? error.message : "Email check failed.");
  process.exitCode = 1;
}
