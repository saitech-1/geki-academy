import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { db } from "../src/server/db.js";
import { firebaseAdmin } from "../src/server/auth.js";
if (
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099" ||
  !process.env.DATABASE_URL?.includes("127.0.0.1")
)
  throw new Error("Browser fixtures require local services.");
const email = `browser-${randomUUID()}@geki.local`;
const password = "GekiLocal!2026";
try {
  const identity = await firebaseAdmin.createUser({
    email,
    password,
    emailVerified: true,
  });
  await db.user.create({
    data: {
      firebaseUid: identity.uid,
      email,
      displayName: "Browser verification learner",
      onboarded: true,
      consentAt: new Date(),
      purchases: {
        create: {
          courseId: JSON.parse(
            await readFile(".local/integration-fixture.json", "utf8"),
          ).courseId,
          paymentReference: "browser-test-" + identity.uid,
          amountMinor: 500000,
          currency: "MMK",
        },
      },
    },
  });
  await writeFile(
    ".local/browser-account.json",
    JSON.stringify({ email, password }),
  );
} finally {
  await db.$disconnect();
}
