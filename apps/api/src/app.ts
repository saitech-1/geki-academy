import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import { mkdir, unlink, open } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { adminContent, adminSourceMedia } from "./admin-content.js";
import { randomUUID, createHash } from "node:crypto";
import { z, ZodError } from "zod";
import { Prisma } from "@prisma/client";
import {
  ProfileInput,
  ReasonInput,
  CourseInput,
  QuestionInput,
} from "@geki/contracts";
import { config } from "./config.js";
import { db, lockUser } from "./db.js";
import { auth, admin, activeMembership } from "./auth.js";
import { HttpError, requireCondition, watchedRanges, grade } from "./domain.js";
import { sendLocalMedia, playbackProvider } from "./media.js";
import {
  protectedStatus,
  captionSyncTarget,
  hasCaptionText,
} from "./protected-video.js";
const app = express();
app.disable("x-powered-by");
app.set("query parser", "simple");
app.use((req, res, next) => {
  req.requestId = randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
});
app.use(helmet());
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || config.origins.includes(origin)) cb(null, true);
      else cb(new HttpError(403, "ORIGIN_DENIED", "Origin not allowed."));
    },
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 5000,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const id = (req: Request, key = "id") =>
  z.string().min(1).parse(req.params[key]);
const audit = (
  tx: Prisma.TransactionClient,
  req: Request,
  action: string,
  target: string,
  reason: string,
  data: Prisma.InputJsonValue = {},
) =>
  tx.auditEvent.create({
    data: { actorId: req.account.id, action, target, reason, data },
  });
const publishedLesson = (lessonId: string) =>
  db.lesson.findFirst({
    where: {
      id: lessonId,
      section: { course: { status: "PUBLISHED" } },
      video: { status: "PUBLISHED" },
    },
    include: {
      video: {
        include: { subtitles: { select: { language: true, approved: true } } },
      },
      section: true,
    },
  });
