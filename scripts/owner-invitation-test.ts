import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../src/server/db.js";
import { acceptOwnerInvitation } from "../src/server/owner-bootstrap.js";
if (
  !process.env.DATABASE_URL?.includes("127.0.0.1") ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099"
)
  throw new Error("Owner invitation tests require local services.");
try {
  const email = `owner-${randomUUID()}@geki.local`;
  const user = await db.user.create({
    data: {
      firebaseUid: randomUUID(),
      email,
      displayName: "Owner invitation verification",
    },
  });
  assert.equal(
    (
      await acceptOwnerInvitation(
        db,
        user,
        { email, email_verified: false },
        email,
      )
    ).role,
    "STUDENT",
  );
  assert.equal(
    (
      await acceptOwnerInvitation(
        db,
        user,
        { email: "different@geki.local", email_verified: true },
        email,
      )
    ).role,
    "STUDENT",
  );
  const results = await Promise.all([
    acceptOwnerInvitation(db, user, { email, email_verified: true }, email),
    acceptOwnerInvitation(db, user, { email, email_verified: true }, email),
  ]);
  assert.ok(results.every((result) => result.role === "SUPER_ADMIN"));
  assert.equal(
    await db.auditEvent.count({
      where: { actorId: user.id, action: "OWNER_INVITATION_ACCEPTED" },
    }),
    1,
  );
  await db.user.update({ where: { id: user.id }, data: { role: "STUDENT" } });
  assert.equal(
    (
      await acceptOwnerInvitation(
        db,
        user,
        { email, email_verified: true },
        email,
      )
    ).role,
    "STUDENT",
    "A consumed invitation must not override later role changes",
  );
  console.log(
    JSON.stringify({
      verifiedEmailOnly: "passed",
      exactOwnerOnly: "passed",
      concurrentSingleGrant: "passed",
      noRepeatElevation: "passed",
    }),
  );
} finally {
  await db.$disconnect();
}
