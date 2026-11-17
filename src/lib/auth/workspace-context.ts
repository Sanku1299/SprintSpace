import "server-only";

import mongoose from "mongoose";

import { auth } from "../../../auth";
import { connectToDatabase } from "@/lib/db/mongoose";
import { USER_ROLES, User, type CompanyRole } from "@/models/User";

export type WorkspaceContext = {
  userId: string;
  workspaceId: string;
  role: CompanyRole;
};

export async function getWorkspaceContext(): Promise<WorkspaceContext | null> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId || !mongoose.isValidObjectId(userId)) {
    return null;
  }

  await connectToDatabase();
  const user = await User.findById(userId).select("workspaceId role status");

  if (!user || user.status !== "active" || !USER_ROLES.includes(user.role as CompanyRole)) {
    return null;
  }

  return {
    userId: user._id.toString(),
    workspaceId: user.workspaceId.toString(),
    role: user.role as CompanyRole,
  };
}
