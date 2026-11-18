import "server-only";

import mongoose, { Schema, type InferSchemaType } from "mongoose";

const ProjectMemberSchema = new Schema(
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
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    addedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

ProjectMemberSchema.index(
  { workspaceId: 1, projectId: 1, userId: 1 },
  { unique: true, name: "unique_project_member_per_workspace" },
);
ProjectMemberSchema.index({ workspaceId: 1, userId: 1, projectId: 1 });

export type ProjectMemberDocument = InferSchemaType<typeof ProjectMemberSchema>;

export const ProjectMember =
  mongoose.models.ProjectMember ||
  mongoose.model<ProjectMemberDocument>("ProjectMember", ProjectMemberSchema);
