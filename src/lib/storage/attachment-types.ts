export const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;

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

export type AttachmentMimeType = (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number];
