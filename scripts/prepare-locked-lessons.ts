import { readFile, writeFile } from "node:fs/promises";
import { config } from "../apps/api/src/config.js";
import { db } from "../apps/api/src/db.js";
import { firebaseAdmin } from "../apps/api/src/auth.js";
if (
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099" ||
  !config.databaseUrl.includes("127.0.0.1")
)
  throw Error("Local only");
try {
  const f = JSON.parse(
    await readFile(".local/integration-fixture.json", "utf8"),
  );
  const preview = await db.lesson.findUniqueOrThrow({
    where: { id: f.lessonId },
    include: { section: true },
  });
  const max = await db.lesson.aggregate({
    where: { sectionId: preview.sectionId },
    _max: { position: true },
  });
  const paid = await db.lesson.create({
    data: {
      sectionId: preview.sectionId,
      videoId: preview.videoId,
      title: "Paid lesson access verification",
      position: (max._max.position ?? 0) + 1,
      preview: false,
    },
  });
  const email = "unpaid-" + Date.now() + "@geki.local";
  const identity = await firebaseAdmin.createUser({
    email,
    password: "GekiLocal!2026",
    emailVerified: true,
  });
  await db.user.create({
    data: {
      firebaseUid: identity.uid,
      email,
      displayName: "Unpaid course learner",
      onboarded: true,
      consentAt: new Date(),
    },
  });
  await writeFile(
    ".local/locked-lesson-fixture.json",
    JSON.stringify({ ...f, paidLessonId: paid.id, unpaidEmail: email }),
  );
} finally {
  await db.$disconnect();
}
