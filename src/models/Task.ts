import "server-only";

import mongoose, { Schema, type InferSchemaType } from "mongoose";

import {
  TASK_DESCRIPTION_MAX_LENGTH,
  TASK_LABEL_MAX_LENGTH,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TITLE_MAX_LENGTH,
} from "@/lib/tasks/task-constants";

const TaskSchema = new Schema(
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
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: TASK_TITLE_MAX_LENGTH,
    },
    description: {
      type: String,
      trim: true,
      maxlength: TASK_DESCRIPTION_MAX_LENGTH,
      default: "",
    },
    status: {
      type: String,
      enum: TASK_STATUSES,
      required: true,
      default: "todo",
    },
    priority: {
      type: String,
      enum: TASK_PRIORITIES,
      required: true,
      default: "medium",
    },
    assigneeId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    allowedEditorIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    dueDate: {
      type: Date,
    },
    labels: {
      type: [
        {
          type: String,
          trim: true,
          minlength: 1,
          maxlength: TASK_LABEL_MAX_LENGTH,
        },
      ],
      default: [],
    },
    parentTaskId: {
      type: Schema.Types.ObjectId,
      ref: "Task",
    },
    position: {
      type: Number,
      min: 0,
      default: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

TaskSchema.index(
  { workspaceId: 1, projectId: 1, status: 1, position: 1 },
  { name: "tasks_by_project_status_position" },
);
TaskSchema.index({ workspaceId: 1, assigneeId: 1, status: 1 }, { name: "tasks_by_assignee" });
TaskSchema.index({ workspaceId: 1, projectId: 1, parentTaskId: 1 }, { name: "tasks_by_parent" });

export type TaskDocument = InferSchemaType<typeof TaskSchema>;

export const Task = mongoose.models.Task || mongoose.model<TaskDocument>("Task", TaskSchema);
