"use client";
import { useEffect, useRef, useState } from "react";
import { useData } from "./providers";
import { api, json } from "@/lib/api";
import { Button, Message } from "./ui";
export function VideoUploadStatus({
  videoId,
  onChange,
  active,
}: {
  videoId: string;
  onChange: () => void;
  active: boolean;
}) {
  const { data, error, reload } = useData<{
    status: string;
    filename?: string;
    size?: number;
    sessionId?: string;
  }>(`/admin/videos/${videoId}/upload-session`);
  const last = useRef("");
  const [busy, setBusy] = useState(false),
    [failure, setFailure] = useState("");
  useEffect(() => {
    if (
      (data && ["CLEANED", "READY"].includes(data.status)) ||
      (data?.status === "NONE" && !active)
    )
      return;
    const refresh = () => {
      if (document.visibilityState === "visible") reload();
    };
    const timer = setInterval(refresh, 8000);
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [data?.status, active, reload]);
  useEffect(() => {
    if (data && data.status !== last.current) {
      if (["PROCESSING", "READY", "CLEANED"].includes(data.status)) onChange();
      last.current = data.status;
    }
  }, [data?.status, onChange]);
  if (!data || ["NONE", "CLEANED"].includes(data.status))
    return error ? <Message error>{error}</Message> : null;
  return (
    <section className="panel stack" aria-label="Direct video upload status">
      <strong>
        {data.status === "READY"
          ? "Protected video ready — subtitle review required"
          : data.status === "PROCESSING"
            ? "File received — protected encoding in progress"
            : data.status === "EXPIRED"
              ? "Upload authorization expired — cancel and retry"
              : data.status === "UPLOADING"
                ? "Awaiting provider confirmation — retry with the same file if interrupted"
                : data.status === "FAILED"
                  ? "Provider processing failed — cancel and retry"
                  : data.status === "CLEANUP"
                    ? "Cancelled — provider cleanup pending"
                    : "Preparing upload authorization"}
      </strong>
      <small>
        {data.filename}{" "}
        {data.size ? `· ${(data.size / 1024 / 1024).toFixed(1)} MB` : ""}
      </small>
      <div className="row wrap">
        <Button secondary onClick={reload}>
          Check upload status
        </Button>
        {data.sessionId &&
          !["READY", "AUTHORIZING", "CLEANUP"].includes(data.status) && (
            <Button
              secondary
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setFailure("");
                try {
                  await api(`/admin/videos/${videoId}/upload-session/cancel`, {
                    method: "POST",
                    body: json({ sessionId: data.sessionId }),
                  });
                  reload();
                  onChange();
                } catch (error) {
                  setFailure(
                    error instanceof Error
                      ? error.message
                      : "Could not cancel the upload.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Cancel upload session
            </Button>
          )}
      </div>
      {(error || failure) && <Message error>{failure || error}</Message>}
    </section>
  );
}
