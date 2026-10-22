import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { db } from "../src/server/db.js";
import { firebaseAdmin } from "../src/server/auth.js";
if (
  !process.env.FIREBASE_AUTH_EMULATOR_HOST ||
  !process.env.DATABASE_URL?.includes("127.0.0.1")
)
  throw new Error("Integration tests must use local services.");
const base = "http://127.0.0.1:3000/api";
const checks: string[] = [];
async function login(email: string, password: string) {
  const r = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const data = (await r.json()) as { idToken: string };
  assert.ok(data.idToken);
  return data.idToken;
}
async function call(
  path: string,
  token?: string,
  method = "GET",
  body?: unknown,
  key?: string,
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(body && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(key ? { "X-Device-Key": key } : {}),
    },
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: (await r.json()) as Record<string, any> };
}
const admin = await login("admin@geki.local", "GekiLocal!2026");
const email = `integration-${Date.now()}@geki.local`;
await firebaseAdmin.createUser({
  email,
  password: "GekiLocal!2026",
  emailVerified: true,
});
const student = await login(email, "GekiLocal!2026");
assert.equal((await call("/admin/overview")).status, 401);
assert.equal((await call("/admin/overview", student)).status, 403);
checks.push("anonymous and student admin access denied");
const me = (await call("/me", student)).data;
await call("/me/profile", student, "PATCH", {
  displayName: "Integration learner",
  language: "en",
  accountType: "ADULT",
  consent: true,
  role: "SUPER_ADMIN",
});
assert.equal((await call("/me", student)).data.role, "STUDENT");
checks.push("client cannot elevate its own role");
const beforePreference = (await call("/me", student)).data;
assert.equal(
  (await call("/me/preferences", student, "PATCH", { language: "mm" })).status,
  200,
);
const afterPreference = (await call("/me", student)).data;
assert.equal(afterPreference.language, "mm");
assert.equal(afterPreference.consentAt, beforePreference.consentAt);
assert.equal(
  (
    await call("/me/preferences", student, "PATCH", {
      language: "en",
      role: "SUPER_ADMIN",
    })
  ).status,
  400,
);
assert.equal((await call("/me", student)).data.role, "STUDENT");
checks.push(
  "language preference persists without rewriting consent or permitting role changes",
);
const course = (
  await call("/admin/courses", admin, "POST", {
    title: "Local playback verification · Not GEKI teaching",
    priceMinor: 500000,
    currency: "MMK",
    description:
      "Development fixture generated for end-to-end verification. Replace with approved GEKI teaching content before launch.",
  })
).data;
const section = (
  await call("/admin/courses/" + course.id + "/sections", admin, "POST", {
    title: "Verification",
  })
).data;
const video = (
  await call("/admin/videos", admin, "POST", {
    title: "Local playback verification",
    duration: 3,
  })
).data;
assert.equal(
  (
    await call("/admin/videos/" + video.id + "/publish", admin, "POST", {
      reason: "Verify publication guard",
    })
  ).status,
  409,
);
checks.push("unready media cannot be published");
const file = await readFile(".local/verification.webm");
const form = new FormData();
form.set("file", new Blob([file], { type: "video/webm" }), "verification.webm");
assert.equal(
  (await call("/admin/videos/" + video.id + "/upload", admin, "POST", form))
    .status,
  200,
);
for (const language of ["en", "mm"])
  assert.equal(
    (
      await call(
        "/admin/videos/" + video.id + "/subtitles/" + language,
        admin,
        "PUT",
        {
          content:
            "WEBVTT\n\n00:00.000 --> 00:03.000\n" +
            (language === "en"
              ? "Local development video. Not karate instruction."
              : "ဤဗီဒီယိုသည် စမ်းသပ်ရန်သာ ဖြစ်ပါသည်။") +
            "\n",
          approved: true,
        },
      )
    ).status,
    200,
  );
