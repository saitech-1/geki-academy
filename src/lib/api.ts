"use client";
import { firebaseAuth } from "./firebase";
export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
  ) {
    super(message);
  }
}
export function deviceStorageName() {
  return "geki-device-v1:" + firebaseAuth().currentUser?.uid;
}
export function deviceKey() {
  const name = deviceStorageName();
  let key = localStorage.getItem(name);
  if (!key) {
    key = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    localStorage.setItem(name, key);
  }
  return key;
}
export function deviceLabel() {
  const ua = navigator.userAgent;
  const os = /Android/i.test(ua)
    ? "Android"
    : /iPhone|iPad/i.test(ua)
      ? "iPhone / iPad"
      : /Windows/i.test(ua)
        ? "Windows"
        : /Macintosh/i.test(ua)
          ? "Mac"
          : "Device";
  const browser = /FBAN|FBAV/i.test(ua)
    ? "Facebook"
    : /Edg/i.test(ua)
      ? "Edge"
      : /Firefox/i.test(ua)
        ? "Firefox"
        : /Chrome|CriOS/i.test(ua)
          ? "Chrome"
          : /Safari/i.test(ua)
            ? "Safari"
            : "browser";
  return `${os} · ${browser}`;
}
const registrations = new Map<string, Promise<unknown>>();
export function registerCurrentDevice() {
  const user = firebaseAuth().currentUser;
  if (!user)
    return Promise.reject(
      new ApiError("Sign in to register this browser.", "UNAUTHENTICATED", 401),
    );
  const pending = registrations.get(user.uid);
  if (pending) return pending;
  const operation = (async () => {
    const key = deviceKey();
    const register = () =>
      api("/me/devices", {
        method: "POST",
        body: json({ key: deviceKey(), label: deviceLabel() }),
      });
    try {
      return await register();
    } catch (error) {
      if (
        !(error instanceof ApiError) ||
        error.code !== "DEVICE_REVOKED" ||
        firebaseAuth().currentUser?.uid !== user.uid
      )
        throw error;
      // A removed registration must never be revived. Retry once with a fresh
      // key; the server still enforces the same two-device limit.
      const storageName = deviceStorageName();
      if (localStorage.getItem(storageName) === key)
        localStorage.removeItem(storageName);
      const { clearPushRegistration } = await import("./push-client");
      await clearPushRegistration().catch(() => {});
      if (firebaseAuth().currentUser?.uid !== user.uid) throw error;
      return register();
    }
  })();
  registrations.set(user.uid, operation);
  void operation
    .finally(() => {
      if (registrations.get(user.uid) === operation)
        registrations.delete(user.uid);
    })
    .catch(() => {});
  return operation;
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const user = firebaseAuth().currentUser;
  if (user) headers.set("Authorization", `Bearer ${await user.getIdToken()}`);
  if (
    !(init.body instanceof FormData) &&
    !(init.body instanceof Blob) &&
    init.body
  )
    headers.set("Content-Type", "application/json");
  if (typeof window !== "undefined") headers.set("X-Device-Key", deviceKey());
  const r = await fetch("/api" + path, { ...init, headers, cache: "no-store" });
  const data = await r.json().catch(() => ({
    error: "The server could not be reached.",
    code: "NETWORK_ERROR",
  }));
  if (!r.ok)
    throw new ApiError(
      data.error || "Request failed.",
      data.code || "REQUEST_FAILED",
      r.status,
    );
  return data as T;
}
export const json = (value: unknown) => JSON.stringify(value);
export async function apiBlob(path: string, signal?: AbortSignal) {
  const user = firebaseAuth().currentUser;
  const response = await fetch("/api" + path, {
    headers: user ? { Authorization: `Bearer ${await user.getIdToken()}` } : {},
    cache: "no-store",
    signal,
  });
  if (!response.ok)
    throw new Error("The receipt could not be loaded. Refresh and try again.");
  return response.blob();
}
async function uploadLocalVideo<T>(
  path: string,
  file: File,
  onProgress: (value: number) => void,
  duration?: number,
  signal?: AbortSignal,
): Promise<T> {
  const user = firebaseAuth().currentUser;
  if (!user)
    throw new ApiError("Sign in before uploading.", "UNAUTHENTICATED", 401);
  const token = await user.getIdToken();
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api" + path);
    request.timeout = 30 * 60 * 1000;
    request.setRequestHeader("Authorization", "Bearer " + token);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(
          Math.min(99, Math.round((event.loaded / event.total) * 100)),
        );
    };
    request.onload = () => {
      let data;
      try {
        data = JSON.parse(request.responseText);
      } catch {
        reject(new Error("Upload response was unavailable. Please retry."));
        return;
      }
      signal?.removeEventListener("abort", abort);
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve(data as T);
      } else
        reject(
          new ApiError(
            data.error || "Upload failed.",
            data.code || "UPLOAD_FAILED",
            request.status,
          ),
        );
    };
    request.onerror = () =>
      reject(new Error("Upload interrupted. Check your connection and retry."));
    request.ontimeout = () =>
      reject(new Error("Upload timed out. Try a smaller MP4 or WebM file."));
    const abort = () => request.abort();
    request.onabort = () =>
      reject(new DOMException("Upload cancelled.", "AbortError"));
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      reject(new DOMException("Upload cancelled.", "AbortError"));
      return;
    }
    const body = new FormData();
    body.set("file", file);
    if (duration !== undefined) body.set("duration", String(duration));
    request.send(body);
  });
}
type DirectSession<T> = {
  mode?: "local";
  sessionId?: string;
  status?: string;
  video?: T;
  clientPayload?: Record<string, string>;
};
export async function uploadVideo<T>(
  path: string,
  file: File,
  onProgress: (value: number) => void,
  duration?: number,
  signal?: AbortSignal,
): Promise<T> {
  const sessionPath = path.replace(/\/upload$/, "/upload-session");
  const webm = /\.webm$/i.test(file.name);
  const prefix = new Uint8Array(await file.slice(0, 65536).arrayBuffer());
  const fingerprint = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", prefix)),
    (v) => v.toString(16).padStart(2, "0"),
  ).join("");
  const header = btoa(String.fromCharCode(...prefix.slice(0, 12)));
  let session: DirectSession<T> | undefined;
  try {
    session = await api<DirectSession<T>>(sessionPath, {
      method: "POST",
      signal,
      body: json({
        filename: file.name,
        size: file.size,
        mime: webm ? "video/webm" : "video/mp4",
        duration,
        fingerprint,
        header,
      }),
    });
    if (session.mode === "local")
      return await uploadLocalVideo(path, file, onProgress, duration, signal);
    if (["PROCESSING", "READY"].includes(session.status || "") && session.video)
      return session.video;
    if (!session.clientPayload || !session.sessionId)
      throw Error(
        "This upload session is not ready. Check its status or cancel it before retrying.",
      );
    const { uploadLink, ...fields } = session.clientPayload;
    const destination = new URL(uploadLink!);
    if (
      destination.protocol !== "https:" ||
      !destination.hostname.endsWith(".amazonaws.com") ||
      destination.username ||
      destination.password ||
      destination.port
    )
      throw Error("Unexpected upload destination.");
    await new Promise<void>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open("POST", destination.href);
      request.timeout = 30 * 60000;
      const abort = () => request.abort();
      const finish = (error?: Error) => {
        signal?.removeEventListener("abort", abort);
        error ? reject(error) : resolve();
      };
      request.upload.onprogress = (event) => {
        if (event.lengthComputable)
          onProgress(
            Math.min(99, Math.floor((event.loaded / event.total) * 100)),
          );
      };
      request.onload = () =>
        finish(
          request.status === 201
            ? undefined
            : Error(
                request.status === 403
                  ? "Upload authorization expired. Cancel this session and choose the file again."
                  : "The video provider rejected the file transfer. Retry or check your provider dashboard.",
              ),
        );
      request.onerror = () =>
        finish(
          Error(
            "Upload interrupted. Choose the same file to retry; transfer restarts from the beginning.",
          ),
        );
      request.ontimeout = () =>
        finish(
          Error("Video transfer timed out. Choose the same file to retry."),
        );
      request.onabort = () =>
        finish(new DOMException("Upload cancelled.", "AbortError"));
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) {
        finish(new DOMException("Upload cancelled.", "AbortError"));
        return;
      }
      const form = new FormData();
      for (const [key, value] of Object.entries(fields))
        form.append(key, value);
      form.append("success_action_status", "201");
      form.append("success_action_redirect", "");
      form.append("file", file, "source." + (webm ? "webm" : "mp4"));
      // No GEKI/Firebase authorization headers are sent to the provider.
      request.send(form);
    });
    const result = await api<DirectSession<T>>(sessionPath + "/complete", {
      method: "POST",
      signal,
      body: json({ sessionId: session.sessionId }),
    });
    if (!result.video)
      throw Error(
        "File transferred. Check provider processing status to finish verification.",
      );
    if (["PROCESSING", "READY"].includes(result.status || "")) onProgress(100);
    return result.video;
  } catch (error) {
    if (signal?.aborted && session?.sessionId)
      await api(sessionPath + "/cancel", {
        method: "POST",
        body: json({ sessionId: session.sessionId }),
      }).catch(() => {});
    throw error;
  }
}
export async function videoDuration(file: File): Promise<number> {
  if (file.size > 500 * 1024 * 1024)
    throw new Error("Choose a video smaller than 500 MB.");
  if (!/\.(mp4|webm)$/i.test(file.name))
    throw new Error("Choose an MP4 or WebM video.");
  return new Promise((resolve, reject) => {
    const element = document.createElement("video");
    const url = URL.createObjectURL(file);
    let finished = false;
    const cleanup = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      element.removeAttribute("src");
      element.load();
    };
    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(
        new Error(
          "Video metadata could not be read. Export as H.264 MP4 or WebM.",
        ),
      );
    }, 15000);
    element.preload = "metadata";
    const acceptDuration = () => {
      const duration = element.duration;
      if (finished || !Number.isFinite(duration) || duration <= 0) return false;
      finished = true;
      cleanup();
      resolve(Math.ceil(duration));
      return true;
    };
    element.ondurationchange = acceptDuration;
    element.onloadedmetadata = () => {
      if (!acceptDuration() && !finished)
        element.currentTime = Number.MAX_SAFE_INTEGER;
    };
    element.onerror = () => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(
        new Error(
          "This browser cannot read that video. Use H.264 MP4 or WebM.",
        ),
      );
    };
    element.src = url;
  });
}
