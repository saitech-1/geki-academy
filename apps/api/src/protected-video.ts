import { openAsBlob } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, sep, basename } from "node:path";
import { z } from "zod";
import { config } from "./config.js";
import { HttpError, requireCondition } from "./domain.js";

const base = "https://dev.vdocipher.com/api/videos";
export function hasCaptionText(content: string) {
  return content
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .some((block) => {
      const lines = block.split("\n");
      const timing = lines.findIndex((line) =>
        /^\s*(?:\d{2,}:)?\d{2}:\d{2}\.\d{3}\s+-->\s+(?:\d{2,}:)?\d{2}:\d{2}\.\d{3}(?:\s|$)/.test(
          line,
        ),
      );
      return (
        timing >= 0 &&
        lines
          .slice(timing + 1)
          .some((line) => line.replace(/<[^>]*>/g, "").trim().length > 0)
      );
    });
}
export const captionSyncTarget = (
  videoId: string,
  assetId: string,
  subtitles: { language: string; content: string; approved: boolean }[],
) =>
  `${videoId}:${createHash("sha256")
    .update(
      JSON.stringify([
        assetId,
        subtitles
          .filter((s) => s.approved)
          .map((s) => [s.language, s.content] as const)
          .sort((a, b) => a[0].localeCompare(b[0])),
      ]),
    )
    .digest("hex")}`;
export async function providerRequest(path: string, init: RequestInit = {}) {
  requireCondition(
    config.videoSecret,
    503,
    "DRM_NOT_CONFIGURED",
    "Create a VdoCipher account and configure VDOCIPHER_API_SECRET on the API server first.",
  );
  let response: Response;
  try {
    response = await fetch(base + path, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Apisecret ${config.videoSecret}`,
      },
      signal: AbortSignal.timeout(30000),
      redirect: "error",
    });
  } catch {
    throw new HttpError(
      502,
      "VIDEO_PROVIDER_UNAVAILABLE",
      "The streaming provider could not be reached. Try again.",
    );
  }
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as {
      message?: unknown;
    } | null;
    const message =
      typeof error?.message === "string" ? error.message.toLowerCase() : "";
    if (response.status === 403 && message.includes("trial limit")) {
      throw new HttpError(
        409,
        "VIDEO_PROVIDER_QUOTA",
        "VdoCipher’s four-video trial limit is full. Link an existing uploaded video using its provider asset ID, or manage your videos and plan in the VdoCipher dashboard.",
      );
    }
  }
  requireCondition(
    response.ok,
    502,
    "VIDEO_PROVIDER_FAILED",
    "The streaming provider rejected the request. Check your API key, account quota and provider dashboard.",
  );
  return response;
}

export async function protectedStatus(assetId: string) {
  return z
    .object({ status: z.string(), length: z.number().optional() })
    .parse(
      await (await providerRequest(`/${encodeURIComponent(assetId)}`)).json(),
    );
}

export function safeUploadUrl(value: string) {
  const url = new URL(value);
  requireCondition(
    url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.hostname.endsWith(".amazonaws.com"),
    502,
    "INVALID_UPLOAD_DESTINATION",
    "The provider returned an unexpected upload destination.",
  );
  return url;
}

export async function createProtectedUpload(title: string) {
  return z
    .object({
      videoId: z.string().min(1),
      clientPayload: z.object({
        uploadLink: z.string().url(),
        policy: z.string(),
        key: z.string(),
        "x-amz-signature": z.string(),
        "x-amz-algorithm": z.string(),
        "x-amz-date": z.string(),
        "x-amz-credential": z.string(),
      }),
    })
    .parse(
      await (
        await providerRequest(`?title=${encodeURIComponent(title)}`, {
          method: "PUT",
        })
      ).json(),
    );
}

export async function transferProtectedSource(
  source: string,
  mime: string,
  payload: Awaited<ReturnType<typeof createProtectedUpload>>["clientPayload"],
) {
  const path = resolve(config.uploadDir, source);
  requireCondition(
    path.startsWith(config.uploadDir + sep),
    400,
    "INVALID_MEDIA",
    "Invalid source path.",
  );
  const form = new FormData();
  const { uploadLink, ...fields } = payload;
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  form.append("success_action_status", "201");
  form.append("success_action_redirect", "");
  // File-backed Blob avoids buffering an entire large video in memory. File must be last.
  form.append("file", await openAsBlob(path, { type: mime }), basename(path));
  const response = await fetch(safeUploadUrl(uploadLink), {
    method: "POST",
    body: form,
    redirect: "error",
    signal: AbortSignal.timeout(30 * 60000),
  });
  requireCondition(
    response.status === 201,
    502,
    "SOURCE_TRANSFER_FAILED",
    "Source transfer failed. The provider asset ID is saved; inspect it in VdoCipher before retrying.",
  );
  await response.body?.cancel();
}

export async function syncProtectedCaptions(
  assetId: string,
  language: string,
  content: string,
) {
  requireCondition(
    hasCaptionText(content),
    400,
    "EMPTY_CAPTIONS",
    `${language === "mm" ? "Burmese" : "English"} subtitles contain no caption text. Add the spoken words below the timestamps, save and approve, then sync again.`,
  );
  const lang = language === "mm" ? "my" : language;
  requireCondition(
    ["en", "my"].includes(lang),
    400,
    "INVALID_LANGUAGE",
    "Unsupported subtitle language.",
  );
  const path = `/${encodeURIComponent(assetId)}/files/`;
  const files = z
    .array(
      z.object({
        id: z.number(),
        format: z.string().nullable().optional(),
        lang: z.string().nullable().optional(),
        isDeletable: z.boolean().optional(),
      }),
    )
    .parse(await (await providerRequest(path)).json());
  const form = new FormData();
  form.append("file", new Blob([content], { type: "text/vtt" }), `${lang}.vtt`);
  const added = z.object({ id: z.number() }).parse(
    await (
      await providerRequest(path + `?language=${lang}`, {
        method: "POST",
        body: form,
      })
    ).json(),
  );
  // Replace only this language's uploaded VTT files, after the new track is accepted.
  for (const file of files.filter(
    (f) =>
      f.format === "vtt" &&
      f.lang === lang &&
      f.isDeletable &&
      f.id !== added.id,
  )) {
    await providerRequest(path + file.id, { method: "DELETE" });
  }
  return added.id;
}
