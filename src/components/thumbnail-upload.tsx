"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { useLocale } from "./locale";
import { Message } from "./ui";

export function ThumbnailUpload({
  courseId,
  initialUrl,
  onBusyChange,
}: {
  courseId: string;
  initialUrl: string;
  onBusyChange: (busy: boolean) => void;
}) {
  const { t } = useLocale();
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uploaded, setUploaded] = useState(false);
  return (
    <div className="thumbnail-upload stack">
      <strong>{t("Course thumbnail")}</strong>
      {url && (
        <img
          className="thumbnail-upload-preview"
          src={url}
          alt={t("Course thumbnail preview")}
        />
      )}
      <label className="thumbnail-upload-picker">
        <span>{t(busy ? "Uploading thumbnail…" : "Upload from device")}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label={t("Upload course thumbnail")}
          disabled={busy}
          onChange={async (event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (!file) return;
            setError("");
            setUploaded(false);
            if (
              !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
              file.size > 2 * 1024 * 1024
            ) {
              setError("Choose a JPG, PNG or WebP image smaller than 2 MB.");
              return;
            }
            setBusy(true);
            onBusyChange(true);
            try {
              const result = await api<{ url: string }>(
                `/admin/courses/${courseId}/thumbnail`,
                {
                  method: "POST",
                  headers: { "Content-Type": file.type },
                  body: file,
                },
              );
              setUrl(result.url);
              setUploaded(true);
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : "Could not upload the thumbnail. Please try again.",
              );
            } finally {
              setBusy(false);
              onBusyChange(false);
            }
          }}
        />
      </label>
      <small>
        {t("JPG, PNG or WebP. Maximum 2 MB. Recommended ratio: 16:9.")}
      </small>
      {uploaded && (
        <p role="status">{t("Image uploaded. Save the course to apply it.")}</p>
      )}
      <details>
        <summary>{t("Or use an image URL")}</summary>
        <label>
          {t("Course thumbnail URL")}
          <input
            name="thumbnail"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setUploaded(false);
            }}
            required
            disabled={busy}
          />
        </label>
      </details>
      {busy && <input type="hidden" name="thumbnail" value={url} />}
      {error && <Message error>{t(error)}</Message>}
    </div>
  );
}