assert.equal(
  (
    await call("/admin/videos/" + video.id + "/publish", admin, "POST", {
      reason: "Reviewed local verification fixture",
    })
  ).status,
  200,
);
const lesson = (
  await call("/admin/sections/" + section.id + "/lessons", admin, "POST", {
    videoId: video.id,
    title: "Local playback verification",
    preview: true,
  })
).data;
assert.equal(
  (
    await call("/admin/courses/" + course.id + "/publish", admin, "POST", {
      reason: "Reviewed integration verification course",
    })
  ).status,
  200,
);
checks.push("admin upload, bilingual subtitle review and publishing persisted");
const preview = await call("/lessons/" + lesson.id + "/preview");
assert.equal(preview.status, 200);
const range = await fetch(base.replace("/api", "") + preview.data.url, {
  headers: { Range: "bytes=0-15" },
});
assert.equal(range.status, 206);
assert.equal((await range.arrayBuffer()).byteLength, 16);
checks.push("guest preview streams real media with byte ranges");
const key = randomUUID() + randomUUID();
assert.equal(
  (await call("/me/playback/" + lesson.id, student, "POST", {}, key)).status,
  403,
);
checks.push("course purchase enforced before playback");
assert.equal((await call("/me/playback/"+lesson.id,admin,"POST",{},key)).status,403);
checks.push("Super Admin learner playback also requires a course purchase");
await db.membership.create({
  data: {
    userId: me.id,
    plan: "ANNUAL",
    startsAt: new Date(),
    endsAt: new Date(Date.now() + 86400000),
  },
});
assert.equal(
  (await call("/me/playback/" + lesson.id, student, "POST", {}, key)).status,
  403,
);
const courseB = await db.course.create({
  data: {
    title: "Course B isolation fixture",
    slug: "isolation-" + Date.now(),
    description: "Separate course fixture",
    status: "PUBLISHED",
    priceMinor: 750000,
    sections: {
      create: {
        title: "Section B",
        position: 0,
        lessons: {
          create: { title: "Lesson B", position: 0, videoId: video.id },
        },
      },
    },
    quiz: { create: { published: true } },
  },
  include: { sections: { include: { lessons: true } }, quiz: true },
});
assert.equal(
  (
    await call("/admin/students/" + me.id + "/action", admin, "POST", {
      action: "GRANT",
      courseId: course.id,
      reason: "Missing payment reference check",
    })
  ).status,
  400,
);
assert.equal(
  (await call("/checkout", student, "POST", { courseId: course.id })).status,
  409,
);

assert.equal(
  (
    await call("/admin/students/" + me.id + "/action", admin, "POST", {
      action: "GRANT",
      courseId: course.id,
      paymentReference: "local-course-" + me.id,
      reason: "Local confirmed course payment",
    })
  ).status,
  200,
);

assert.equal(
  (
    await call(
      "/me/playback/" + courseB.sections[0]!.lessons[0]!.id,
      student,
      "POST",
      {},
      key,
    )
  ).status,
  403,
);
assert.equal(
  (await call("/me/quizzes/" + courseB.quiz!.id, student)).status,
  403,
);
assert.equal(
  (await call("/checkout", student, "POST", { courseId: course.id })).status,
  409,
);
assert.equal(
  (
    await call("/admin/students/" + me.id + "/action", admin, "POST", {
      action: "GRANT",
      courseId: course.id,
      paymentReference: "local-course-" + me.id,
      reason: "Idempotent purchase confirmation",
    })
  ).status,
  200,
);
assert.equal(await db.coursePurchase.count({ where: { userId: me.id } }), 1);
assert.equal(
  (
    await call("/admin/students/" + me.id + "/action", admin, "POST", {
      action: "GRANT",
      courseId: courseB.id,
      paymentReference: "local-course-" + me.id,
      reason: "Prevent reused payment reference",
    })
  ).status,
  409,
);
assert.equal(
  (
    await call("/admin/courses/" + course.id, admin, "DELETE", {
      reason: "Preserve purchased course records",
    })
  ).status,
  409,
);
checks.push(
  "legacy membership cannot unlock courses; purchases isolate reused videos and quizzes; payment references are required, unique and idempotent; purchase history prevents deletion",
);
const keys = [key, randomUUID() + randomUUID(), randomUUID() + randomUUID()];
const results = await Promise.all(
  keys.map((key) =>
    call("/me/devices", student, "POST", { label: "Integration browser", key }),
  ),
);
assert.equal(results.filter((r) => r.status === 201).length, 2);
assert.equal(results.filter((r) => r.status === 409).length, 1);
checks.push("concurrent registration cannot exceed two devices");
const valid = keys[results.findIndex((r) => r.status === 201)]!;
const other =
  keys[results.findIndex((r, i) => r.status === 201 && keys[i] !== valid)]!;
