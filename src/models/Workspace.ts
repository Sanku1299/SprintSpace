import "server-only";

import mongoose, { Schema, type InferSchemaType } from "mongoose";

const WorkspaceSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    logo: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    projectSequence: {
      type: Number,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

export type WorkspaceDocument = InferSchemaType<typeof WorkspaceSchema>;

const cachedWorkspaceModel = mongoose.models.Workspace;

if (
  process.env.NODE_ENV === "development" &&
  cachedWorkspaceModel &&
  !cachedWorkspaceModel.schema.path("projectSequence")
) {
  mongoose.deleteModel("Workspace");
}

export const Workspace =
  mongoose.models.Workspace || mongoose.model<WorkspaceDocument>("Workspace", WorkspaceSchema);
