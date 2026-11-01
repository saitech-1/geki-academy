import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createEndpoints } from "./http";
import { config } from "./config";
import { db } from "./db";
import { requireCondition, HttpError } from "./domain";
import { rateLimit } from "./rate-limit";

export const thumbnailBucket = "geki-course-thumbnails";
const maxBytes = 2 * 1024 * 1024;
const local = () => !config.production && config.mediaMode === "local";
export async function normalizeThumbnail(bytes: Buffer) {
  requireCondition(
    bytes.length > 0 && bytes.length <= maxBytes,
    400,
    "INVALID_THUMBNAIL",
    "Choose a JPG, PNG or WebP image smaller than 2 MB.",
  );
  try {
    const image = sharp(bytes, {
      limitInputPixels: 25_000_000,
      failOn: "warning",
    });
    const metadata = await image.metadata();
    if (
      !["jpeg", "png", "webp"].includes(metadata.format || "") ||
      (metadata.pages || 1) > 1
    )
      throw Error("Unsupported image");
    return await image
      .rotate()
      .resize({
        width: 1600,
        height: 900,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw new HttpError(
      400,
      "INVALID_THUMBNAIL",
      "Choose a valid, non-animated JPG, PNG or WebP image.",
    );
  }
}
export async function thumbnailStorage() {
  requireCondition(
    process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY,
    503,
    "THUMBNAIL_STORAGE_UNAVAILABLE",
    "Thumbnail storage is not configured. Please try again later.",
  );
  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  let bucket = await client.storage.getBucket(thumbnailBucket);
  if (
    bucket.error &&
    bucket.error.message.toLowerCase().includes("not found")
  ) {
    await client.storage.createBucket(thumbnailBucket, {
      public: true,
      fileSizeLimit: maxBytes,
      allowedMimeTypes: ["image/webp"],
    });
    bucket = await client.storage.getBucket(thumbnailBucket);
  }
  requireCondition(
    !bucket.error && bucket.data?.public,
    503,
    "THUMBNAIL_STORAGE_UNAVAILABLE",
    "Thumbnail storage is unavailable. Please try again later.",
  );
  return client.storage.from(thumbnailBucket);
}
export const thumbnailUploads = createEndpoints();
thumbnailUploads.post(
  "/courses/:id/thumbnail",
  rateLimit({
    windowMs: 60000,
    limit: 10,
    keyGenerator: (req) => req.account.id,
  }),
  async (req, res) => {
    const course = await db.course.findUnique({
      where: { id: req.params.id! },
      select: { id: true },
    });
    requireCondition(course, 404, "NOT_FOUND", "Course not found.");
    requireCondition(
      ["image/jpeg", "image/png", "image/webp"].includes(
        req.raw.headers.get("content-type") || "",
      ),
      400,
      "INVALID_THUMBNAIL",
      "Choose a JPG, PNG or WebP image smaller than 2 MB.",
    );
    requireCondition(
      Number(req.raw.headers.get("content-length") || 0) <= maxBytes,
      413,
      "THUMBNAIL_TOO_LARGE",
      "Choose a JPG, PNG or WebP image smaller than 2 MB.",
    );
    const reader = req.raw.body?.getReader(),
      chunks: Uint8Array[] = [];
    let size = 0;
    if (reader)
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maxBytes) {
          await reader.cancel();
          throw new HttpError(
            413,
            "THUMBNAIL_TOO_LARGE",
            "Choose a JPG, PNG or WebP image smaller than 2 MB.",
          );
        }
        chunks.push(value);
      }
    const image = await normalizeThumbnail(Buffer.concat(chunks));
    const filename = randomUUID() + ".webp";
    let url: string;
    if (local()) {
      const directory = join(config.uploadDir, "course-thumbnails");
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, filename), image, { flag: "wx" });
      url = "/api/course-thumbnails/" + filename;
    } else {
      const storage = await thumbnailStorage();
      const path = `${course.id}/${filename}`;
      const result = await storage.upload(path, image, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });
      requireCondition(
        !result.error,
        503,
        "THUMBNAIL_UPLOAD_FAILED",
        "Could not upload the thumbnail. Please try again.",
      );
      url = storage.getPublicUrl(path).data.publicUrl;
    }
    res.status(201).json({ url });
  },
);
export const thumbnailPublic = createEndpoints();
thumbnailPublic.get("/:filename", async (req, res) => {
  requireCondition(
    local() && /^[a-f0-9-]{36}\.webp$/.test(req.params.filename || ""),
    404,
    "NOT_FOUND",
    "Thumbnail not found.",
  );
  let image: Buffer;
  try {
    image = await readFile(
      join(config.uploadDir, "course-thumbnails", req.params.filename!),
    );
  } catch {
    throw new HttpError(404, "NOT_FOUND", "Thumbnail not found.");
  }
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.type("image/webp").send(new Uint8Array(image));
});