let playback = (
  await call("/me/playback/" + lesson.id, student, "POST", {}, valid)
).data;
assert.ok(playback.sessionId);
assert.equal(
  (await call("/me/playback/" + lesson.id, student, "POST", {}, other)).status,
  409,
);
const transferred = await call(
  "/me/playback/" + lesson.id,
  student,
  "POST",
  { transfer: true },
  other,
);
assert.equal(transferred.status, 200);
assert.equal(
  (
    await call(
      "/me/playback/" + playback.sessionId + "/heartbeat",
      student,
      "POST",
      { position: 1, playing: true },
      valid,
    )
  ).status,
  409,
);
checks.push(
  "one active stream with explicit transfer and old-session revocation",
);
playback = (
  await call(
    "/me/playback/" + lesson.id,
    student,
    "POST",
    { transfer: true },
    valid,
  )
).data;
await call(
  "/me/playback/" + playback.sessionId + "/heartbeat",
  student,
  "POST",
  { position: 2.95, playing: true },
  valid,
);
let progress = await db.progress.findUniqueOrThrow({
  where: { userId_videoId: { userId: me.id, videoId: video.id } },
});
assert.equal(progress.completedAt, null);
checks.push("seeking directly to the end does not complete a lesson");
playback = (await call("/me/playback/" + lesson.id, student, "POST", {}, valid))
  .data;
await new Promise((r) => setTimeout(r, 3100));
await call(
  "/me/playback/" + playback.sessionId + "/heartbeat",
  student,
  "POST",
  { position: 2.95, playing: true },
  valid,
);
progress = await db.progress.findUniqueOrThrow({
  where: { userId_videoId: { userId: me.id, videoId: video.id } },
});
assert.ok(progress.completedAt);
checks.push(
  "credible watched coverage and resume position persist in PostgreSQL",
);
const quiz = (
  await call("/admin/courses/" + course.id + "/quiz", admin, "PUT", {
    published: true,
    questions: [
      {
        prompt: "What does this local video represent?",
        options: [
          "A development verification fixture",
          "A real GEKI teaching lesson",
        ],
        correctIndex: 0,
        explanation:
          "It verifies the application and is not GEKI teaching content.",
      },
    ],
  })
).data;
const questions = (await call("/me/quizzes/" + quiz.id, student)).data;
assert.equal(questions.questions[0].correctIndex, undefined);
const attempt = await call(
  "/me/quizzes/" + quiz.id + "/attempts",
  student,
  "POST",
  { answers: { [questions.questions[0].id]: 0 }, score: 0 },
);
assert.equal(attempt.data.score, 100);
assert.equal(attempt.data.passed, true);
checks.push(
  "answers stay server-side; grading and attempt history are persisted",
);
await db.coursePurchase.updateMany({
  where: { userId: me.id },
  data: { revokedAt: new Date() },
});
assert.equal(
  (await call("/me/playback/" + lesson.id, student, "POST", {}, valid)).status,
  403,
);
assert.equal((await fetch(base + "/media/" + playback.sessionId)).status, 403);
const saved = (await call("/me/dashboard", student)).data;
assert.equal(saved.attempts.length, 1);
assert.ok(saved.progress.length);
checks.push(
  "revocation stops media access while retaining progress and quiz results",
);
const devices = (await call("/me/devices", student)).data.devices;
for (const d of devices)
  assert.equal(
    (await call("/me/devices/" + d.id, student, "DELETE")).status,
    200,
  );
await call("/me/devices", student, "POST", {
  label: "Replacement",
  key: randomUUID() + randomUUID(),
});
const replacement = (await call("/me/devices", student)).data.devices[0];
assert.equal(
  (await call("/me/devices/" + replacement.id, student, "DELETE")).status,
  429,
);
checks.push("two replacements per rolling 30 days enforced");
await writeFile(
  ".local/integration-fixture.json",
  JSON.stringify(
    {
      courseId: course.id,
      slug: course.slug,
      lessonId: lesson.id,
      quizId: quiz.id,
    },
    null,
    2,
  ),
);
await writeFile(
  ".local/integration-report.json",
  JSON.stringify({ passed: checks.length, checks }, null, 2),
);
console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
await db.$disconnect();
