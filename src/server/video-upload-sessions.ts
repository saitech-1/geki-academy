import { z } from "zod";
import { randomUUID } from "node:crypto";
import type { PrismaClient, Prisma } from "@prisma/client";
import { createEndpoints } from "./http";
import { db } from "./db";
import { config } from "./config";
import { requireCondition } from "./domain";
import {
  createProtectedUpload,
  protectedStatus,
  providerRequest,
  safeUploadUrl,
} from "./protected-video";
import { rateLimit } from "./rate-limit";

const KIND = "VIDEO_DIRECT_UPLOAD";
export const uploadMetadata = z
  .object({
    filename: z
      .string()
      .min(1)
      .max(200)
      .refine((v) => /\.(mp4|webm)$/i.test(v) && !/[\\/\x00-\x1f]/.test(v)),
    size: z
      .number()
      .int()
      .min(12)
      .max(500 * 1024 * 1024),
    mime: z.enum(["video/mp4", "video/webm"]),
    duration: z.number().int().min(1).max(21600),
    header: z.string().max(64),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()
  .superRefine((v, ctx) => {
    const header = Buffer.from(v.header, "base64");
    const webm = /\.webm$/i.test(v.filename);
    if (
      v.mime !== (webm ? "video/webm" : "video/mp4") ||
      header.length < 12 ||
      (webm
        ? !header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
        : header.toString("ascii", 4, 8) !== "ftyp")
    )
      ctx.addIssue({
        code: "custom",
        message: "Choose a valid MP4 or WebM video.",
      });
  });
type Metadata = z.infer<typeof uploadMetadata>;
type Credentials = Awaited<ReturnType<typeof createProtectedUpload>>;
export const uploadProvider = {
  create: createProtectedUpload,
  status: protectedStatus,
  remove: async (assetId: string) => {
    await (
      await providerRequest(`?videos=${encodeURIComponent(assetId)}`, {
        method: "DELETE",
      })
    ).body?.cancel();
  },
};
type Provider = typeof uploadProvider;
type Session = Metadata & {
  sessionId: string;
  videoId: string;
  userId: string;
  previousStatus: string;
  previousLocalPath: string | null;
  previousMime: string | null;
  previousDuration: number;
  assetId?: string;
  credentials?: Credentials["clientPayload"];
  expires: number;
  policyExpires?: number;
};
const jobId = (videoId: string) => `video-upload:${videoId}`;
const include = {
  subtitles: true,
  _count: { select: { lessons: true, progress: true } },
} as const;
const read = (payload: Prisma.JsonValue) => payload as unknown as Session;
const pending = ["AUTHORIZING", "UPLOADING", "PROCESSING", "CLEANUP"];

export function credentialExpiry(payload: Credentials["clientPayload"]) {
  safeUploadUrl(payload.uploadLink);
  let policy;
  try {
    policy = JSON.parse(Buffer.from(payload.policy, "base64").toString());
  } catch {
    /* rejected below */
  }
  const expires = Date.parse(policy?.expiration);
  requireCondition(
    Number.isFinite(expires) && expires > Date.now() + 60000,
    502,
    "UPLOAD_POLICY_EXPIRED",
    "The provider upload authorization has expired. Please retry.",
  );
  requireCondition(
    Array.isArray(policy.conditions) &&
      policy.conditions.some(
        (c: unknown) =>
          (typeof c === "object" &&
            c &&
            !Array.isArray(c) &&
            "key" in c &&
            c.key === payload.key) ||
          (Array.isArray(c) &&
            c[0] === "eq" &&
            c[1] === "$key" &&
            c[2] === payload.key),
      ),
    502,
    "UNRESTRICTED_UPLOAD_POLICY",
    "The provider returned an unexpected upload authorization.",
  );
  return expires;
}
export async function startVideoUpload(
  database: PrismaClient,
  videoId: string,
  userId: string,
  input: Metadata,
  provider: Provider = uploadProvider,
) {
  const metadata = uploadMetadata.parse(input);
  const reserved = await database.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "geki"."Video" WHERE id=${videoId} FOR UPDATE`;
    const video = await tx.video.findUnique({
      where: { id: videoId },
      include,
    });
    requireCondition(video, 404, "NOT_FOUND", "Video not found.");
    const existing = await tx.job.findUnique({ where: { id: jobId(videoId) } });
    if (existing && pending.includes(existing.status)) {
      const old = read(existing.payload);
      requireCondition(
        old.userId === userId &&
          old.filename === metadata.filename &&
          old.size === metadata.size &&
          old.fingerprint === metadata.fingerprint &&
          existing.status !== "CLEANUP",
        409,
        "UPLOAD_IN_PROGRESS",
        "An upload session already exists. Check its status or cancel it before starting another.",
      );
      return { existing: true, session: old };
    }
    requireCondition(
      !video._count.progress &&
        video.status !== "PUBLISHED" &&
        video.status !== "PROCESSING" &&
        !video.providerAssetId,
      409,
      "VIDEO_IN_USE",
      "Create a new video for replacement footage, or finish the existing processing session first.",
    );
    const session: Session = {
      ...metadata,
      videoId,
      userId,
      sessionId: randomUUID(),
      previousStatus: video.status,
      previousLocalPath: video.localPath,
      previousMime: video.mimeType,
      previousDuration: video.duration,
      expires: Date.now() + 20 * 60000,
    };
    await tx.job.upsert({
      where: { id: jobId(videoId) },
      create: {
        id: jobId(videoId),
        kind: KIND,
        status: "AUTHORIZING",
        payload: session,
        runAt: new Date(session.expires),
      },
      update: {
        status: "AUTHORIZING",
        payload: session,
        runAt: new Date(session.expires),
        lastError: null,
      },
    });
    await tx.video.update({
      where: { id: videoId },
      data: { status: "PROCESSING" },
    });
    return { existing: false, session };
  });
  if (reserved.existing) {
    const current = await checkVideoUpload(database, videoId, provider);
    if (current.status !== "UPLOADING") return current;
    const stored = read(
      (await database.job.findUniqueOrThrow({ where: { id: jobId(videoId) } }))
        .payload,
    );
    requireCondition(
      stored.credentials && stored.expires > Date.now(),
      409,
      "UPLOAD_EXPIRED",
      "Cancel the expired upload session, then choose your file again.",
    );
    return { ...current, clientPayload: stored.credentials };
  }
  let session = reserved.session;
  try {
    const created = await provider.create(
      (await database.video.findUniqueOrThrow({ where: { id: videoId } }))
        .title,
    );
    // Persist the provider identifier before validating policy so failed setup is recoverable.
    session = { ...session, assetId: created.videoId };
    await database.job.update({
      where: { id: jobId(videoId) },
      data: { payload: session },
    });
    const policyExpires = credentialExpiry(created.clientPayload);
    session = {
      ...session,
      policyExpires,
      expires: Math.min(session.expires, policyExpires),
      credentials: created.clientPayload,
    };
    await database.job.update({
      where: { id: jobId(videoId) },
      data: {
        status: "UPLOADING",
        payload: session,
        runAt: new Date(session.expires),
      },
    });
    return {
      status: "UPLOADING",
      sessionId: session.sessionId,
      filename: session.filename,
      size: session.size,
      expires: session.expires,
      clientPayload: created.clientPayload,
    };
  } catch (error) {
    await database.job.update({
      where: { id: jobId(videoId) },
      data: {
        status: "CLEANUP",
        payload: session,
        runAt: new Date(),
        lastError: "UPLOAD_AUTHORIZATION_FAILED",
      },
    });
    await cleanupVideoUploads(database, provider, videoId).catch(() => {});
    throw error;
  }
}
export async function checkVideoUpload(
  database: PrismaClient,
  videoId: string,
  provider: Provider = uploadProvider,
) {
  const job = await database.job.findUnique({ where: { id: jobId(videoId) } });
  if (!job) return { status: "NONE" };
  const session = read(job.payload);
  const info = {
    sessionId: session.sessionId,
    filename: session.filename,
    size: session.size,
    expires: session.expires,
  };
  if (job.status === "COMPLETED")
    return {
      ...info,
      status: "READY",
      video: await database.video.findUnique({
        where: { id: videoId },
        include,
      }),
    };
  if (!pending.includes(job.status) || job.status === "CLEANUP")
    return { ...info, status: job.status };
  if (job.status === "AUTHORIZING") return { ...info, status: "AUTHORIZING" };
  requireCondition(
    session.assetId,
    409,
    "ASSET_MISSING",
    "Upload authorization is still being prepared.",
  );
  const state = await provider.status(session.assetId);
  const status = state.status.toLowerCase().replace(/[ _-]/g, "");
  if (["preupload", "uploading"].includes(status))
    return {
      ...info,
      status: session.expires <= Date.now() ? "EXPIRED" : "UPLOADING",
      video: await database.video.findUnique({
        where: { id: videoId },
        include,
      }),
    };
  if (status.includes("fail") || status.includes("error"))
    return { ...info, status: "FAILED" };
  const ready = status === "ready";
  requireCondition(
    ready || ["queued", "processing", "encoding"].includes(status),
    502,
    "UNKNOWN_PROVIDER_STATUS",
    "The provider returned an unknown processing status. Check again shortly.",
  );
  const result = await database.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "geki"."Video" WHERE id=${videoId} FOR UPDATE`;
    const current = await tx.job.findUniqueOrThrow({ where: { id: job.id } });
    requireCondition(
      read(current.payload).sessionId === session.sessionId &&
        ["UPLOADING", "PROCESSING", "COMPLETED"].includes(current.status),
      409,
      "UPLOAD_CANCELLED",
      "This upload session is no longer active.",
    );
    if (current.status === "COMPLETED")
      return tx.video.findUniqueOrThrow({ where: { id: videoId }, include });
    const video = await tx.video.findUniqueOrThrow({
      where: { id: videoId },
      include,
    });
    requireCondition(
      !video._count.progress &&
        video.status !== "PUBLISHED" &&
        (!video.providerAssetId || video.providerAssetId === session.assetId),
      409,
      "VIDEO_CHANGED",
      "The video changed during upload. Contact an administrator.",
    );
    if (ready)
      requireCondition(
        state.length && state.length > 0 && state.length <= 21600,
        409,
        "PROVIDER_DURATION_UNAVAILABLE",
        "The provider has not confirmed a supported video duration yet. Check again shortly.",
      );
    if (current.status === "UPLOADING")
      await tx.subtitle.updateMany({
        where: { videoId },
        data: { approved: false },
      });
    const updated = await tx.video.update({
      where: { id: videoId },
      data: {
        providerAssetId: session.assetId,
        localPath: null,
        mimeType: session.mime,
        duration: ready ? Math.ceil(state.length!) : session.duration,
        status: ready ? "REVIEW" : "PROCESSING",
      },
      include,
    });
    const { credentials: _credentials, ...safe } = session;
    await tx.job.update({
      where: { id: job.id },
      data: {
        status: ready ? "COMPLETED" : "PROCESSING",
        payload: safe,
        runAt: new Date(Date.now() + 24 * 3600000),
        lastError: null,
      },
    });
    if (ready)
      await tx.auditEvent.create({
        data: {
          actorId: session.userId,
          action: "VIDEO_DIRECT_UPLOAD_VERIFIED",
          target: videoId,
          reason: "Provider confirmed encrypted video ready",
          data: { assetId: session.assetId },
        },
      });
    return updated;
  });
  return {
    ...info,
    status: result.status === "PROCESSING" ? "PROCESSING" : "READY",
    video: result,
  };
}
export async function cancelVideoUpload(
  database: PrismaClient,
  videoId: string,
  userId: string,
  sessionId: string,
  provider: Provider = uploadProvider,
) {
  await database.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "geki"."Video" WHERE id=${videoId} FOR UPDATE`;
    const job = await tx.job.findUnique({ where: { id: jobId(videoId) } });
    requireCondition(
      job &&
        read(job.payload).sessionId === sessionId &&
        read(job.payload).userId === userId,
      404,
      "NOT_FOUND",
      "Upload session not found.",
    );
    requireCondition(
      job.status !== "AUTHORIZING",
      409,
      "UPLOAD_AUTHORIZING",
      "Wait for upload authorization before cancelling.",
    );
    requireCondition(
      job.status !== "COMPLETED",
      409,
      "UPLOAD_COMPLETED",
      "This video has already finished processing.",
    );
    if (job.status !== "CLEANED")
      await tx.job.update({
        where: { id: job.id },
        data: { status: "CLEANUP", runAt: new Date() },
      });
  });
  await cleanupVideoUploads(database, provider, videoId);
  return { status: "CANCELLED" };
}
export async function cleanupVideoUploads(
  database: PrismaClient,
  provider: Provider = uploadProvider,
  videoId?: string,
) {
  const jobs = await database.job.findMany({
    where: {
      kind: KIND,
      ...(videoId ? { id: jobId(videoId) } : {}),
      status: { in: pending },
      runAt: { lte: new Date() },
    },
    take: 5,
  });
  for (const job of jobs) {
    const session = read(job.payload);
    try {
      if (job.status !== "CLEANUP" && session.assetId) {
        const current = await checkVideoUpload(
          database,
          session.videoId,
          provider,
        );
        if (["READY", "PROCESSING"].includes(current.status)) continue;
      }
      await database.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "geki"."Video" WHERE id=${session.videoId} FOR UPDATE`;
        const latest = await tx.job.findUniqueOrThrow({
          where: { id: job.id },
        });
        requireCondition(
          read(latest.payload).sessionId === session.sessionId &&
            pending.includes(latest.status),
          409,
          "SESSION_CHANGED",
          "Upload session changed.",
        );
        const video = await tx.video.findUnique({
          where: { id: session.videoId },
          include: { _count: { select: { progress: true } } },
        });
        requireCondition(
          !video ||
            (!video._count.progress &&
              video.status !== "PUBLISHED" &&
              (!video.providerAssetId ||
                video.providerAssetId === session.assetId)),
          409,
          "ASSET_IN_USE",
          "The uploaded asset is in use and cannot be removed.",
        );
        if (video)
          await tx.video.update({
            where: { id: video.id },
            data: {
              status: session.previousStatus as "DRAFT" | "REVIEW",
              providerAssetId: null,
              localPath: session.previousLocalPath,
              mimeType: session.previousMime,
              duration: session.previousDuration,
            },
          });
        await tx.job.update({
          where: { id: job.id },
          data: { status: "CLEANUP" },
        });
      });
      if (session.assetId) {
        // Never delete an asset referenced by any video, including a manually linked record.
        requireCondition(
          !(await database.video.count({
            where: { providerAssetId: session.assetId },
          })),
          409,
          "ASSET_IN_USE",
          "The uploaded asset is linked to a video.",
        );
        await provider.remove(session.assetId);
      }
      const { credentials: _credentials, ...safe } = session;
      await database.job.update({
        where: { id: job.id },
        data: { status: "CLEANED", payload: safe, lastError: null },
      });
    } catch {
      await database.job.updateMany({
        where: { id: job.id, status: { in: pending } },
        data: {
          lastError: "UPLOAD_CLEANUP_PENDING",
          runAt: new Date(Date.now() + 3600000),
        },
      });
    }
  }
}
export const directVideoUploads = createEndpoints();
directVideoUploads.post(
  "/videos/:id/upload-session",
  rateLimit({
    windowMs: 60000,
    limit: 10,
    keyGenerator: (req) => req.account.id,
  }),
  async (req, res) => {
    if (!config.production && config.mediaMode === "local") {
      res.json({ mode: "local" });
      return;
    }
    requireCondition(
      config.mediaMode === "vdocipher" && config.videoSecret,
      503,
      "DRM_NOT_CONFIGURED",
      "Configure protected streaming before uploading course videos.",
    );
    res.json(
      await startVideoUpload(
        db,
        req.params.id!,
        req.account.id,
        uploadMetadata.parse(req.body),
      ),
    );
  },
);
directVideoUploads.get("/videos/:id/upload-session", async (req, res) =>
  res.json(await checkVideoUpload(db, req.params.id!)),
);
directVideoUploads.post(
  "/videos/:id/upload-session/complete",
  async (req, res) => {
    const sessionId = z.uuid().parse(req.body.sessionId);
    const job = await db.job.findUnique({
      where: { id: jobId(req.params.id!) },
    });
    requireCondition(
      job &&
        read(job.payload).sessionId === sessionId &&
        read(job.payload).userId === req.account.id,
      404,
      "NOT_FOUND",
      "Upload session not found.",
    );
    res.json(await checkVideoUpload(db, req.params.id!));
  },
);
directVideoUploads.post("/videos/:id/upload-session/cancel", async (req, res) =>
  res.json(
    await cancelVideoUpload(
      db,
      req.params.id!,
      req.account.id,
      z.uuid().parse(req.body.sessionId),
    ),
  ),
);
