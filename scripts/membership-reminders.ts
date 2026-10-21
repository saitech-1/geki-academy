import { setTimeout } from "node:timers/promises";
import { db } from "../apps/api/src/db.js";
import { createMembershipReminders } from "../apps/api/src/reminders.js";
const controller = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => controller.abort());
const interval = Number(process.env.REMINDER_INTERVAL_MS || 900000);
if (!Number.isFinite(interval) || interval < 60000)
  throw new Error("Reminder interval must be at least one minute.");
try {
  do {
    try {
      console.log(
        JSON.stringify({
          event: "membership_reminders",
          ...(await createMembershipReminders(db)),
        }),
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "membership_reminders_failed",
          errorType: error instanceof Error ? error.name : "UnknownError",
        }),
      );
      if (process.argv.includes("--once")) process.exitCode = 1;
    }
    if (process.argv.includes("--once") || controller.signal.aborted) break;
    await setTimeout(interval, undefined, { signal: controller.signal }).catch(
      () => {},
    );
  } while (!controller.signal.aborted);
} finally {
  await db.$disconnect();
}
