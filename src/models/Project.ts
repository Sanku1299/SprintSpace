import "server-only";

import mongoose, { Schema, type InferSchemaType } from "mongoose";

import { PROJECT_PRIORITIES, PROJECT_STATUSES } from "@/lib/projects/project-constants";

const ProjectSchema = new Schema(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    key: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 2,
      maxlength: 10,
      match: /^[A-Z][A-Z0-9]{1,9}$/,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: "",
    },
    status: {
      type: String,
      enum: PROJECT_STATUSES,
      required: true,
      default: "planning",
    },
    priority: {
      type: String,
      enum: PROJECT_PRIORITIES,
      required: true,
      default: "medium",
    },
    projectManagerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
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

ProjectSchema.index(
  { workspaceId: 1, key: 1 },
  { unique: true, name: "unique_project_key_per_workspace" },
);
ProjectSchema.index({ workspaceId: 1, status: 1 });
ProjectSchema.index({ workspaceId: 1, projectManagerId: 1, status: 1 });

export type ProjectDocument = InferSchemaType<typeof ProjectSchema>;

export const Project =
  mongoose.models.Project || mongoose.model<ProjectDocument>("Project", ProjectSchema);
