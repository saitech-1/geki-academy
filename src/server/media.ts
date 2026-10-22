import { Readable } from "node:stream";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import type { Request, Response } from "./http";
import { config } from "./config";
import { HttpError, requireCondition } from "./domain";
export async function sendLocalMedia(
  req: Request,
  res: Response,
  file: string,
  mime: string,
  adminSourcePreview = false,
) {
  requireCondition(
    adminSourcePreview || (config.mediaMode === "local" && !config.production),
    503,
    "MEDIA_DISABLED",
    "Local media is unavailable.",
  );
  const target = resolve(config.uploadDir, file);
  requireCondition(
    target.startsWith(config.uploadDir + sep),
    400,
    "INVALID_MEDIA",
    "Invalid media path.",
  );
  let size: number;
  try {
    size = (await stat(target)).size;
  } catch {
    throw new HttpError(
      404,
      "MEDIA_MISSING",
      "The source video is unavailable.",
    );
  }
  res.setHeader("Content-Type", mime);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "private, no-store");
  const range = req.headers.range;
  if (range) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(range);
    if (!match) {
      res.status(416).setHeader("Content-Range", `bytes */${size}`);
      return res.end();
    }
    const start = Number(match[1]),
      end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    if (start >= size || end < start) {
      res.status(416).setHeader("Content-Range", `bytes */${size}`);
      return res.end();
    }
    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
    res.setHeader("Content-Length", end - start + 1);
    res.send(
      Readable.toWeb(
        createReadStream(target, { start, end }),
      ) as ReadableStream<Uint8Array>,
    );
  } else {
    res.setHeader("Content-Length", size);
    res.send(
      Readable.toWeb(createReadStream(target)) as ReadableStream<Uint8Array>,
    );
  }
}
export async function playbackProvider(assetId: string, watermark: string) {
  requireCondition(
    config.mediaMode === "vdocipher" && config.videoSecret,
    503,
    "DRM_NOT_CONFIGURED",
    "Protected streaming has not been configured.",
  );
  const response = await fetch(
    `https://dev.vdocipher.com/api/videos/${encodeURIComponent(assetId)}/otp`,
    {
      method: "POST",
      headers: {
        Authorization: `Apisecret ${config.videoSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ttl: 60,
        annotate: JSON.stringify([
          {
            type: "rtext",
            text: watermark,
            alpha: "0.45",
            color: "0xFFFFFF",
            size: "12",
            interval: "5000",
            skip: "10000",
          },
        ]),
      }),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok)
    throw new HttpError(
      502,
      "VIDEO_PROVIDER_FAILED",
      "Video authorization failed. Please try again.",
    );
  const data = (await response.json()) as { otp: string; playbackInfo: string };
  requireCondition(
    data.otp && data.playbackInfo,
    502,
    "VIDEO_PROVIDER_FAILED",
    "Invalid video provider response.",
  );
  return {
    kind: "vdocipher",
    embedUrl: `https://player.vdocipher.com/v2/?otp=${encodeURIComponent(data.otp)}&playbackInfo=${encodeURIComponent(data.playbackInfo)}`,
  };
}
