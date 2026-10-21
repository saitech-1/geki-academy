import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../apps/api/src/db.js";
import { createMembershipReminders } from "../apps/api/src/reminders.js";
if (
  !process.env.DATABASE_URL?.includes("127.0.0.1") ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099"
)
  throw new Error("Reminder tests require local services.");
try {
  const now = new Date();
  const endsAt = new Date(now.getTime() + 12 * 3600000);
  const user = await db.user.create({
    data: {
      firebaseUid: "reminder-test-" + randomUUID(),
      email: "reminder@geki.local",
      displayName: "Reminder verification",
      language: "mm",
      memberships: {
        create: {
          plan: "MONTHLY",
          source: "LOCAL_TEST",
          startsAt: now,
          endsAt,
        },
      },
    },
    include: { memberships: true },
  });
  await Promise.all([
    createMembershipReminders(db, now),
    createMembershipReminders(db, now),
  ]);
  const notifications = await db.notification.findMany({
    where: { userId: user.id },
  });
  assert.equal(
    notifications.length,
    1,
    "Concurrent workers must create one notice per stage",
  );
  assert.ok(notifications[0]!.title.includes("အဖွဲ့ဝင်"));
  assert.equal(notifications[0]!.href, "/membership");
  await db.membership.create({
    data: {
      userId: user.id,
      plan: "MONTHLY",
      source: "LOCAL_TEST",
      startsAt: endsAt,
      endsAt: new Date(endsAt.getTime() + 30 * 86400000),
    },
  });
  await createMembershipReminders(db, new Date(endsAt.getTime() + 1000));
  assert.equal(
    await db.notification.count({ where: { userId: user.id } }),
    1,
    "A contiguous renewal prevents expiry notices",
  );
  await db.user.update({ where: { id: user.id }, data: { suspended: true } });
  await createMembershipReminders(
    db,
    new Date(endsAt.getTime() + 31 * 86400000),
  );
  assert.equal(
    await db.notification.count({ where: { userId: user.id } }),
    1,
    "Suspended users receive no new notices",
  );
  console.log(
    JSON.stringify({
      concurrentDedupe: "passed",
      burmeseNotification: "passed",
      renewalSuppression: "passed",
      suspendedUserSuppression: "passed",
    }),
  );
} finally {
  await db.$disconnect();
}
