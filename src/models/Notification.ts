import "server-only";

import mongoose, { Schema, type InferSchemaType } from "mongoose";

const NOTIFICATION_TYPES = ["task_assigned", "task_status_changed", "comment_mention"] as const;

const NotificationSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    message: { type: String, required: true, maxlength: 300 },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

NotificationSchema.index(
  { workspaceId: 1, recipientId: 1, readAt: 1, createdAt: -1, _id: -1 },
  { name: "notifications_by_recipient_and_unread" },
);
NotificationSchema.index(
  { workspaceId: 1, recipientId: 1, taskId: 1, type: 1, actorId: 1, createdAt: -1 },
  { name: "notifications_by_task_and_recipient" },
);

export type NotificationDocument = InferSchemaType<typeof NotificationSchema>;

export const Notification =
  mongoose.models.Notification ||
  mongoose.model<NotificationDocument>("Notification", NotificationSchema);
