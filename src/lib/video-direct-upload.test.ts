import { afterEach, expect, it, vi } from "vitest";
vi.mock("./firebase", () => ({
  firebaseAuth: () => ({
    currentUser: { uid: "fixture", getIdToken: async () => "firebase-fixture" },
  }),
}));
import { uploadVideo } from "./api";
afterEach(() => vi.unstubAllGlobals());
function setup(
  mode: "ok" | "network" | "abort" | "complete-failure" = "ok",
  controller = new AbortController(),
) {
  const storage = new Map<string, string>();
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => storage.get(k),
    setItem: (k: string, v: string) => storage.set(k, v),
  });
  const events: string[] = [],
    requests: { url: string; form: FormData }[] = [];
  class Request {
    upload = { onprogress: (_e: unknown) => {} };
    onload = () => {};
    onerror = () => {};
    onabort = () => {};
    ontimeout = () => {};
    status = 201;
    url = "";
    timeout = 0;
    open(_method: string, url: string) {
      this.url = url;
    }
    send(form: FormData) {
      requests.push({ url: this.url, form });
      if (mode === "abort") {
        controller.abort();
        return;
      }
      if (mode === "network") {
        this.onerror();
        return;
      }
      this.upload.onprogress({
        lengthComputable: true,
        loaded: 1000,
        total: 1000,
      });
      events.push("provider-201");
      this.onload();
    }
    abort() {
      this.onabort();
    }
  }
  vi.stubGlobal("XMLHttpRequest", Request);
  const fetcher = vi.fn(async (url: string, init: RequestInit) => {
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer firebase-fixture",
    );
    expect(String(init.body).length).toBeLessThan(1000);
    if (url.endsWith("/complete")) {
      events.push("server-verification");
      return mode === "complete-failure"
        ? Response.json(
            { error: "Provider unavailable", code: "VERIFY_FAILED" },
            { status: 502 },
          )
        : Response.json({
            status: "PROCESSING",
            video: { id: "video-1", status: "PROCESSING" },
          });
    }
    if (url.endsWith("/cancel")) return Response.json({ status: "CANCELLED" });
    return Response.json({
      status: "UPLOADING",
      sessionId: "session-1",
      clientPayload: {
        uploadLink: "https://fixture.s3.amazonaws.com/",
        key: "restricted-object",
        policy: "signed-fixture",
        "x-amz-signature": "fixture",
      },
    });
  });
  vi.stubGlobal("fetch", fetcher);
  return { events, requests, fetcher, controller };
}
const file = (size = 6 * 1024 * 1024) =>
  new File([new Uint8Array(size)], "training.mp4", { type: "video/mp4" });
it("sends a file larger than Vercel's limit only to the provider, with the file last and no Firebase headers", async () => {
  const state = setup();
  const result = await uploadVideo<{ status: string }>(
    "/admin/videos/video-1/upload",
    file(),
    (value) => state.events.push("progress-" + value),
    3,
  );
  expect(result.status).toBe("PROCESSING");
  expect(state.requests).toHaveLength(1);
  expect(state.requests[0]!.url).toBe("https://fixture.s3.amazonaws.com/");
  expect([...state.requests[0]!.form.keys()].at(-1)).toBe("file");
  expect((state.requests[0]!.form.get("file") as File).size).toBe(
    6 * 1024 * 1024,
  );
  expect(state.events).toEqual([
    "progress-99",
    "provider-201",
    "server-verification",
    "progress-100",
  ]);
  expect(
    state.fetcher.mock.calls.every(([url]) => !url.endsWith("/upload")),
  ).toBe(true);
});
it("does not announce 100% when provider verification fails", async () => {
  const state = setup("complete-failure"),
    progress: number[] = [];
  await expect(
    uploadVideo(
      "/admin/videos/video-1/upload",
      file(16),
      (value) => progress.push(value),
      3,
    ),
  ).rejects.toThrow("Provider unavailable");
  expect(progress).toEqual([99]);
  expect(state.fetcher).toHaveBeenCalledTimes(2);
});
it("keeps an interrupted transfer retryable without claiming completion", async () => {
  const state = setup("network");
  await expect(
    uploadVideo("/admin/videos/video-1/upload", file(16), () => {}, 3),
  ).rejects.toThrow("Upload interrupted");
  expect(state.fetcher).toHaveBeenCalledTimes(1);
});
it("aborts the provider transfer and requests server-side session cleanup", async () => {
  const state = setup("abort");
  await expect(
    uploadVideo(
      "/admin/videos/video-1/upload",
      file(16),
      () => {},
      3,
      state.controller.signal,
    ),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(state.fetcher.mock.calls.at(-1)![0]).toContain(
    "/upload-session/cancel",
  );
});
