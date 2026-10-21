import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "./config.js";
import {
  captionSyncTarget,
  protectedStatus,
  providerRequest,
  safeUploadUrl,
  syncProtectedCaptions,
  createProtectedUpload,
  hasCaptionText,
} from "./protected-video.js";

const originalSecret = config.videoSecret;
const fetchMock = vi.fn();
beforeEach(() => {
  config.videoSecret = "test-server-secret";
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  config.videoSecret = originalSecret;
  vi.unstubAllGlobals();
});
describe("protected streaming provider contract", () => {
  it("explains the trial quota rejection instead of blaming valid credentials", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { message: "You have reached the trial limit of 4 videos." },
        { status: 403 },
      ),
    );
    await expect(createProtectedUpload("Chudan Tsuki")).rejects.toMatchObject({
      status: 409,
      code: "VIDEO_PROVIDER_QUOTA",
    });
  });
  it("never calls the provider without a server secret", async () => {
    config.videoSecret = undefined;
    await expect(providerRequest("/asset")).rejects.toMatchObject({
      code: "DRM_NOT_CONFIGURED",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("uses server authentication and preserves processing status", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ status: "Queued", length: 42 }),
    );
    expect(await protectedStatus("asset/unsafe")).toEqual({
      status: "Queued",
      length: 42,
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://dev.vdocipher.com/api/videos/asset%2Funsafe",
    );
    expect(fetchMock.mock.calls[0]?.[1].headers.Authorization).toBe(
      "Apisecret test-server-secret",
    );
  });
  it("sanitizes provider failures without leaking secrets or response bodies", async () => {
    fetchMock.mockResolvedValue(
      new Response("private provider response", { status: 401 }),
    );
    await expect(protectedStatus("a")).rejects.toMatchObject({
      code: "VIDEO_PROVIDER_FAILED",
    });
    fetchMock.mockRejectedValue(new Error("network error with secret"));
    await expect(protectedStatus("a")).rejects.toMatchObject({
      code: "VIDEO_PROVIDER_UNAVAILABLE",
    });
  });
  it("restricts upload destinations to HTTPS provider storage without credentials or ports", () => {
    expect(safeUploadUrl("https://bucket.s3.amazonaws.com/").protocol).toBe(
      "https:",
    );
    for (const url of [
      "http://bucket.s3.amazonaws.com",
      "https://localhost",
      "https://s3.amazonaws.com.evil.example",
      "https://user@bucket.s3.amazonaws.com",
      "https://bucket.s3.amazonaws.com:8443",
    ]) {
      expect(() => safeUploadUrl(url)).toThrow();
    }
  });
  it("requests upload policies using PUT and encoded titles", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        videoId: "asset",
        clientPayload: {
          uploadLink: "https://bucket.s3.amazonaws.com",
          policy: "p",
          key: "k",
          "x-amz-signature": "s",
          "x-amz-algorithm": "a",
          "x-amz-date": "d",
          "x-amz-credential": "c",
        },
      }),
    );
    expect((await createProtectedUpload("Kihon & Kata")).videoId).toBe("asset");
    expect(fetchMock.mock.calls[0]?.[0]).toContain("title=Kihon%20%26%20Kata");
    expect(fetchMock.mock.calls[0]?.[1].method).toBe("PUT");
  });
  it("maps Burmese to my, uploads before deleting only replaced same-language captions", async () => {
    fetchMock
      .mockResolvedValueOnce(
        Response.json([
          { id: 1, format: "vtt", lang: "my", isDeletable: true },
          { id: 2, format: "vtt", lang: "en", isDeletable: true },
          { id: 3, format: "jpeg", lang: "my", isDeletable: true },
          { id: 5, format: null, lang: null, isDeletable: false },
        ]),
      )
      .mockResolvedValueOnce(Response.json({ id: 4 }))
      .mockResolvedValueOnce(Response.json({ message: "Deleted" }));
    expect(
      await syncProtectedCaptions(
        "asset",
        "mm",
        "WEBVTT\n\n00:00.000 --> 00:05.000\nမင်္ဂလာပါ\n",
      ),
    ).toBe(4);
    expect(fetchMock.mock.calls[1]?.[0]).toContain("?language=my");
    expect(fetchMock.mock.calls[1]?.[1].body.get("file").type).toBe("text/vtt");
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      "https://dev.vdocipher.com/api/videos/asset/files/1",
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it("invalidates subtitle synchronization on content or asset changes", () => {
    const tracks = [
      { language: "en", content: "WEBVTT", approved: true },
      { language: "mm", content: "WEBVTT mm", approved: true },
    ];
    const target = captionSyncTarget("video", "asset", tracks);
    expect(captionSyncTarget("video", "asset", [...tracks].reverse())).toBe(
      target,
    );
    expect(captionSyncTarget("video", "new-asset", tracks)).not.toBe(target);
    expect(
      captionSyncTarget("video", "asset", [
        { ...tracks[0]!, content: "changed" },
        tracks[1]!,
      ]),
    ).not.toBe(target);
  });
  it("rejects timestamp-only captions before making provider requests", async () => {
    expect(hasCaptionText("WEBVTT\n\n00:00.000 --> 00:05.000\n")).toBe(false);
    expect(
      hasCaptionText(
        "WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nPosition your hands.\n",
      ),
    ).toBe(true);
    await expect(
      syncProtectedCaptions(
        "asset",
        "en",
        "WEBVTT\n\n00:00.000 --> 00:05.000\n",
      ),
    ).rejects.toMatchObject({ code: "EMPTY_CAPTIONS" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
