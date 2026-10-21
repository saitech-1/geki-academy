import { Router, type Request } from "express";
import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { db } from "./db.js";
import { config } from "./config.js";
import { requireCondition } from "./domain.js";
import { sendLocalMedia } from "./media.js";
import { ReasonInput } from "@geki/contracts";
import {
  createProtectedUpload,
  transferProtectedSource,
  protectedStatus,
  syncProtectedCaptions,
  captionSyncTarget,
  hasCaptionText,
} from "./protected-video.js";
export const adminContent = Router();
export const adminSourceMedia = Router();
const recordId = (req: Request) => z.string().min(1).parse(req.params.id);
adminContent.get("/streaming", (_req, res) => {
  res.json({
    provider: "vdocipher",
    configured: Boolean(config.videoSecret),
    enabled: config.mediaMode === "vdocipher",
    signupUrl: "https://www.vdocipher.com/dashboard/register",
  });
});
adminContent.get("/videos/:id/protection", async (req, res) => {
  const video = await db.video.findUnique({ where: { id: recordId(req) } });
  requireCondition(video, 404, "NOT_FOUND", "Video not found.");
  requireCondition(
    video.providerAssetId,
    409,
    "ASSET_MISSING",
    "Send the saved source to VdoCipher first.",
  );
  const result = await protectedStatus(video.providerAssetId);
  if (result.status === "ready" && video.status === "PROCESSING") {
    await db.video.updateMany({
      where: { id: video.id, updatedAt: video.updatedAt },
      data: { status: "REVIEW" },
    });
  }
  res.json({ status: result.status, ready: result.status === "ready" });
});
adminContent.post("/videos/:id/protection", async (req, res) => {
  requireCondition(
    config.videoSecret,
    503,
    "DRM_NOT_CONFIGURED",
    "Create your VdoCipher account and configure its API secret on the server first.",
  );
  const video = await db.video.findUnique({ where: { id: recordId(req) } });
  requireCondition(
    video?.localPath,
    409,
    "SOURCE_MISSING",
    "Upload a source video first.",
  );
  requireCondition(
    !video.providerAssetId && video.status !== "PROCESSING",
    409,
    "ASSET_EXISTS",
    "A transfer or provider asset already exists. Check processing status or inspect the saved asset in VdoCipher.",
  );
  const reserved = await db.video.updateMany({
    where: { id: video.id, updatedAt: video.updatedAt },
    data: { status: "PROCESSING" },
  });
  requireCondition(
    reserved.count,
    409,
    "VIDEO_CHANGED",
    "Video changed. Refresh and try again.",
  );
  try {
    const upload = await createProtectedUpload(video.title);
    await db.video.update({
      where: { id: video.id },
      data: { providerAssetId: upload.videoId },
    });
    await db.auditEvent.create({
      data: {
        actorId: req.account.id,
        action: "VIDEO_PROTECTION_STARTED",
        target: video.id,
        reason: "Administrator requested protected video encoding",
        data: { assetId: upload.videoId },
      },
    });
    await transferProtectedSource(
      video.localPath,
      video.mimeType || "video/mp4",
      upload.clientPayload,
    );
    res.json({
      status: "Queued",
      message:
        "Source transferred. Check processing status before syncing subtitles and publishing.",
    });
  } catch (error) {
    await db.video.updateMany({
      where: { id: video.id, status: "PROCESSING" },
      data: { status: "REVIEW" },
    });
    throw error;
  }
});
const captionOperations = new Set<string>();
adminContent.post("/videos/:id/protection/subtitles", async (req, res) => {
  const video = await db.video.findUnique({
    where: { id: recordId(req) },
    include: { subtitles: true },
  });
  requireCondition(
    video?.providerAssetId,
    409,
    "ASSET_MISSING",
    "Send the source for protection first.",
  );
  requireCondition(
    !captionOperations.has(video.id),
    409,
    "SYNC_BUSY",
    "Subtitle sync is already running.",
  );
  requireCondition(
    ["en", "mm"].every((lang) =>
      video.subtitles.some((s) => s.language === lang && s.approved),
    ),
    409,
    "SUBTITLES_REQUIRED",
    "Approve English and Burmese subtitles first.",
  );
  captionOperations.add(video.id);
  try {
    const empty = video.subtitles.find(
      (s) => s.approved && !hasCaptionText(s.content),
    );
    requireCondition(
      !empty,
      400,
      "EMPTY_CAPTIONS",
      `${empty?.language === "mm" ? "Burmese" : "English"} subtitles contain timestamps but no caption text. Add the words below each timestamp, save and approve, then sync again.`,
    );
    requireCondition(
      (await protectedStatus(video.providerAssetId)).status === "ready",
      409,
      "ENCODING_PENDING",
      "Video encoding is not ready yet.",
    );
    const target = captionSyncTarget(
      video.id,
      video.providerAssetId,
      video.subtitles,
    );
    const existing = await db.auditEvent.findFirst({
      where: {
        action: "VIDEO_CAPTIONS_SYNCED",
        target: { startsWith: video.id + ":" },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    if (existing?.target !== target) {
      // An interrupted/partial replacement must invalidate the previous success marker.
      await db.auditEvent.create({
        data: {
          actorId: req.account.id,
          action: "VIDEO_CAPTIONS_SYNCED",
          target: video.id + ":pending:" + randomBytes(12).toString("hex"),
          reason:
            "Subtitle synchronization started; publication blocked until completion",
        },
      });
      for (const track of video.subtitles.filter((s) => s.approved))
        await syncProtectedCaptions(
          video.providerAssetId,
          track.language,
          track.content,
        );
      await db.auditEvent.create({
        data: {
          actorId: req.account.id,
          action: "VIDEO_CAPTIONS_SYNCED",
          target,
          reason:
            "Approved English and Burmese tracks sent to protected player",
        },
      });
    }
    res.json({ ok: true });
  } finally {
    captionOperations.delete(video.id);
  }
});
const previewSecret =
  process.env.MEDIA_TICKET_SECRET || randomBytes(32).toString("hex");
const signature = (value: string) =>
  createHmac("sha256", previewSecret).update(value).digest("base64url");
adminContent.post("/videos/:id/preview", async (req, res) => {
  const video = await db.video.findUnique({ where: { id: recordId(req) } });
  requireCondition(
    video?.localPath,
    404,
    "SOURCE_MISSING",
    "Upload a source file before previewing.",
  );
  const payload = Buffer.from(
    JSON.stringify({
      videoId: video.id,
      userId: req.account.id,
      expires: Date.now() + 5 * 60000,
    }),
  ).toString("base64url");
  res.json({ url: `/api/admin-media/${payload}.${signature(payload)}` });
});
adminSourceMedia.get("/:ticket", async (req, res) => {
  const [payload, mac] = z
    .string()
    .max(1500)
    .parse(req.params.ticket)
    .split(".");
  requireCondition(
    payload && mac,
    403,
    "INVALID_PREVIEW",
    "Open the preview again.",
  );
  const expected = Buffer.from(signature(payload));
  const actual = Buffer.from(mac);
  requireCondition(
    actual.length === expected.length && timingSafeEqual(actual, expected),
    403,
    "INVALID_PREVIEW",
    "Open the preview again.",
  );
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    decoded = null;
  }
  const parsed = z
    .object({ videoId: z.string(), userId: z.string(), expires: z.number() })
    .safeParse(decoded);
  requireCondition(
    parsed.success && parsed.data.expires > Date.now(),
    403,
    "PREVIEW_EXPIRED",
    "Preview expired. Open it again.",
  );
  const user = await db.user.findUnique({ where: { id: parsed.data.userId } });
  requireCondition(
    user && !user.suspended && user.role !== "STUDENT",
    403,
    "PREVIEW_REVOKED",
    "Administrator access is required.",
  );
  const video = await db.video.findUnique({
    where: { id: parsed.data.videoId },
  });
  requireCondition(
    video?.localPath,
    404,
    "SOURCE_MISSING",
    "The source file is unavailable.",
  );
  await sendLocalMedia(
    req,
    res,
    video.localPath,
    video.mimeType || "video/mp4",
    true,
  );
});
adminContent.post("/courses/:id/unpublish", async (req, res) => {
  const { reason } = ReasonInput.parse(req.body);
  await db.$transaction(async (tx) => {
    await tx.course.update({
      where: { id: recordId(req) },
      data: { status: "DRAFT" },
    });
    await tx.auditEvent.create({
      data: {
        actorId: req.account.id,
        action: "COURSE_UNPUBLISHED",
        target: recordId(req),
        reason,
      },
    });
  });
  res.json({ ok: true });
});
adminContent.delete("/courses/:id", async (req, res) => {
  const { reason } = ReasonInput.parse(req.body);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "geki"."Course" WHERE id=${recordId(req)} FOR UPDATE`;
    const course = await tx.course.findUnique({
      where: { id: recordId(req) },
      include: {
        quiz: { include: { _count: { select: { attempts: true } } } },
        sections: { include: { lessons: true } },
      },
    });
    requireCondition(course, 404, "NOT_FOUND", "Course not found.");
    requireCondition(
      !course.quiz?._count.attempts,
      409,
      "COURSE_HAS_HISTORY",
      "This course has student quiz results. Unpublish it to preserve their learning history.",
    );
    await tx.playbackSession.deleteMany({
      where: {
        lessonId: {
          in: course.sections.flatMap((s) => s.lessons.map((l) => l.id)),
        },
      },
    });
    await tx.course.delete({ where: { id: course.id } });
    await tx.auditEvent.create({
      data: {
        actorId: req.account.id,
        action: "COURSE_DELETED",
        target: course.id,
        reason,
        data: { title: course.title },
      },
    });
  });
  res.json({ ok: true });
});
adminContent.patch("/sections/:id", async (req, res) => {
  const data = z
    .object({ title: z.string().trim().min(2).max(100) })
    .parse(req.body);
  res.json(await db.section.update({ where: { id: recordId(req) }, data }));
});
adminContent.delete("/sections/:id", async (req, res) => {
  const { reason } = ReasonInput.parse(req.body);
  await db.$transaction(async (tx) => {
    const section = await tx.section.findUnique({
      where: { id: recordId(req) },
      include: { lessons: true },
    });
    requireCondition(section, 404, "NOT_FOUND", "Section not found.");
    await tx.playbackSession.deleteMany({
      where: { lessonId: { in: section.lessons.map((l) => l.id) } },
    });
    await tx.section.delete({ where: { id: section.id } });
    await tx.course.update({
      where: { id: section.courseId },
      data: { status: "DRAFT" },
    });
    await tx.auditEvent.create({
      data: {
        actorId: req.account.id,
        action: "SECTION_DELETED",
        target: section.id,
        reason,
      },
    });
  });
  res.json({ ok: true });
});
adminContent.delete("/lessons/:id", async (req, res) => {
  const { reason } = ReasonInput.parse(req.body);
  await db.$transaction(async (tx) => {
    const lesson = await tx.lesson.findUnique({
      where: { id: recordId(req) },
      include: { section: true },
    });
    requireCondition(lesson, 404, "NOT_FOUND", "Lesson not found.");
    await tx.playbackSession.deleteMany({ where: { lessonId: lesson.id } });
    await tx.lesson.delete({ where: { id: lesson.id } });
    await tx.course.update({
      where: { id: lesson.section.courseId },
      data: { status: "DRAFT" },
    });
    await tx.auditEvent.create({
      data: {
        actorId: req.account.id,
        action: "LESSON_DELETED",
        target: lesson.id,
        reason,
      },
    });
  });
  res.json({ ok: true });
});
adminContent.patch("/videos/:id", async (req, res) => {
  const input = z
    .object({
      title: z.string().trim().min(2).max(150),
      duration: z.number().int().min(1).max(21600),
      providerAssetId: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .nullable()
        .optional(),
    })
    .parse(req.body);
  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "geki"."Video" WHERE id=${recordId(req)} FOR UPDATE`;
    const video = await tx.video.findUnique({
      where: { id: recordId(req) },
      include: { _count: { select: { progress: true } } },
    });
    requireCondition(video, 404, "NOT_FOUND", "Video not found.");
    const sourceChange =
      input.providerAssetId !== undefined &&
      input.providerAssetId !== video.providerAssetId;
    requireCondition(
      video.status !== "PROCESSING",
      409,
      "VIDEO_PROCESSING",
      "Check protection processing status before editing this video.",
    );
    requireCondition(
      !video._count.progress ||
        (!sourceChange && input.duration === video.duration),
      409,
      "VIDEO_HAS_PROGRESS",
      "Students have watched this video. Create a new video for a replacement source or duration; its title can still be edited.",
    );
    if (sourceChange)
      await tx.subtitle.updateMany({
        where: { videoId: video.id },
        data: { approved: false },
      });
    const updated = await tx.video.update({
      where: { id: video.id },
      data: {
        ...input,
        ...(sourceChange ? { status: "REVIEW" as const } : {}),
      },
      include: {
        subtitles: true,
        _count: { select: { lessons: true, progress: true } },
      },
    });
    await tx.auditEvent.create({
      data: {
        actorId: req.account.id,
        action: "VIDEO_UPDATED",
        target: video.id,
        reason: "Administrator edited video metadata",
      },
    });
    return updated;
  });
  res.json(result);
});
adminContent.post("/videos/:id/unpublish", async (req, res) => {
  const { reason } = ReasonInput.parse(req.body);
  await db.$transaction(async (tx) => {
    const current = await tx.video.findUnique({ where: { id: recordId(req) } });
    requireCondition(
      current?.status !== "PROCESSING",
      409,
      "VIDEO_PROCESSING",
      "Check protection processing status first.",
    );
    await tx.video.update({
      where: { id: recordId(req) },
      data: { status: "REVIEW" },
    });
    await tx.auditEvent.create({
      data: {
        actorId: req.account.id,
        action: "VIDEO_UNPUBLISHED",
        target: recordId(req),
        reason,
      },
    });
  });
  res.json({ ok: true });
});
adminContent.delete("/videos/:id", async (req, res) => {
  const { reason } = ReasonInput.parse(req.body);
  const file = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "geki"."Video" WHERE id=${recordId(req)} FOR UPDATE`;
    const video = await tx.video.findUnique({
      where: { id: recordId(req) },
      include: { _count: { select: { lessons: true, progress: true } } },
    });
    requireCondition(video, 404, "NOT_FOUND", "Video not found.");
    requireCondition(
      video.status !== "PROCESSING",
      409,
      "VIDEO_PROCESSING",
      "Check protection processing status before deleting this video.",
    );
    requireCondition(
      !video._count.lessons && !video._count.progress,
      409,
      "VIDEO_IN_USE",
      "This video is attached to lessons or student progress. Remove unused lesson links first, or unpublish it to preserve learning history.",
    );
    await tx.video.delete({ where: { id: video.id } });
    await tx.auditEvent.create({
      data: {
        actorId: req.account.id,
        action: "VIDEO_DELETED",
        target: video.id,
        reason,
        data: { title: video.title },
      },
    });
    return video.localPath;
  });
  if (file) await unlink(resolve(config.uploadDir, file)).catch(() => {});
  res.json({ ok: true });
});
