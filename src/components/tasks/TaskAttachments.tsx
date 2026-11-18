"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ALLOWED_ATTACHMENT_MIME_TYPES, MAX_ATTACHMENT_SIZE } from "@/lib/storage/attachment-types";

type Attachment = {
  id: string;
  uploadedBy: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

type Preview = { url: string; name: string; mimeType: string };

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function readPayload(response: Response) {
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "The attachment request failed.");
  }
  return payload;
}

export function TaskAttachments({
  taskId,
  userId,
  canUpload,
  canManageAll,
}: {
  taskId: string;
  userId: string;
  canUpload: boolean;
  canManageAll: boolean;
}) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const previewDialogRef = useRef<HTMLDialogElement>(null);
  const previewCloseButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = previewDialogRef.current;
    if (!preview || !dialog || dialog.open) return;

    dialog.showModal();
    previewCloseButtonRef.current?.focus();
  }, [preview]);

  const fetchAttachments = useCallback(async () => {
    const response = await fetch(`/api/attachments?taskId=${encodeURIComponent(taskId)}`, {
      cache: "no-store",
    });
    const payload = await readPayload(response);
    return payload.data.attachments as Attachment[];
  }, [taskId]);
  const loadAttachments = useCallback(async () => {
    setAttachments(await fetchAttachments());
  }, [fetchAttachments]);

  useEffect(() => {
    let active = true;
    void fetchAttachments()
      .then((loaded) => {
        if (active) setAttachments(loaded);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load files.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchAttachments]);

  async function uploadFile(file: File) {
    if (
      !ALLOWED_ATTACHMENT_MIME_TYPES.includes(
        file.type as (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number],
      )
    ) {
      setError("Choose a supported file type.");
      return;
    }
    if (file.size < 1 || file.size > MAX_ATTACHMENT_SIZE) {
      setError("Files must be smaller than 25 MB and cannot be empty.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      const presignResponse = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          fileName: file.name,
          contentType: file.type,
          size: file.size,
        }),
      });
      const presignPayload = await readPayload(presignResponse);
      const upload = presignPayload.data as {
        uploadUrl: string;
        fields: Record<string, string>;
        storageKey: string;
        originalName: string;
        contentType: string;
        size: number;
      };

      const form = new FormData();
      for (const [key, value] of Object.entries(upload.fields)) form.append(key, value);
      form.append("file", file);
      const storageResponse = await fetch(upload.uploadUrl, { method: "POST", body: form });
      if (!storageResponse.ok) throw new Error("The file could not be uploaded. Please retry.");

      const registerResponse = await fetch("/api/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          storageKey: upload.storageKey,
          originalName: upload.originalName,
          contentType: upload.contentType,
          size: upload.size,
        }),
      });
      await readPayload(registerResponse);
      await loadAttachments();
      setNotice("File uploaded.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The file could not be uploaded.");
    } finally {
      setBusy(false);
    }
  }

  async function getSignedUrl(attachmentId: string, inline = false): Promise<string> {
    const query = inline ? "?disposition=inline" : "";
    const response = await fetch(`/api/attachments/${attachmentId}${query}`, { cache: "no-store" });
    const payload = await readPayload(response);
    return payload.data.downloadUrl as string;
  }

  async function previewFile(attachment: Attachment) {
    setBusy(true);
    setError("");
    try {
      const url = await getSignedUrl(attachment.id, true);
      setPreview({ url, name: attachment.originalName, mimeType: attachment.mimeType });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not open this file.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadFile(attachment: Attachment) {
    setBusy(true);
    setError("");
    try {
      const url = await getSignedUrl(attachment.id);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.originalName;
      link.rel = "noreferrer";
      document.body.append(link);
      link.click();
      link.remove();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not download this file.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteFile(attachment: Attachment) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/attachments/${attachment.id}`, { method: "DELETE" });
      await readPayload(response);
      setAttachments((current) => current.filter((item) => item.id !== attachment.id));
      if (preview?.name === attachment.originalName) setPreview(null);
      setNotice("File deleted.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete this file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-9 border-t border-slate-100 pt-6" aria-labelledby="task-files-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="task-files-title" className="text-lg font-semibold text-slate-950">
            Files
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Attachments for this task. Maximum file size is 25 MB.
          </p>
        </div>
        {canUpload ? (
          <label className="inline-flex cursor-pointer items-center rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-800 has-[:disabled]:cursor-wait has-[:disabled]:opacity-60">
            {busy ? "Working…" : "Add file"}
            <input
              type="file"
              accept={ALLOWED_ATTACHMENT_MIME_TYPES.join(",")}
              disabled={busy}
              className="sr-only"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (file) void uploadFile(file);
              }}
            />
          </label>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p
          role="status"
          className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          {notice}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-5 text-sm text-slate-500">Loading files…</p>
      ) : attachments.length ? (
        <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {attachments.map((attachment) => {
            const canDelete = canManageAll || attachment.uploadedBy === userId;
            const canPreview =
              attachment.mimeType.startsWith("image/") || attachment.mimeType === "application/pdf";
            return (
              <li
                key={attachment.id}
                className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {attachment.originalName}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatBytes(attachment.size)} · {formatDate(attachment.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {canPreview ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void previewFile(attachment)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Preview
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void downloadFile(attachment)}
                    className="rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-semibold text-indigo-800 hover:bg-indigo-50 disabled:opacity-50"
                  >
                    Download
                  </button>
                  {canDelete ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void deleteFile(attachment)}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-7 text-center text-sm text-slate-500">
          No files attached yet.
        </p>
      )}

      {preview ? (
        <dialog
          ref={previewDialogRef}
          aria-labelledby="attachment-preview-title"
          onClose={() => setPreview(null)}
          onClick={(event) => {
            if (event.target === event.currentTarget) previewDialogRef.current?.close();
          }}
          className="fixed inset-0 m-auto flex max-h-[92vh] w-[calc(100%-2rem)] max-w-5xl flex-col overflow-hidden rounded-2xl bg-white p-0 shadow-2xl backdrop:bg-slate-950/70"
        >
          <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3">
            <h3
              id="attachment-preview-title"
              className="min-w-0 truncate text-sm font-semibold text-slate-900"
            >
              {preview.name}
            </h3>
            <button
              ref={previewCloseButtonRef}
              type="button"
              onClick={() => previewDialogRef.current?.close()}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Close
            </button>
          </header>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-slate-100 p-3 sm:p-6">
            {preview.mimeType.startsWith("image/") ? (
              // The signed URL returns the original, validated MIME type.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview.url}
                alt={preview.name}
                className="max-h-[76vh] max-w-full object-contain"
              />
            ) : (
              <iframe
                src={preview.url}
                title={`Preview ${preview.name}`}
                className="h-[76vh] w-full rounded-lg bg-white"
              />
            )}
          </div>
        </dialog>
      ) : null}
    </section>
  );
}
