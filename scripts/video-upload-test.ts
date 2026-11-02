import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { db } from "../src/server/db.js";
import { config } from "../src/server/config.js";
import {
  startVideoUpload,
  checkVideoUpload,
  cancelVideoUpload,
  cleanupVideoUploads,
  uploadMetadata,
} from "../src/server/video-upload-sessions.js";
assert.equal(
  new URL(config.databaseUrl).hostname,
  "127.0.0.1",
  "Video upload fixtures require local PostgreSQL",
);
assert.notEqual(process.env.NODE_ENV, "production");
const user = await db.user.create({
  data: {
    firebaseUid: randomUUID(),
    email: `video-upload-${randomUUID()}@geki.local`,
    displayName: "Upload fixture",
    role: "ADMIN",
  },
});
const ids: string[] = [];
const assets = new Map<string, { status: string; length?: number }>();
const removed: string[] = [];
let created = 0,
  failRemoval = false;
const provider = {
  create: async () => {
    created++;
    const videoId = randomUUID();
    assets.set(videoId, { status: "pre-upload" });
    const key = `uploads/${videoId}/source`;
    return {
      videoId,
      clientPayload: {
        uploadLink: "https://fixture.s3.amazonaws.com/",
        key,
        policy: Buffer.from(
          JSON.stringify({
            expiration: new Date(Date.now() + 3600000).toISOString(),
            conditions: [{ key }],
          }),
        ).toString("base64"),
        "x-amz-signature": "fixture",
        "x-amz-algorithm": "AWS4-HMAC-SHA256",
        "x-amz-date": "fixture",
        "x-amz-credential": "fixture",
      },
    };
  },
  status: async (id: string) => {
    assert.ok(assets.has(id));
    return assets.get(id)!;
  },
  remove: async (id: string) => {
    if (failRemoval) throw Error("Injected outage");
    removed.push(id);
    assets.delete(id);
  },
};
let courseId = "";
try {
  const bytes = await readFile("tests/fixtures/verification.webm");
  const input = {
    filename: "training.webm",
    size: bytes.length,
    mime: "video/webm" as const,
    duration: 3,
    header: bytes.subarray(0, 12).toString("base64"),
    fingerprint: createHash("sha256")
      .update(bytes.subarray(0, 65536))
      .digest("hex"),
  };
  assert.throws(() =>
    uploadMetadata.parse({ ...input, size: 501 * 1024 * 1024 }),
  );
  assert.throws(() =>
    uploadMetadata.parse({
      ...input,
      header: Buffer.from("not a video!").toString("base64"),
    }),
  );
  assert.throws(() =>
    uploadMetadata.parse({ ...input, filename: "../training.webm" }),
  );
  async function video() {
    const v = await db.video.create({
      data: { title: "Direct upload fixture", duration: 3 },
    });
    ids.push(v.id);
    return v;
  }
  const v = await video();
  const course = await db.course.create({
    data: {
      slug: `upload-${randomUUID()}`,
      title: "Upload fixture course",
      description: "Local fixture",
    },
  });
  courseId = course.id;
  const section = await db.section.create({
    data: { courseId, title: "Section", position: 0 },
  });
  const lesson = await db.lesson.create({
    data: {
      sectionId: section.id,
      videoId: v.id,
      title: "Lesson",
      position: 0,
    },
  });
  const first = await startVideoUpload(db, v.id, user.id, input, provider);
  assert.equal(first.status, "UPLOADING");
  await startVideoUpload(db, v.id, user.id, input, provider);
  assert.equal(created, 1, "Retry must reuse a valid session");
  await assert.rejects(
    startVideoUpload(
      db,
      v.id,
      user.id,
      { ...input, filename: "different.webm" },
      provider,
    ),
  );
  const job = await db.job.findUniqueOrThrow({
    where: { id: `video-upload:${v.id}` },
  });
  const asset = (job.payload as { assetId: string }).assetId;
  assert.equal(
    (await checkVideoUpload(db, v.id, provider)).status,
    "UPLOADING",
  );
  assert.equal(
    (await db.video.findUniqueOrThrow({ where: { id: v.id } })).providerAssetId,
    null,
    "Client completion is not proof of upload",
  );
  assets.set(asset, { status: "Queued" });
  assert.equal(
    (await checkVideoUpload(db, v.id, provider)).status,
    "PROCESSING",
  );
  assets.set(asset, { status: "ready", length: 2.4 });
  await Promise.all([
    checkVideoUpload(db, v.id, provider),
    checkVideoUpload(db, v.id, provider),
  ]);
  assert.equal(
    await db.auditEvent.count({
      where: { target: v.id, action: "VIDEO_DIRECT_UPLOAD_VERIFIED" },
    }),
    1,
    "Completion must be idempotent",
  );
  const ready = await db.video.findUniqueOrThrow({ where: { id: v.id } });
  assert.equal(ready.status, "REVIEW");
  assert.equal(ready.duration, 3);
  assert.equal(ready.providerAssetId, asset);
  assert.equal(
    (await db.lesson.findUniqueOrThrow({ where: { id: lesson.id } })).videoId,
    v.id,
    "Course association must remain unchanged",
  );
  await assert.rejects(
    cancelVideoUpload(db, v.id, user.id, first.sessionId!, provider),
  );
  const large = await video();
  const largeSession = await startVideoUpload(
    db,
    large.id,
    user.id,
    { ...input, size: 100 * 1024 * 1024 },
    provider,
  );
  assert.equal(
    largeSession.status,
    "UPLOADING",
    "Large files use the same small metadata authorization",
  );
  failRemoval = true;
  await cancelVideoUpload(
    db,
    large.id,
    user.id,
    largeSession.sessionId!,
    provider,
  );
  assert.equal(
    (
      await db.job.findUniqueOrThrow({
        where: { id: `video-upload:${large.id}` },
      })
    ).status,
    "CLEANUP",
  );
  failRemoval = false;
  await db.job.update({
    where: { id: `video-upload:${large.id}` },
    data: { runAt: new Date(0) },
  });
  await cleanupVideoUploads(db, provider, large.id);
  assert.equal(
    (await db.video.findUniqueOrThrow({ where: { id: large.id } })).status,
    "DRAFT",
  );
  assert.equal(
    (
      await db.job.findUniqueOrThrow({
        where: { id: `video-upload:${large.id}` },
      })
    ).status,
    "CLEANED",
  );
  assert.equal(removed.length, 1);
  assert.ok(
    !removed.includes(asset),
    "Completed playback asset must not be deleted",
  );
  const expired = await video();
  await startVideoUpload(db, expired.id, user.id, input, provider);
  const expiredJob = await db.job.findUniqueOrThrow({
    where: { id: `video-upload:${expired.id}` },
  });
  await db.job.update({
    where: { id: expiredJob.id },
    data: {
      runAt: new Date(0),
      payload: {
        ...(expiredJob.payload as Record<string, never>),
        expires: Date.now() - 1,
      },
    },
  });
  await cleanupVideoUploads(db, provider, expired.id);
  assert.equal(
    (await db.job.findUniqueOrThrow({ where: { id: expiredJob.id } })).status,
    "CLEANED",
    "Expired sessions must be reclaimed",
  );
  const failed = await video();
  await assert.rejects(
    startVideoUpload(db, failed.id, user.id, input, {
      ...provider,
      create: async () => {
        throw Error("Injected provider quota rejection");
      },
    }),
  );
  assert.equal(
    (await db.video.findUniqueOrThrow({ where: { id: failed.id } })).status,
    "DRAFT",
    "Provider failure must release the video reservation",
  );
  console.log(
    "Direct video session integration passed: format/size validation, retries, duplicate prevention, provider verification, concurrent completion, course association, large-file metadata, cancellation, cleanup retry and protected asset preservation. Provider transport was injected.",
  );
} finally {
  if (courseId) await db.course.delete({ where: { id: courseId } });
  await db.job.deleteMany({
    where: { id: { in: ids.map((id) => `video-upload:${id}`) } },
  });
  await db.auditEvent.deleteMany({ where: { actorId: user.id } });
  await db.video.deleteMany({ where: { id: { in: ids } } });
  await db.user.delete({ where: { id: user.id } });
  await db.$disconnect();
}
