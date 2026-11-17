import "server-only";

import mongoose, { Schema, type InferSchemaType } from "mongoose";

export const USER_ROLES = ["admin", "project_manager", "developer", "designer"] as const;
export type CompanyRole = (typeof USER_ROLES)[number];

const UserSchema = new Schema(
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
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    // Hidden by default so ordinary document serialization does not expose password hashes.
    passwordHash: {
      type: String,
      select: false,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      required: true,
    },
    avatarUrl: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      trim: true,
      default: "active",
    },
  },
  {
    timestamps: true,
  },
);

UserSchema.index({ workspaceId: 1, role: 1 });
UserSchema.index({ email: 1 }, { unique: true });

export type UserDocument = InferSchemaType<typeof UserSchema>;

export const User = mongoose.models.User || mongoose.model<UserDocument>("User", UserSchema);
