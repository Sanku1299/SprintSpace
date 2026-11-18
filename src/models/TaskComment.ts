import "server-only";

import mongoose, { Schema, type InferSchemaType } from "mongoose";
import { TASK_COMMENT_MAX_LENGTH } from "@/lib/tasks/task-constants";

const TaskCommentSchema = new Schema(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    taskId: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: TASK_COMMENT_MAX_LENGTH,
    },
  },
  { timestamps: true },
);

TaskCommentSchema.index(
  { workspaceId: 1, taskId: 1, createdAt: 1, _id: 1 },
  { name: "task_comments_in_chronological_order" },
);

export type TaskCommentDocument = InferSchemaType<typeof TaskCommentSchema>;

export const TaskComment =
  mongoose.models.TaskComment ||
  mongoose.model<TaskCommentDocument>("TaskComment", TaskCommentSchema);
