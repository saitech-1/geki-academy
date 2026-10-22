"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useData } from "./providers";
import { Button, Toast } from "./ui";

export function ProtectedUpload({
  videoId,
  hasSource,
  assetId,
  onChange,
}: {
  videoId: string;
  hasSource: boolean;
  assetId?: string | null;
  onChange: () => void;
}) {
  const { data, error } = useData<{ configured: boolean; enabled: boolean }>(
    "/admin/streaming",
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState("");
  async function action(suffix: string, method: string) {
    setBusy(true);
    setFailure("");
    setMessage("");
    try {
      const result = await api<{ status?: string; message?: string }>(
        `/admin/videos/${videoId}/protection${suffix}`,
        { method },
      );
      setMessage(
        result.message ||
          (result.status
            ? `Provider status: ${result.status}`
            : "Approved subtitles synced to the protected player."),
      );
      onChange();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Protection request failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel stack" aria-label="Protected streaming">
      <h4>Protected streaming</h4>
      {error || failure ? <Toast>{failure || error}</Toast> : null}
      {!data ? (
        <p>Checking provider configuration…</p>
      ) : !data.configured ? (
        <>
          <p>
            Your private source is saved. Connect a VdoCipher account to encode
            and stream protected lessons.
          </p>
          <a
            href="https://www.vdocipher.com/dashboard/register"
            target="_blank"
            rel="noreferrer"
          >
            Create a VdoCipher account ↗
          </a>
          <small>
            Add VDOCIPHER_API_SECRET to the server’s private environment file,
            then restart the API. Keep this secret out of chat and browser code.
          </small>
        </>
      ) : (
        <>
          <p>
            {data.enabled
              ? "Provider configured. Send the source, check processing, then sync approved subtitles before publishing."
              : "API secret configured. Student streaming remains disabled until MEDIA_MODE=vdocipher is enabled on the server."}
          </p>
          {assetId ? <small>Provider asset: {assetId}</small> : null}
          <Button
            secondary
            disabled={busy || !hasSource || Boolean(assetId)}
            onClick={() => void action("", "POST")}
          >
            Send saved source for protection
          </Button>
          <Button
            secondary
            disabled={busy || !assetId}
            onClick={() => void action("", "GET")}
          >
            Check processing status
          </Button>
          <Button
            secondary
            disabled={busy || !assetId}
            onClick={() => void action("/subtitles", "POST")}
          >
            Sync approved subtitles
          </Button>
          {busy ? (
            <p role="status">
              Working… Video transfer can take several minutes. Keep this window
              open.
            </p>
          ) : null}
        </>
      )}
      {message ? <Toast success>{message}</Toast> : null}
    </section>
  );
}
