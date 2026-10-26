import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const fake = vi.hoisted(() => ({
  createSignedUploadUrl: vi.fn(),
  download: vi.fn(),
  createSignedUrl: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ storage: { from: () => fake } }),
}));
import { createReceiptUpload, readReceiptUpload } from "./receipt-storage";
describe("private receipt upload tickets", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-server-secret");
    vi.clearAllMocks();
    fake.createSignedUploadUrl.mockResolvedValue({
      data: { signedUrl: "https://example.supabase.co/upload" },
      error: null,
    });
    fake.download.mockResolvedValue({
      data: new Blob([new Uint8Array([1, 2, 3])]),
      error: null,
    });
  });
  afterEach(() => vi.unstubAllEnvs());
  it("accepts the owning buyer and order only", async () => {
    const upload = await createReceiptUpload("buyer", "order");
    await expect(
      readReceiptUpload(upload.uploadToken, "other", "order"),
    ).rejects.toMatchObject({ code: "INVALID_UPLOAD" });
    await expect(
      readReceiptUpload(upload.uploadToken, "buyer", "other"),
    ).rejects.toMatchObject({ code: "INVALID_UPLOAD" });
    expect(fake.download).not.toHaveBeenCalled();
    const receipt = await readReceiptUpload(
      upload.uploadToken,
      "buyer",
      "order",
    );
    expect(receipt.path).toMatch(/^supabase:buyer\/order\//);
    expect(receipt.bytes).toEqual(Buffer.from([1, 2, 3]));
  });
  it("rejects tampering and expired tickets before reading objects", async () => {
    const upload = await createReceiptUpload("buyer", "order");
    await expect(
      readReceiptUpload(
        "changed." + upload.uploadToken.split(".")[1],
        "buyer",
        "order",
      ),
    ).rejects.toMatchObject({ code: "INVALID_UPLOAD" });
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 3 * 3600000);
    try {
      await expect(
        readReceiptUpload(upload.uploadToken, "buyer", "order"),
      ).rejects.toMatchObject({ code: "INVALID_UPLOAD" });
    } finally {
      vi.restoreAllMocks();
    }
    expect(fake.download).not.toHaveBeenCalled();
  });
  it("rejects oversized uploaded objects", async () => {
    const upload = await createReceiptUpload("buyer", "order");
    fake.download.mockResolvedValue({
      data: { size: 6 * 1024 * 1024 },
      error: null,
    });
    await expect(
      readReceiptUpload(upload.uploadToken, "buyer", "order"),
    ).rejects.toMatchObject({ code: "INVALID_RECEIPT" });
  });
});
