import { db } from "../apps/api/src/db.js";
import { firebaseAdmin } from "../apps/api/src/auth.js";
const email = process.argv[process.argv.indexOf("--email") + 1];
if (!email || !email.includes("@"))
  throw new Error(
    "Usage: npm run admin:grant -- --email verified-owner@example.com",
  );
if (process.argv.includes("--existing-account")) {
  const accounts = await db.user.findMany({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  if (accounts.length !== 1)
    throw new Error(
      "Sign in with this real Firebase account first; exactly one matching GEKI account is required.",
    );
  const target = accounts[0]!;
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: target.id },
      data: { role: "SUPER_ADMIN" },
    });
    await tx.auditEvent.create({
      data: {
        actorId: target.id,
        action: "BOOTSTRAP_SUPER_ADMIN",
        target: target.id,
        reason:
          "Explicit owner command for an existing Firebase-signed account; verified email is enforced by the admin API",
      },
    });
  });
  console.log(
    "Super Admin assigned. Verified email is still required at sign-in.",
  );
  await db.$disconnect();
} else {
  const identity = await firebaseAdmin.getUserByEmail(email);
  if (!identity.emailVerified)
    throw new Error("Verify this Firebase account email first.");
  const user = await db.user.upsert({
    where: { firebaseUid: identity.uid },
    create: {
      firebaseUid: identity.uid,
      email,
      displayName: identity.displayName || email,
      role: "SUPER_ADMIN",
    },
    update: { role: "SUPER_ADMIN" },
  });
  await db.auditEvent.create({
    data: {
      actorId: user.id,
      action: "BOOTSTRAP_SUPER_ADMIN",
      target: user.id,
      reason: "Explicit command-line owner bootstrap",
    },
  });
  console.log("Super Admin role assigned to the specified verified account.");
  await db.$disconnect();
}
