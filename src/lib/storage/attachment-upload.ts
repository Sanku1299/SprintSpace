import "server-only";

import { z } from "zod";

export const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;
export const UPLOAD_URL_TTL_SECONDS = 5 * 60;
export const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const createPresignedUploadSchema = z
  .object({
    taskId: z.string().regex(/^[a-f\d]{24}$/i),
    fileName: z.string().trim().min(1).max(255),
    contentType: z.enum(ALLOWED_ATTACHMENT_MIME_TYPES),
    size: z.number().int().min(1).max(MAX_ATTACHMENT_SIZE),
  })
  .strict();

export const registerAttachmentSchema = z
  .object({
    taskId: z
      .string()
      .regex(/^[a-f\d]{24}$/i)
      .transform((value) => value.toLowerCase()),
    storageKey: z.string().trim().min(1).max(1024),
    originalName: z.string().trim().min(1).max(255),
    contentType: z.enum(ALLOWED_ATTACHMENT_MIME_TYPES),
    size: z.number().int().min(1).max(MAX_ATTACHMENT_SIZE),
  })
  .strict();

export function normalizeOriginalFileName(fileName: string): string {
  return fileName
    .replace(/[\\/\u0000-\u001f\u007f]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesTaskStorageKey(
  storageKey: string,
  workspaceId: string,
  projectId: string,
  taskId: string,
): boolean {
  const prefix = `${workspaceId.toLowerCase()}/${projectId.toLowerCase()}/tasks/${taskId.toLowerCase()}/`;
  const suffix = storageKey.startsWith(prefix) ? storageKey.slice(prefix.length) : "";
  return /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(suffix);
}
