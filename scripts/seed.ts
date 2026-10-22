import { db } from "../src/server/db.js";
import { firebaseAdmin } from "../src/server/auth.js";
if (
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099" ||
  !process.env.DATABASE_URL?.includes("127.0.0.1")
)
  throw new Error(
    "This seed is only permitted against local development services.",
  );
const password = "GekiLocal!2026";
for (const [email, name, role] of [
  ["admin@geki.local", "GEKI Local Admin", "SUPER_ADMIN"],
  ["student@geki.local", "Local Learner", "STUDENT"],
] as const) {
  let identity;
  try {
    identity = await firebaseAdmin.getUserByEmail(email);
  } catch {
    identity = await firebaseAdmin.createUser({
      email,
      password,
      emailVerified: true,
      displayName: name,
    });
  }
  const user = await db.user.upsert({
    where: { firebaseUid: identity.uid },
    create: {
      firebaseUid: identity.uid,
      email,
      displayName: name,
      role,
      onboarded: true,
      accountType: "ADULT",
      consentAt: new Date(),
    },
    update: {},
  });
}
const course = await db.course.upsert({
  where: { slug: "geki-kihon-package" },
  create: {
    slug: "geki-kihon-package",
    title: "Geki Kihon Package",
    description:
      "A structured path through Kihon, Kihon Ido, basic Kumite and Kata. Upload GEKI-owned lessons and approve subtitles before publishing.",
    status: "DRAFT",
  },
  update: {},
});
if (!(await db.section.count({ where: { courseId: course.id } })))
  for (const [i, title] of [
    "Kihon fundamentals",
    "Kihon Ido",
    "Basic Kumite",
    "Kata",
  ].entries())
    await db.section.create({
      data: { courseId: course.id, title, position: i },
    });
console.log(
  "Local accounts ready: admin@geki.local and student@geki.local. Password: GekiLocal!2026",
);
console.log(
  "The Kihon course is a draft. No GEKI teaching footage has been invented.",
);
await db.$disconnect();
