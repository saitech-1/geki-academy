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
    key = crypto.randomUUID() + crypto.randomUUID();
    localStorage.setItem(name, key);
  }
  return key;
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const user = firebaseAuth().currentUser;
  if (user) headers.set("Authorization", `Bearer ${await user.getIdToken()}`);
  if (!(init.body instanceof FormData) && init.body)
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
export async function uploadVideo<T>(
  path: string,
  file: File,
  onProgress: (value: number) => void,
  duration?: number,
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
        onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      let data;
      try {
        data = JSON.parse(request.responseText);
      } catch {
        reject(new Error("Upload response was unavailable. Please retry."));
        return;
      }
      if (request.status >= 200 && request.status < 300) resolve(data as T);
      else
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
    const body = new FormData();
    body.set("file", file);
    if (duration !== undefined) body.set("duration", String(duration));
    request.send(body);
  });
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
