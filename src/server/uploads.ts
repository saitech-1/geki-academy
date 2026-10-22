import busboy from "busboy";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { extname, join } from "node:path";
import type { Request } from "./http";
import { HttpError } from "./domain";

export async function receiveUpload(
  req: Request,
  options: { field: string; directory: string; video?: boolean },
) {
  const maxBytes = options.video ? 500 * 1024 * 1024 : 5 * 1024 * 1024;
  if (process.env.VERCEL)
    throw new HttpError(
      503,
      "DIRECT_UPLOAD_REQUIRED",
      "Cloud uploads require private direct-upload storage. Contact GEKI support.",
    );
  await mkdir(options.directory, { recursive: true });
  const parser = busboy({
    headers: req.headers,
    limits: {
      fileSize: maxBytes,
      files: 1,
      fields: 1,
      fieldSize: options.video ? 64 : 128,
    },
  });
  const writes: Promise<void>[] = [];
  let issue: Error | undefined;
  let filePath: string | undefined;
  parser.on("field", (name, value, info) => {
    if (info.valueTruncated)
      issue = new HttpError(400, "UPLOAD_ERROR", "Upload field is too long.");
    req.body[name] = value;
  });
  parser.on("filesLimit", () => {
    issue = new HttpError(400, "UPLOAD_ERROR", "Only one file is allowed.");
  });
  parser.on("fieldsLimit", () => {
    issue = new HttpError(400, "UPLOAD_ERROR", "Unexpected upload fields.");
  });
  parser.on("file", (field, stream, info) => {
    const extension = extname(info.filename || "").toLowerCase();
    const valid = options.video
      ? [".mp4", ".webm"].includes(extension) &&
        ["video/mp4", "video/webm", "application/octet-stream", ""].includes(
          info.mimeType,
        )
      : ["image/jpeg", "image/png"].includes(info.mimeType);
    if (field !== options.field || !valid) {
      issue = new HttpError(
        400,
        "INVALID_FILE",
        options.video
          ? "Upload MP4 or WebM video."
          : "Upload a PNG or JPEG receipt.",
      );
      stream.resume();
      return;
    }
    const filename = randomUUID() + (options.video ? extension : ".receipt");
    filePath = join(options.directory, filename);
    const file = {
      path: filePath,
      filename,
      mimetype: options.video
        ? extension === ".webm"
          ? "video/webm"
          : "video/mp4"
        : info.mimeType,
      size: 0,
    };
    req.file = file;
    stream.on("data", (data: Buffer) => {
      file.size += data.length;
    });
    stream.on("limit", () => {
      issue = new HttpError(
        400,
        "UPLOAD_ERROR",
        "File exceeds the upload size limit.",
      );
    });
    const write = pipeline(
      stream,
      createWriteStream(filePath, { flags: "wx", mode: 0o600 }),
    );
    writes.push(write);
    void write.catch(() => {});
  });
  try {
    if (!req.raw.body)
      throw new HttpError(400, "FILE_REQUIRED", "Choose a file.");
    await pipeline(
      Readable.fromWeb(
        req.raw.body as import("node:stream/web").ReadableStream,
      ),
      parser,
    );
    await Promise.all(writes);
    if (issue) throw issue;
  } catch (error) {
    await Promise.allSettled(writes);
    if (filePath) await unlink(filePath).catch(() => {});
    throw error;
  }
}
