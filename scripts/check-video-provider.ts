import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { credentialExpiry } from "../src/server/video-upload-sessions.js";
import {
  createProtectedUpload,
  protectedStatus,
  providerRequest,
  safeUploadUrl,
} from "../src/server/protected-video.js";
if (!process.argv.includes("--upload-test"))
  throw Error(
    "Pass --upload-test to create, upload and remove one short verification video. No existing videos are changed.",
  );
let assetId = "";
let browser;
try {
  const upload = await createProtectedUpload(
    "GEKI upload verification - not teaching - " + randomUUID(),
  );
  assetId = upload.videoId;
  safeUploadUrl(upload.clientPayload.uploadLink);
  credentialExpiry(upload.clientPayload);
  const bytes = await readFile("tests/fixtures/verification.webm");
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:3000/signin");
  const status = await page.evaluate(
    async ({ payload, bytes }) => {
      const { uploadLink, ...fields } = payload;
      const form = new FormData();
      for (const [key, value] of Object.entries(fields))
        form.append(key, value);
      form.append("success_action_status", "201");
      form.append("success_action_redirect", "");
      form.append(
        "file",
        new Blob([new Uint8Array(bytes)], { type: "video/webm" }),
        "verification.webm",
      );
      const result = await fetch(uploadLink, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(30000),
      });
      return result.status;
    },
    { payload: upload.clientPayload, bytes: [...bytes] },
  );
  if (status !== 201) throw Error("Provider rejected verification transfer");
  console.log(
    "Real browser-to-provider file transfer: HTTP 201 (video bytes bypassed GEKI/Vercel).",
  );
  for (let i = 0; i < 8; i++) {
    const state = await protectedStatus(assetId);
    if (state.status.toLowerCase() === "ready") {
      console.log(
        "Real provider encoding verified ready; duration: " +
          state.length +
          " seconds.",
      );
      break;
    }
    if (i === 7)
      console.log(
        "Provider accepted the file; encoding is still pending. DRM playback not verified by this check.",
      );
    else await new Promise((resolve) => setTimeout(resolve, 3000));
  }
} catch (error) {
  // Do not print provider response bodies or upload credentials.
  console.error(
    error && typeof error === "object" && "code" in error
      ? "Provider verification: " + String(error.code)
      : "Provider verification could not complete.",
  );
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (assetId) {
    try {
      await (
        await providerRequest(`?videos=${encodeURIComponent(assetId)}`, {
          method: "DELETE",
        })
      ).body?.cancel();
      console.log("Verification-only provider asset removed.");
    } catch {
      console.error(
        "Verification-only asset cleanup needs review in the provider dashboard; title starts GEKI upload verification - not teaching.",
      );
      process.exitCode = 1;
    }
  }
}