async function device(req: Request, tx: Prisma.TransactionClient = db) {
  const secret = z.string().min(32).max(150).parse(req.headers["x-device-key"]);
  const found = await tx.device.findFirst({
    where: {
      userId: req.account.id,
      secretHash: hash(secret),
      revokedAt: null,
    },
  });
  requireCondition(
    found,
    403,
    "DEVICE_REQUIRED",
    "Register this browser before playing lessons.",
  );
  return found;
}
app.get("/api/health", async (_req, res) => {
  await db.$queryRaw`SELECT 1`;
  res.json({
    status: "ok",
    service: "geki-api",
    authMode: process.env.FIREBASE_AUTH_EMULATOR_HOST ? "emulator" : "firebase",
    mediaMode: config.mediaMode,
  });
});
app.get("/api/catalog", async (_req, res) => {
  const courses = await db.course.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "asc" },
    include: {
      sections: {
        orderBy: { position: "asc" },
        include: {
          lessons: {
            where: { video: { status: "PUBLISHED" } },
            select: {
              id: true,
              title: true,
              titleMm: true,
              preview: true,
              video: { select: { duration: true } },
            },
            orderBy: { position: "asc" },
          },
        },
      },
    },
  });
  res.json(courses);
});
app.get("/api/courses/:slug", async (req, res) => {
  const course = await db.course.findFirst({
    where: { slug: id(req, "slug"), status: "PUBLISHED" },
    include: {
      sections: {
        orderBy: { position: "asc" },
        include: {
          lessons: {
            where: { video: { status: "PUBLISHED" } },
            orderBy: { position: "asc" },
            select: {
              id: true,
              title: true,
              titleMm: true,
              description: true,
              preview: true,
              videoId: true,
              video: { select: { duration: true } },
            },
          },
        },
      },
      quiz: { select: { id: true, published: true } },
    },
  });
  requireCondition(course, 404, "NOT_FOUND", "This course is unavailable.");
  res.json(course);
});
app.get("/api/lessons/:id", async (req, res) => {
  const l = await publishedLesson(id(req));
  requireCondition(l, 404, "NOT_FOUND", "This lesson is unavailable.");
  res.json({
    id: l.id,
    title: l.title,
    titleMm: l.titleMm,
    description: l.description,
    preview: l.preview,
    videoId: l.videoId,
    duration: l.video.duration,
    courseId: l.section.courseId,
    subtitles: l.video.subtitles
      .filter((t) => t.approved)
      .map((t) => t.language),
  });
});
app.get("/api/lessons/:id/preview", async (req, res) => {
  const l = await publishedLesson(id(req));
  requireCondition(
    l?.preview,
    404,
    "NOT_FOUND",
    "This preview is unavailable.",
  );
  if (config.mediaMode === "local") {
    requireCondition(
      l.video.localPath,
      503,
      "VIDEO_NOT_READY",
      "GEKI has not uploaded this video yet.",
    );
    res.json({
      kind: "local",
      url: `/api/preview-media/${l.id}`,
      subtitles: l.video.subtitles
        .filter((s) => s.approved)
        .map((s) => ({
          language: s.language,
          url: `/api/preview-subtitles/${l.id}/${s.language}`,
        })),
    });
  } else {
    requireCondition(
      l.video.providerAssetId,
      503,
      "VIDEO_NOT_READY",
      "Protected video is not ready.",
    );
    res.json(await playbackProvider(l.video.providerAssetId, "GEKI · Preview"));
  }
});
app.get("/api/preview-media/:id", async (req, res) => {
  const l = await publishedLesson(id(req));
  requireCondition(
    l?.preview && l.video.localPath,
    404,
    "NOT_FOUND",
    "Preview not found.",
  );
  await sendLocalMedia(
    req,
    res,
    l.video.localPath,
    l.video.mimeType || "video/mp4",
  );
});
app.get("/api/preview-subtitles/:id/:language", async (req, res) => {
  const l = await publishedLesson(id(req));
  requireCondition(l?.preview, 404, "NOT_FOUND", "Preview not found.");
  const track = await db.subtitle.findFirst({
    where: {
      videoId: l.videoId,
      language: id(req, "language"),
      approved: true,
    },
  });
  requireCondition(track, 404, "NOT_FOUND", "Subtitles unavailable.");
  res.type("text/vtt").send(track.content);
});
const accountLimit = rateLimit({
  windowMs: 60000,
  limit: 180,
  keyGenerator: (req) => req.account.id,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
app.use("/api/me", auth, accountLimit);
app.get("/api/me", async (req, res) => {
  const now = new Date();
  const membership = await db.membership.findFirst({
    where: {
      userId: req.account.id,
      revokedAt: null,
      startsAt: { lte: now },
      endsAt: { gt: now },
    },
    orderBy: { endsAt: "desc" },
  });
  res.json({
    ...req.account,
    emailVerified: !!req.identity.email_verified,
    membership,
  });
});
app.patch("/api/me/preferences", async (req, res) => {
  const input = z
    .object({ language: z.enum(["en", "mm"]) })
    .strict()
    .parse(req.body);
  await db.user.update({ where: { id: req.account.id }, data: input });
  res.json({ language: input.language });
});
app.patch("/api/me/profile", async (req, res) => {
  const input = ProfileInput.parse(req.body);
  const user = await db.user.update({
    where: { id: req.account.id },
    data: {
      displayName: input.displayName,
      language: input.language,
      accountType: input.accountType,
      consentAt: new Date(),
      onboarded: true,
    },
  });
  res.json(user);
});
app.get("/api/me/dashboard", async (req, res) => {
  const [progress, attempts, notifications, memberships, payments] =
    await Promise.all([
      db.progress.findMany({
        where: { userId: req.account.id },
        orderBy: { updatedAt: "desc" },
        include: {
          video: {
            select: {
              title: true,
              duration: true,
              lessons: {
                select: {
                  id: true,
                  title: true,
                  section: {
                    select: { course: { select: { title: true, slug: true } } },
                  },
                },
                take: 1,
              },
            },
          },
        },
      }),
      db.quizAttempt.findMany({
        where: { userId: req.account.id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      db.notification.findMany({
        where: { userId: req.account.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      db.membership.findMany({
        where: { userId: req.account.id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      db.payment.findMany({
        where: { userId: req.account.id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);
  res.json({ progress, attempts, notifications, memberships, payments });
});
app.patch("/api/me/notifications/:id", async (req, res) => {
  await db.notification.updateMany({
    where: { id: id(req), userId: req.account.id },
    data: { readAt: new Date() },
  });
  res.json({ ok: true });
});
app.get("/api/me/devices", async (req, res) => {
  const [devices, replacements] = await Promise.all([
    db.device.findMany({
      where: { userId: req.account.id, revokedAt: null },
      select: {
        id: true,
        label: true,
        lastSeenAt: true,
        createdAt: true,
        secretHash: true,
      },
    }),
    db.deviceReplacement.count({
      where: {
        userId: req.account.id,
        createdAt: { gte: new Date(Date.now() - 30 * 86400000) },
      },
    }),
  ]);
  res.json({
    devices: devices.map(({ secretHash, ...d }) => ({
      ...d,
      current: secretHash === hash(String(req.headers["x-device-key"] || "")),
    })),
    replacementsRemaining: Math.max(0, 2 - replacements),
  });
});
app.post("/api/me/devices", async (req, res) => {
  const input = z
    .object({
      label: z.string().trim().min(2).max(100),
      key: z.string().min(32).max(150),
    })
    .parse(req.body);
  const result = await db.$transaction(async (tx) => {
    await lockUser(tx, req.account.id);
    const existing = await tx.device.findUnique({
      where: { secretHash: hash(input.key) },
    });
    if (existing) {
      requireCondition(
        existing.userId === req.account.id && !existing.revokedAt,
        403,
        "DEVICE_REVOKED",
        "This registration has been revoked. Generate a new device key.",
      );
      return { id: existing.id, label: existing.label };
    }
    const count = await tx.device.count({
      where: { userId: req.account.id, revokedAt: null },
    });
    requireCondition(
      count < 2,
      409,
      "DEVICE_LIMIT",
      "Two devices are already registered. Remove one to continue.",
    );
    return tx.device.create({
      data: {
        userId: req.account.id,
        secretHash: hash(input.key),
        label: input.label,
      },
      select: { id: true, label: true },
    });
  });
  res.status(201).json(result);
});
app.delete("/api/me/devices/:id", async (req, res) => {
  await db.$transaction(async (tx) => {
    await lockUser(tx, req.account.id);
    const d = await tx.device.findFirst({
      where: { id: id(req), userId: req.account.id, revokedAt: null },
    });
    requireCondition(d, 404, "NOT_FOUND", "Device not found.");
    const count = await tx.deviceReplacement.count({
      where: {
        userId: req.account.id,
        createdAt: { gte: new Date(Date.now() - 30 * 86400000) },
      },
    });
    requireCondition(
      count < 2,
      429,
      "REPLACEMENT_LIMIT",
      "Two replacements have been used in the last 30 days. Ask an admin for help.",
    );
    await tx.device.update({
      where: { id: d.id },
      data: { revokedAt: new Date() },
    });
    await tx.deviceReplacement.create({ data: { userId: req.account.id } });
    await tx.playbackSession.deleteMany({
      where: { userId: req.account.id, deviceId: d.id },
    });
  });
  res.json({ ok: true });
});
app.post("/api/me/playback/:id", async (req, res) => {
  const { transfer } = z
    .object({ transfer: z.boolean().default(false) })
    .parse(req.body || {});
  await activeMembership(req);
  const l = await publishedLesson(id(req));
  requireCondition(l, 404, "NOT_FOUND", "Lesson not found.");
  requireCondition(
    (config.mediaMode === "local" && l.video.localPath) ||
      (config.mediaMode === "vdocipher" &&
        l.video.providerAssetId &&
        config.videoSecret),
    503,
    "VIDEO_NOT_READY",
    "This lesson has not been connected to video media yet.",
  );
  const session = await db.$transaction(async (tx) => {
    await lockUser(tx, req.account.id);
    const d = await device(req, tx);
    const now = new Date();
    const existing = await tx.playbackSession.findUnique({
      where: { userId: req.account.id },
    });
    requireCondition(
      !existing ||
        existing.expiresAt <= now ||
        existing.deviceId === d.id ||
        transfer,
      409,
      "STREAM_IN_USE",
      "Another device is playing. Transfer playback to continue.",
    );
    await tx.device.update({ where: { id: d.id }, data: { lastSeenAt: now } });
    return tx.playbackSession.upsert({
      where: { userId: req.account.id },
      create: {
        id: randomUUID(),
        userId: req.account.id,
        deviceId: d.id,
        lessonId: l.id,
        expiresAt: new Date(Date.now() + 45000),
      },
      update: {
        id: randomUUID(),
        deviceId: d.id,
        lessonId: l.id,
        lastPosition: 0,
        lastHeartbeat: now,
        expiresAt: new Date(Date.now() + 45000),
      },
    });
  });
  const progress = await db.progress.findUnique({
    where: { userId_videoId: { userId: req.account.id, videoId: l.videoId } },
  });
  const provider =
    config.mediaMode === "local"
      ? {
          kind: "local",
          url: `/api/media/${session.id}`,
          subtitles: l.video.subtitles
            .filter((s) => s.approved)
            .map((s) => ({
              language: s.language,
              url: `/api/media/${session.id}/subtitles/${s.language}`,
            })),
        }
      : await playbackProvider(
          l.video.providerAssetId!,
          `GEKI ${req.account.id.slice(-8)}`,
        );
  res.json({
    ...provider,
    sessionId: session.id,
    position: progress?.position || 0,
    watermark: `GEKI ${req.account.id.slice(-8)}`,
  });
});
app.post("/api/me/playback/:id/heartbeat", async (req, res) => {
  await activeMembership(req);
  const input = z
    .object({ position: z.number().finite().min(0), playing: z.boolean() })
    .parse(req.body);
  const result = await db.$transaction(async (tx) => {
    await lockUser(tx, req.account.id);
    const d = await device(req, tx);
    const session = await tx.playbackSession.findUnique({
      where: { userId: req.account.id },
    });
    requireCondition(
      session &&
        session.id === id(req) &&
        session.deviceId === d.id &&
        session.expiresAt > new Date(),
      409,
      "PLAYBACK_REVOKED",
      "This playback session ended. Start again or transfer playback.",
    );
    const lesson = await tx.lesson.findUnique({
      where: { id: session.lessonId },
      include: { video: true, section: { include: { course: true } } },
    });
    requireCondition(
      lesson?.video.status === "PUBLISHED" &&
        lesson.section.course.status === "PUBLISHED",
      403,
      "CONTENT_UNAVAILABLE",
      "This lesson is no longer available.",
    );
    const duration = lesson.video.duration;
    requireCondition(
      input.position <= duration + 2,
      400,
      "INVALID_POSITION",
      "Position exceeds video duration.",
    );
    const prior = await tx.progress.findUnique({
      where: {
        userId_videoId: { userId: req.account.id, videoId: lesson.videoId },
      },
    });
    const elapsed = Math.max(
      0,
      (Date.now() - session.lastHeartbeat.getTime()) / 1000,
    );
    const delta = input.position - session.lastPosition;
    const credible =
      input.playing && delta > 0 && delta <= Math.min(30, elapsed * 2.1 + 2);
    const watched = watchedRanges(
      prior?.watchedRanges,
      credible
        ? Math.max(session.lastPosition, input.position - elapsed * 2.1)
        : input.position,
      input.position,
      duration,
    );
    const completed = duration > 0 && watched.seconds / duration >= 0.95;
    const p = await tx.progress.upsert({
      where: {
        userId_videoId: { userId: req.account.id, videoId: lesson.videoId },
      },
      create: {
        userId: req.account.id,
        videoId: lesson.videoId,
        position: input.position,
        watchedSeconds: watched.seconds,
        watchedRanges: watched.ranges,
        completedAt: completed ? new Date() : null,
      },
      update: {
        position: input.position,
        watchedSeconds: watched.seconds,
        watchedRanges: watched.ranges,
        completedAt: prior?.completedAt || (completed ? new Date() : null),
      },
    });
    await tx.playbackSession.update({
      where: { userId: req.account.id },
      data: {
        lastPosition: input.position,
        lastHeartbeat: new Date(),
        expiresAt: new Date(Date.now() + 45000),
      },
    });
    return p;
  });
  res.json(result);
});
app.get("/api/media/:ticket", async (req, res) => {
  const session = await db.playbackSession.findFirst({
    where: {
      id: id(req, "ticket"),
      expiresAt: { gt: new Date() },
      user: {
        suspended: false,
        memberships: {
          some: {
            startsAt: { lte: new Date() },
            endsAt: { gt: new Date() },
            revokedAt: null,
          },
        },
      },
    },
  });
  requireCondition(
    session,
    403,
    "PLAYBACK_EXPIRED",
    "Playback authorization expired.",
  );
  const d = await db.device.findFirst({
    where: { id: session.deviceId, revokedAt: null },
  });
  requireCondition(d, 403, "DEVICE_REVOKED", "Device access revoked.");
  const l = await publishedLesson(session.lessonId);
  requireCondition(
    l?.video.localPath,
    404,
    "MEDIA_MISSING",
    "Video unavailable.",
  );
  await sendLocalMedia(
    req,
    res,
    l.video.localPath,
    l.video.mimeType || "video/mp4",
  );
});
app.get("/api/media/:ticket/subtitles/:language", async (req, res) => {
  const session = await db.playbackSession.findFirst({
    where: {
      id: id(req, "ticket"),
      expiresAt: { gt: new Date() },
      user: {
        suspended: false,
        memberships: {
          some: {
            startsAt: { lte: new Date() },
            endsAt: { gt: new Date() },
            revokedAt: null,
          },
        },
      },
    },
  });
  requireCondition(
    session,
    403,
    "PLAYBACK_EXPIRED",
    "Playback authorization expired.",
  );
  const deviceOk = await db.device.findFirst({
    where: { id: session.deviceId, revokedAt: null },
  });
  requireCondition(deviceOk, 403, "DEVICE_REVOKED", "Device access revoked.");
  const l = await publishedLesson(session.lessonId);
  requireCondition(l, 404, "NOT_FOUND", "Lesson unavailable.");
  const s = await db.subtitle.findFirst({
    where: {
      videoId: l.videoId,
      language: id(req, "language"),
      approved: true,
    },
  });
  requireCondition(s, 404, "NOT_FOUND", "Subtitle unavailable.");
  res.type("text/vtt").send(s.content);
});
app.get("/api/me/quizzes/:id", async (req, res) => {
  await activeMembership(req);
  const quiz = await db.quiz.findFirst({
    where: { id: id(req), published: true, course: { status: "PUBLISHED" } },
    select: {
      id: true,
      course: { select: { title: true } },
      questions: {
        orderBy: { position: "asc" },
        select: { id: true, prompt: true, options: true },
      },
    },
  });
  requireCondition(quiz, 404, "NOT_FOUND", "Quiz unavailable.");
  res.json(quiz);
});
app.post("/api/me/quizzes/:id/attempts", async (req, res) => {
  await activeMembership(req);
  const { answers } = z
    .object({ answers: z.record(z.string(), z.number().int().min(0).max(5)) })
    .parse(req.body);
  const quiz = await db.quiz.findFirst({
    where: { id: id(req), published: true, course: { status: "PUBLISHED" } },
    include: { questions: { orderBy: { position: "asc" } } },
  });
  requireCondition(quiz, 404, "NOT_FOUND", "Quiz unavailable.");
  requireCondition(
    quiz.questions.length === Object.keys(answers).length &&
      quiz.questions.every(
        (q) =>
          answers[q.id] !== undefined &&
          answers[q.id]! < (q.options as string[]).length,
      ),
    400,
    "INCOMPLETE_QUIZ",
    "Answer every question before submitting.",
  );
  const g = grade(quiz.questions, answers);
  const attempt = await db.quizAttempt.create({
    data: { userId: req.account.id, quizId: quiz.id, answers, ...g },
  });
  res.status(201).json(attempt);
});
app.use("/api/admin-media", adminSourceMedia);
app.use("/api/admin", auth, admin, accountLimit, adminContent);
app.get("/api/admin/overview", async (_req, res) => {
  const [students, activeMemberships, videos, courses, queue] =
    await Promise.all([
      db.user.count(),
      db.user.count({
        where: {
          memberships: {
            some: {
              revokedAt: null,
              startsAt: { lte: new Date() },
              endsAt: { gt: new Date() },
            },
          },
        },
      }),
      db.video.count(),
      db.course.count({ where: { status: "PUBLISHED" } }),
      db.video.count({ where: { status: { in: ["PROCESSING", "REVIEW"] } } }),
    ]);
  res.json({
    students,
    activeMemberships,
    videos,
    courses,
    queue,
    mediaMode: config.mediaMode,
    paymentConfigured: false,
  });
});
app.get("/api/admin/courses", async (_req, res) =>
  res.json(
    await db.course.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        sections: {
          orderBy: { position: "asc" },
          include: {
            lessons: { orderBy: { position: "asc" }, include: { video: true } },
          },
        },
        quiz: { include: { questions: { orderBy: { position: "asc" } } } },
      },
    }),
  ),
);
app.post("/api/admin/courses", async (req, res) => {
  const input = CourseInput.parse(req.body);
  const slug =
    input.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "course";
  const c = await db.course.create({
    data: { ...input, slug: `${slug}-${randomUUID().slice(0, 6)}` },
  });
  res.status(201).json(c);
});
app.patch("/api/admin/courses/:id", async (req, res) =>
  res.json(
    await db.course.update({
      where: { id: id(req) },
      data: CourseInput.parse(req.body),
    }),
  ),
);
app.post("/api/admin/courses/:id/sections", async (req, res) => {
  const title = z.string().trim().min(2).max(100).parse(req.body.title);
  const section = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "geki"."Course" WHERE id=${id(req)} FOR UPDATE`;
    const last = await tx.section.aggregate({
      where: { courseId: id(req) },
      _max: { position: true },
    });
    return tx.section.create({
      data: {
        courseId: id(req),
        title,
        position: (last._max.position ?? -1) + 1,
      },
    });
  });
  res.status(201).json(section);
});
app.post("/api/admin/sections/:id/lessons", async (req, res) => {
  const input = z
    .object({
      videoId: z.string(),
      title: z.string().trim().min(2).max(150),
      description: z.string().max(5000).default(""),
      preview: z.boolean().default(false),
    })
    .parse(req.body);
  const lesson = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "geki"."Section" WHERE id=${id(req)} FOR UPDATE`;
    const last = await tx.lesson.aggregate({
      where: { sectionId: id(req) },
      _max: { position: true },
    });
    return tx.lesson.create({
      data: {
        ...input,
        sectionId: id(req),
        position: (last._max.position ?? -1) + 1,
      },
    });
  });
  res.status(201).json(lesson);
});
app.patch("/api/admin/lessons/:id", async (req, res) => {
  const input = z
    .object({
      title: z.string().trim().min(2).max(150),
      description: z.string().max(5000),
      preview: z.boolean(),
    })
    .parse(req.body);
  res.json(await db.lesson.update({ where: { id: id(req) }, data: input }));
});
app.post("/api/admin/sections/:id/reorder", async (req, res) => {
  const ids = z.array(z.string()).min(1).max(200).parse(req.body.ids);
  requireCondition(
    new Set(ids).size === ids.length,
    400,
    "DUPLICATE_LESSON",
    "Lesson IDs must be unique.",
  );
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "geki"."Section" WHERE id=${id(req)} FOR UPDATE`;
    const all = await tx.lesson.findMany({ where: { sectionId: id(req) } });
    requireCondition(
      all.length === ids.length && all.every((l) => ids.includes(l.id)),
      400,
      "INVALID_ORDER",
      "Provide every lesson from this section exactly once.",
    );
    for (let i = 0; i < ids.length; i++)
      await tx.lesson.update({
        where: { id: ids[i]! },
        data: { position: -i - 1 },
      });
    for (let i = 0; i < ids.length; i++)
      await tx.lesson.update({ where: { id: ids[i]! }, data: { position: i } });
  });
  res.json({ ok: true });
});
app.post("/api/admin/courses/:id/publish", async (req, res) => {
  const { reason } = ReasonInput.parse(req.body);
  await db.$transaction(async (tx) => {
    const course = await tx.course.findUnique({
      where: { id: id(req) },
      include: {
        sections: {
          include: {
            lessons: { include: { video: { include: { subtitles: true } } } },
          },
        },
      },
    });
    requireCondition(course, 404, "NOT_FOUND", "Course not found.");
    const lessons = course.sections.flatMap((s) => s.lessons);
    requireCondition(
      lessons.length &&
        lessons.every(
          (l) =>
            l.video.status === "PUBLISHED" &&
            ["en", "mm"].every((lang) =>
              l.video.subtitles.some((s) => s.language === lang && s.approved),
            ),
        ),
      409,
      "NOT_READY",
      "Every lesson needs a published video and approved English/Burmese subtitle tracks.",
    );
    await tx.course.update({
      where: { id: id(req) },
      data: { status: "PUBLISHED" },
    });
    await audit(tx, req, "COURSE_PUBLISHED", id(req), reason);
  });
  res.json({ ok: true });
});
app.get("/api/admin/videos", async (_req, res) =>
  res.json(
    await db.video.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        subtitles: true,
        _count: { select: { lessons: true, progress: true } },
      },
    }),
  ),
);
app.post("/api/admin/videos", async (req, res) => {
  const input = z
    .object({
      title: z.string().trim().min(2).max(150),
      duration: z.number().int().min(1).max(21600),
      providerAssetId: z
        .string()
        .regex(/^[a-zA-Z0-9_-]+$/)
        .optional(),
    })
    .parse(req.body);
  res.status(201).json(await db.video.create({ data: input }));
});
const upload = multer({
  storage: multer.diskStorage({
    destination(_req, _file, cb) {
      mkdir(config.uploadDir, { recursive: true }).then(
        () => cb(null, config.uploadDir),
        (e) => cb(e, config.uploadDir),
      );
    },
    filename(_req, file, cb) {
      cb(
        null,
        `${randomUUID()}.${file.mimetype === "video/webm" ? "webm" : "mp4"}`,
      );
    },
  }),
  limits: { fileSize: 500 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, cb) {
    const extension = extname(file.originalname).toLowerCase();
    if (
      ![".mp4", ".webm"].includes(extension) ||
      !["video/mp4", "video/webm", "application/octet-stream", ""].includes(
        file.mimetype,
      )
    )
      return cb(
        new HttpError(400, "INVALID_FILE", "Upload MP4 or WebM video."),
      );
    file.mimetype = extension === ".webm" ? "video/webm" : "video/mp4";
    cb(null, true);
  },
});
app.post(
  "/api/admin/videos/:id/upload",
  async (req, res, next) => {
    const video = await db.video.findUnique({
      where: { id: id(req) },
      include: { _count: { select: { progress: true } } },
    });
    requireCondition(video, 404, "NOT_FOUND", "Video not found.");
    requireCondition(
      !video._count.progress,
      409,
      "VIDEO_HAS_PROGRESS",
      "Create a new video to replace footage that students have already watched.",
    );
    upload.single("file")(req, res, next);
  },
  async (req, res) => {
    requireCondition(req.file, 400, "FILE_REQUIRED", "Choose a video.");
    const file = req.file;
    try {
      const duration = z.coerce
        .number()
        .int()
        .min(1)
        .max(21600)
        .optional()
        .parse(req.body.duration);
      const source = await open(req.file.path, "r");
      const header = Buffer.alloc(12);
      try {
        await source.read(header, 0, 12, 0);
      } finally {
        await source.close();
      }
      requireCondition(
        req.file.mimetype === "video/webm"
          ? header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
          : header.toString("ascii", 4, 8) === "ftyp",
        400,
        "INVALID_VIDEO",
        "This file is not a valid MP4 or WebM video.",
      );
      const { old, video } = await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "geki"."Video" WHERE id=${id(req)} FOR UPDATE`;
        const old = await tx.video.findUnique({
          where: { id: id(req) },
          include: { _count: { select: { progress: true } } },
        });
        requireCondition(old, 404, "NOT_FOUND", "Video not found.");
        requireCondition(
          old.status !== "PROCESSING",
          409,
          "VIDEO_PROCESSING",
          "Wait for protection processing before replacing this source.",
        );
        requireCondition(
          !old._count.progress,
          409,
          "VIDEO_HAS_PROGRESS",
          "Create a new video for replacement footage to preserve student progress.",
        );
        await tx.subtitle.updateMany({
          where: { videoId: old.id },
          data: { approved: false },
        });
        const video = await tx.video.update({
          where: { id: id(req) },
          data: {
            localPath: file.filename,
            mimeType: file.mimetype,
            status: "REVIEW",
            providerAssetId: null,
            ...(duration ? { duration } : {}),
          },
          include: {
            subtitles: true,
            _count: { select: { lessons: true, progress: true } },
          },
        });
        await audit(
          tx,
          req,
          "VIDEO_SOURCE_UPLOADED",
          video.id,
          "Administrator uploaded a private source file",
        );
        return { old: old.localPath, video };
      });
      if (old) await unlink(resolve(config.uploadDir, old)).catch(() => {});
      res.json(video);
    } catch (e) {
      await unlink(req.file.path);
      throw e;
    }
  },
);
app.put("/api/admin/videos/:id/subtitles/:language", async (req, res) => {
  const language = z.enum(["en", "mm"]).parse(req.params.language);
  const { content, approved } = z
    .object({
      content: z
        .string()
        .max(500000)
        .regex(/^WEBVTT(?:\r?\n|$)/, "Subtitles must use WebVTT format."),
      approved: z.boolean(),
    })
    .parse(req.body);
  requireCondition(
    !approved || hasCaptionText(content),
    400,
    "EMPTY_CAPTIONS",
    "Add actual caption text below the timestamps before approving subtitles.",
  );
  const s = await db.$transaction(async (tx) => {
    const track = await tx.subtitle.upsert({
      where: { videoId_language: { videoId: id(req), language } },
      create: { videoId: id(req), language, content, approved },
      update: { content, approved },
    });
    await tx.video.update({
      where: { id: id(req) },
      data: { status: "REVIEW" },
    });
    await audit(
      tx,
      req,
      approved ? "SUBTITLE_APPROVED" : "SUBTITLE_UPDATED",
      track.id,
      "Admin reviewed subtitle content",
      { language },
    );
    return track;
  });
  res.json(s);
});
app.post("/api/admin/videos/:id/publish", async (req, res) => {
  const { reason } = ReasonInput.parse(req.body);
  requireCondition(
    config.mediaMode === "local" ||
      (config.mediaMode === "vdocipher" && config.videoSecret),
    503,
    "STREAMING_NOT_CONFIGURED",
    "Your private upload is saved. Configure protected student streaming before publishing paid videos.",
  );
  const snapshot = await db.video.findUnique({
    where: { id: id(req) },
    include: { subtitles: true },
  });
  if (config.mediaMode === "vdocipher") {
    requireCondition(
      snapshot?.providerAssetId,
      409,
      "ASSET_MISSING",
      "Send this video for protection first.",
    );
    requireCondition(
      (await protectedStatus(snapshot.providerAssetId)).status === "ready",
      409,
      "ENCODING_PENDING",
      "Protected video encoding is not ready yet.",
    );
    requireCondition(
      snapshot.subtitles
        .filter((s) => s.approved)
        .every((s) => hasCaptionText(s.content)),
      409,
      "EMPTY_CAPTIONS",
      "Your subtitles contain timestamps but no caption text. Add the words, save and approve both languages, then sync subtitles before publishing.",
    );
    const synced = await db.auditEvent.findFirst({
      where: {
        action: "VIDEO_CAPTIONS_SYNCED",
        target: { startsWith: snapshot.id + ":" },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    requireCondition(
      synced?.target ===
        captionSyncTarget(
          snapshot.id,
          snapshot.providerAssetId,
          snapshot.subtitles,
        ),
      409,
      "CAPTIONS_NOT_SYNCED",
      "Sync the approved subtitles to the protected player before publishing.",
    );
  }
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "geki"."Video" WHERE id=${id(req)} FOR UPDATE`;
    const v = await tx.video.findUnique({
      where: { id: id(req) },
      include: { subtitles: true },
    });
    requireCondition(
      v &&
        snapshot &&
        v.updatedAt.getTime() === snapshot.updatedAt.getTime() &&
        captionSyncTarget(v.id, v.providerAssetId || "", v.subtitles) ===
          captionSyncTarget(
            snapshot.id,
            snapshot.providerAssetId || "",
            snapshot.subtitles,
          ),
      409,
      "VIDEO_CHANGED",
      "Video changed while checking protection. Try publishing again.",
    );
    requireCondition(
      v &&
        v.duration > 0 &&
        (config.mediaMode === "local" ? v.localPath : v.providerAssetId),
      409,
      "VIDEO_NOT_READY",
      "Video source and duration are required.",
    );
    requireCondition(
      ["en", "mm"].every((l) =>
        v.subtitles.some((s) => s.language === l && s.approved),
      ),
      409,
      "SUBTITLES_REQUIRED",
      "Approve English and Burmese subtitles first.",
    );
    await tx.video.update({
      where: { id: v.id },
      data: { status: "PUBLISHED" },
    });
    await audit(tx, req, "VIDEO_PUBLISHED", v.id, reason);
  });
  res.json({ ok: true });
});
app.put("/api/admin/courses/:id/quiz", async (req, res) => {
  const { questions, published } = z
    .object({
      questions: z.array(QuestionInput).min(1).max(100),
      published: z.boolean(),
    })
    .parse(req.body);
  const quiz = await db.$transaction(async (tx) => {
    const q = await tx.quiz.upsert({
      where: { courseId: id(req) },
      create: { courseId: id(req), published },
      update: { published },
    });
    await tx.question.deleteMany({ where: { quizId: q.id } });
    await tx.question.createMany({
      data: questions.map((v, i) => ({ ...v, quizId: q.id, position: i })),
    });
    await audit(tx, req, "QUIZ_UPDATED", q.id, "Admin saved course assessment");
    return q;
  });
  res.json(quiz);
});
app.get("/api/admin/students", async (req, res) => {
  const q = z
    .string()
    .max(100)
    .parse(req.query.q || "");
  res.json(
    await db.user.findMany({
      where: q
        ? {
            OR: [
              { displayName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        memberships: { orderBy: { endsAt: "desc" }, take: 3 },
        _count: { select: { devices: { where: { revokedAt: null } } } },
      },
    }),
  );
});
app.post("/api/admin/students/:id/action", async (req, res) => {
  const input = ReasonInput.extend({
    action: z.enum([
      "GRANT",
      "REVOKE",
      "SUSPEND",
      "RESTORE",
      "RESET_DEVICES",
      "ROLE",
    ]),
    plan: z.enum(["MONTHLY", "ANNUAL"]).optional(),
    role: z.enum(["STUDENT", "ADMIN", "SUPER_ADMIN"]).optional(),
  }).parse(req.body);
  requireCondition(
    input.action !== "ROLE" || req.account.role === "SUPER_ADMIN",
    403,
    "SUPER_ADMIN_REQUIRED",
    "Only a Super Admin can assign roles.",
  );
  await db.$transaction(async (tx) => {
    await lockUser(tx, id(req));
    const target = await tx.user.findUnique({ where: { id: id(req) } });
    requireCondition(target, 404, "NOT_FOUND", "Learner not found.");
    requireCondition(
      target.role !== "SUPER_ADMIN" || req.account.role === "SUPER_ADMIN",
      403,
      "SUPER_ADMIN_REQUIRED",
      "A Super Admin must manage this account.",
    );
    requireCondition(
      !(
        id(req) === req.account.id && ["SUSPEND", "ROLE"].includes(input.action)
      ),
      409,
      "SELF_ACTION_DENIED",
      "You cannot suspend or change your own role.",
    );
    if (input.action === "GRANT") {
      const active = await tx.membership.findFirst({
        where: { userId: id(req), revokedAt: null, endsAt: { gt: new Date() } },
        orderBy: { endsAt: "desc" },
      });
      const start = active?.endsAt || new Date();
      const end = new Date(start);
      input.plan === "ANNUAL"
        ? end.setUTCFullYear(end.getUTCFullYear() + 1)
        : end.setUTCMonth(end.getUTCMonth() + 1);
      await tx.membership.create({
        data: {
          userId: id(req),
          plan: input.plan || "MONTHLY",
          startsAt: start,
          endsAt: end,
        },
      });
      await tx.notification.create({
        data: {
          userId: id(req),
          title: "Membership access granted",
          body: "Your administrator has updated your learning access.",
          href: "/membership",
        },
      });
    }
    if (input.action === "REVOKE")
      await tx.membership.updateMany({
        where: { userId: id(req), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    if (["SUSPEND", "RESTORE"].includes(input.action))
      await tx.user.update({
        where: { id: id(req) },
        data: { suspended: input.action === "SUSPEND" },
      });
    if (input.action === "RESET_DEVICES") {
      await tx.device.updateMany({
        where: { userId: id(req), revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.playbackSession.deleteMany({ where: { userId: id(req) } });
    }
    if (input.action === "ROLE") {
      requireCondition(input.role, 400, "ROLE_REQUIRED", "Choose a role.");
      await tx.user.update({
        where: { id: id(req) },
        data: { role: input.role },
      });
    }
    await audit(tx, req, input.action, id(req), input.reason, {
      plan: input.plan || null,
      role: input.role || null,
    });
  });
  res.json({ ok: true });
});
app.get("/api/admin/audit", async (_req, res) =>
  res.json(
    await db.auditEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { actor: { select: { displayName: true } } },
    }),
  ),
);
app.get("/api/commerce", (_req, res) =>
  res.json({
    configured: false,
    plans: [
      { id: "MONTHLY", title: "Monthly membership", price: null },
      { id: "ANNUAL", title: "Annual membership", price: null },
    ],
  }),
);
app.post("/api/checkout", auth, (_req, _res) => {
  throw new HttpError(
    503,
    "PAYMENTS_NOT_CONFIGURED",
    "Payment methods and prices have not been approved yet. No payment was taken.",
  );
});
app.use((_req, _res) => {
  throw new HttpError(404, "NOT_FOUND", "Endpoint not found.");
});
app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ZodError)
    return res.status(400).json({
      error: "Please check the submitted fields.",
      code: "VALIDATION",
      details: error.flatten(),
    });
  if (error instanceof HttpError)
    return res
      .status(error.status)
      .json({ error: error.message, code: error.code, details: error.details });
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002")
      return res
        .status(409)
        .json({ error: "That record already exists.", code: "CONFLICT" });
    if (error.code === "P2025")
      return res
        .status(404)
        .json({ error: "Record not found.", code: "NOT_FOUND" });
  }
  if (error instanceof multer.MulterError)
    return res.status(400).json({ error: error.message, code: "UPLOAD_ERROR" });
  if (error instanceof SyntaxError)
    return res
      .status(400)
      .json({ error: "Invalid JSON body.", code: "INVALID_JSON" });
  console.error(
    JSON.stringify({
      event: "request_error",
      requestId: req.requestId,
      errorType: error instanceof Error ? error.name : "UnknownError",
      code:
        error instanceof Prisma.PrismaClientKnownRequestError
          ? error.code
          : undefined,
    }),
  );
  res.status(500).json({
    error: "Something went wrong. Please try again.",
    code: "INTERNAL_ERROR",
    requestId: req.requestId,
  });
});
export { app };
