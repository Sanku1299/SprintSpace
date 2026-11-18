import "server-only";

import mongoose, { Schema, type InferSchemaType } from "mongoose";

import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_SIZE,
} from "@/lib/storage/attachment-upload";

const AttachmentSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    storageKey: { type: String, required: true, trim: true, maxlength: 1024 },
    originalName: { type: String, required: true, trim: true, maxlength: 255 },
    mimeType: { type: String, required: true, enum: ALLOWED_ATTACHMENT_MIME_TYPES },
    size: { type: Number, required: true, min: 1, max: MAX_ATTACHMENT_SIZE },
    deletionStatus: {
      type: String,
      enum: ["active", "deleting"],
      default: "active",
      required: true,
    },
  },
  { timestamps: true },
);

AttachmentSchema.index(
  { workspaceId: 1, storageKey: 1 },
  { unique: true, name: "unique_attachment_storage_key_per_workspace" },
);
AttachmentSchema.index(
  { workspaceId: 1, taskId: 1, createdAt: -1, _id: -1 },
  { name: "task_attachments_by_creation" },
);

export type AttachmentDocument = InferSchemaType<typeof AttachmentSchema>;

export const Attachment =
  mongoose.models.Attachment || mongoose.model<AttachmentDocument>("Attachment", AttachmentSchema);
