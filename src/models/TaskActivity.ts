import "server-only";

import mongoose, { Schema, type InferSchemaType } from "mongoose";

const TASK_ACTIVITY_TYPES = [
  "task_created",
  "task_updated",
  "task_status_changed",
  "task_reordered",
  "comment_created",
  "comment_updated",
  "comment_deleted",
] as const;

const TaskActivityChangeSchema = new Schema(
  {
    field: { type: String, required: true },
    from: { type: Schema.Types.Mixed, default: null },
    to: { type: Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const TaskActivitySchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: TASK_ACTIVITY_TYPES, required: true },
    changes: { type: [TaskActivityChangeSchema], default: [] },
  },
  { timestamps: true },
);

TaskActivitySchema.index(
  { workspaceId: 1, taskId: 1, createdAt: -1, _id: -1 },
  { name: "task_activity_by_task_chronological" },
);

export type TaskActivityDocument = InferSchemaType<typeof TaskActivitySchema>;

export const TaskActivity =
  mongoose.models.TaskActivity ||
  mongoose.model<TaskActivityDocument>("TaskActivity", TaskActivitySchema);
