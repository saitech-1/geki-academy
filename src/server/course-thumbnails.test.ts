import { expect, it } from "vitest";
import sharp from "sharp";
import { normalizeThumbnail } from "./course-thumbnails";

it("validates and optimizes uploaded artwork to a metadata-free WebP", async () => {
  const input = await sharp({
    create: { width: 1800, height: 1000, channels: 3, background: "red" },
  })
    .jpeg()
    .toBuffer();
  const result = await normalizeThumbnail(input);
  const metadata = await sharp(result).metadata();
  expect(metadata.format).toBe("webp");
  expect(metadata.width).toBeLessThanOrEqual(1600);
  expect(metadata.height).toBeLessThanOrEqual(900);
  expect(metadata.exif).toBeUndefined();
});
it("rejects a renamed non-image and SVG content", async () => {
  for (const input of [
    "not an image",
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>',
  ])
    await expect(normalizeThumbnail(Buffer.from(input))).rejects.toMatchObject({
      code: "INVALID_THUMBNAIL",
    });
});
it("rejects empty and oversized files before decoding", async () => {
  for (const input of [Buffer.alloc(0), Buffer.alloc(2 * 1024 * 1024 + 1)])
    await expect(normalizeThumbnail(input)).rejects.toMatchObject({
      code: "INVALID_THUMBNAIL",
    });
});
