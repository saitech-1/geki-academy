import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { db } from "../src/server/db.js";
import { config } from "../src/server/config.js";
import { firebaseAdmin } from "../src/server/auth.js";
assert.equal(new URL(config.databaseUrl).hostname, "127.0.0.1");
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, "127.0.0.1:9099");
const key = randomUUID(),
  email = `library-${key}@geki.local`,
  password = "GekiLocal!2026";
const identity = await firebaseAdmin.createUser({
  email,
  password,
  emailVerified: true,
});
const user = await db.user.create({
  data: {
    firebaseUid: identity.uid,
    email,
    displayName: "Library verification",
    onboarded: true,
    consentAt: new Date(),
  },
});
const courses = [];
for (const [title, category, status] of [
  ["Kihon: Understand the foundation", "Kihon", "OWNED"],
  ["Kata: Precision in every detail", "Kata", "SUBMITTED"],
  ["Kihon Ido: Movement and balance", "Kihon Ido", "REJECTED"],
  ["Kumite: Build your first combinations", "Basic Kumite", "LOCKED"],
]) {
  const course = await db.course.create({
    data: {
      title,
      slug: `${key}-${category.replaceAll(" ", "-")}`,
      titleMm: title,
      description:
        "Local verification content only. Detailed visual explanations, clear cues and a structured path to confident practice.",
      instructor: "GEKI Instruction Team",
      category,
      thumbnail:
        category === "Kata" ? "/images/kumite.jpg" : "/images/hero.jpg",
      status: "PUBLISHED",
      priceMinor: 5000000,
      kbzPayEnabled: true,
    },
  });
  courses.push(course.id);
  if (status === "OWNED") {
    await db.coursePurchase.create({
      data: {
        userId: user.id,
        courseId: course.id,
        paymentReference: `local-${key}`,
        amountMinor: 3500000,
        currency: "MMK",
      },
    });
    const section = await db.section.create({
      data: {
        courseId: course.id,
        title: "Local verification section",
        position: 0,
      },
    });
    for (let i = 0; i < 2; i++) {
      const video = await db.video.create({
        data: {
          title: `Local lesson ${i + 1}`,
          status: "PUBLISHED",
          duration: 180,
        },
      });
      await db.lesson.create({
        data: {
          sectionId: section.id,
          videoId: video.id,
          title: i ? "Chudan Tsuki: Apply the detail" : "Kihon fundamentals",
          position: i,
        },
      });
      await db.progress.create({
        data: {
          userId: user.id,
          videoId: video.id,
          position: i ? 45 : 180,
          watchedSeconds: i ? 45 : 180,
          completedAt: i ? null : new Date(),
        },
      });
    }
  } else if (status !== "LOCKED")
    await db.paymentOrder.create({
      data: {
        userId: user.id,
        courseId: course.id,
        status,
        amountMinor: 5000000,
        submissions: 1,
        submittedAt: new Date(),
        reviewReason:
          status === "REJECTED"
            ? "Please submit a clearer successful payment screenshot."
            : null,
        qrImage: "/images/payments/kbzpay-9f2c51401cd1.jpg",
        recipient: "Local verification only",
      },
    });
}
await writeFile(
  ".local/academy-library-fixture.json",
  JSON.stringify({ email, password, courses, userId: user.id }),
);
console.log("Local Academy library verification account prepared.");
await db.$disconnect();
