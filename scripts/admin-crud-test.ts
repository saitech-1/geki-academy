import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { db } from "../src/server/db.js";
import { config } from "../src/server/config.js";
if (
  process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099" ||
  !config.databaseUrl.includes("127.0.0.1")
)
  throw new Error("CRUD checks require local services.");
const base = "http://127.0.0.1:3000/api";
const auth = (await fetch(
  "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@geki.local",
      password: "GekiLocal!2026",
      returnSecureToken: true,
    }),
  },
).then((r) => r.json())) as { idToken: string };
assert.ok(auth.idToken);
async function call(path: string, method = "GET", body?: unknown) {
  const response = await fetch(base + path, {
    method,
    headers: {
      Authorization: "Bearer " + auth.idToken,
      ...(body && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  return {
    status: response.status,
    data: (await response.json()) as Record<string, any>,
  };
}
const reason = "Local CRUD verification fixture";
try {
  const streaming = await call("/admin/streaming");
  assert.equal(streaming.status, 200);
  assert.equal(streaming.data.provider, "vdocipher");
  assert.equal("secret" in streaming.data, false);
  assert.equal((await fetch(base + "/admin/streaming")).status, 401);
  if (!config.videoSecret) {
    const blocked = await call("/admin/videos/nonexistent/protection", "POST");
    assert.equal(blocked.status, 503);
    assert.equal(blocked.data.code, "DRM_NOT_CONFIGURED");
  }
  const course = (
    await call("/admin/courses", "POST", {
      title: "CRUD verification course",
      description: "Temporary local verification record",
    })
  ).data;
  assert.ok(course.id);
  assert.equal(
    (
      await call("/admin/courses/" + course.id, "PATCH", {
        title: "Updated CRUD verification",
        description: "Persisted edited description",
        category: "Kata",
        thumbnail: "/images/hero.jpg",
      })
    ).status,
    200,
  );
  assert.equal(
    (await db.course.findUniqueOrThrow({ where: { id: course.id } })).category,
    "Kata",
  );
  const section = (
    await call("/admin/courses/" + course.id + "/sections", "POST", {
      title: "Temporary section",
    })
  ).data;
  assert.equal(
    (
      await call("/admin/sections/" + section.id, "PATCH", {
        title: "Renamed section",
      })
    ).status,
    200,
  );
  let video = (
    await call("/admin/videos", "POST", {
      title: "CRUD video verification",
      duration: 3,
    })
  ).data;
  const bad = new FormData();
  bad.set(
    "file",
    new Blob(["not a video"], { type: "video/mp4" }),
    "invalid.mp4",
  );
  assert.equal(
    (await call("/admin/videos/" + video.id + "/upload", "POST", bad)).status,
    400,
  );
  const body = new FormData();
  body.set(
    "file",
    new Blob([await readFile(".local/verification.webm")], {
      type: "application/octet-stream",
    }),
    "fixture.webm",
  );
  body.set("duration", "3");
  const uploaded = await call(
    "/admin/videos/" + video.id + "/upload",
    "POST",
    body,
  );
  assert.equal(uploaded.status, 200);
  video = uploaded.data;
  assert.ok(existsSync(resolve(config.uploadDir, video.localPath)));
  assert.equal(
    (
      await call("/admin/videos/" + video.id, "PATCH", {
        title: "Edited CRUD video",
        duration: 3,
        providerAssetId: null,
      })
    ).status,
    200,
  );
  const preview = await call("/admin/videos/" + video.id + "/preview", "POST");
  assert.equal(preview.status, 200);
  const range = await fetch("http://127.0.0.1:3000" + preview.data.url, {
    headers: { Range: "bytes=0-15" },
  });
  assert.equal(range.status, 206);
  assert.equal((await range.arrayBuffer()).byteLength, 16);
  const ticket = preview.data.url;
  const tampered = ticket.slice(0, -2) + "xx";
  assert.equal((await fetch("http://127.0.0.1:3000" + tampered)).status, 403);
  const lesson = (
    await call("/admin/sections/" + section.id + "/lessons", "POST", {
      title: "CRUD lesson",
      videoId: video.id,
    })
  ).data;
  assert.equal(
    (
      await call("/admin/lessons/" + lesson.id, "PATCH", {
        title: "Edited CRUD lesson",
        description: "Updated lesson copy",
        preview: false,
      })
    ).status,
    200,
  );
  assert.equal(
    (await call("/admin/videos/" + video.id, "DELETE", { reason })).status,
    409,
  );
  assert.equal(
    (await call("/admin/lessons/" + lesson.id, "DELETE", { reason })).status,
    200,
  );
  assert.equal(
    (await call("/admin/sections/" + section.id, "DELETE", { reason })).status,
    200,
  );
  assert.equal(
    (await call("/admin/courses/" + course.id, "DELETE", { reason })).status,
    200,
  );
  assert.equal(await db.course.count({ where: { id: course.id } }), 0);
  assert.equal(
    (await call("/admin/videos/" + video.id, "DELETE", { reason })).status,
    200,
  );
  assert.equal(await db.video.count({ where: { id: video.id } }), 0);
  assert.equal(existsSync(resolve(config.uploadDir, video.localPath)), false);
  assert.equal((await fetch("http://127.0.0.1:3000" + ticket)).status, 404);
  const historyCourse = await db.course.findFirst({
    where: { quiz: { attempts: { some: {} } } },
  });
  if (historyCourse)
    assert.equal(
      (await call("/admin/courses/" + historyCourse.id, "DELETE", { reason }))
        .status,
      409,
    );
  const auditCount = await db.auditEvent.count({
    where: {
      target: { in: [course.id, section.id, lesson.id, video.id] },
      action: {
        in: [
          "COURSE_DELETED",
          "SECTION_DELETED",
          "LESSON_DELETED",
          "VIDEO_DELETED",
        ],
      },
    },
  });
  assert.equal(auditCount, 4);
  console.log(
    JSON.stringify({
      courseCRUD: "passed",
      sectionAndLessonCRUD: "passed",
      videoCRUD: "passed",
      sourceValidationAndPreview: "passed",
      tamperRejection: "passed",
      usageAndHistoryGuards: "passed",
      sourceFileCleanup: "passed",
      auditTrail: "passed",
    }),
  );
} finally {
  await db.$disconnect();
}
