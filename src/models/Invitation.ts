import "server-only";

import mongoose, { Schema, type InferSchemaType } from "mongoose";

import { USER_ROLES } from "./User";

const INVITATION_STATUSES = ["pending", "accepted", "expired", "revoked"] as const;

const InvitationSchema = new Schema(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      required: true,
    },
    projectIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Project",
      },
    ],
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    status: {
      type: String,
      enum: INVITATION_STATUSES,
      required: true,
      default: "pending",
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    acceptedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

InvitationSchema.index({ workspaceId: 1, status: 1 });
InvitationSchema.index({ expiresAt: 1, status: 1 });
InvitationSchema.index(
  { workspaceId: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
    name: "unique_pending_invitation_per_workspace_email",
  },
);

export type InvitationDocument = InferSchemaType<typeof InvitationSchema>;

export const Invitation =
  mongoose.models.Invitation || mongoose.model<InvitationDocument>("Invitation", InvitationSchema);
