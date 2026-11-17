import "server-only";

import mongoose from "mongoose";

import { auth } from "../../../auth";
import { connectToDatabase } from "@/lib/db/mongoose";
import { USER_ROLES, User, type CompanyRole } from "@/models/User";

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  workspaceId: string;
  role: CompanyRole;
};

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId || !mongoose.isValidObjectId(userId)) {
    return null;
  }

  await connectToDatabase();
  const user = await User.findById(userId).select("name email workspaceId role status");

  if (!user || user.status !== "active" || !USER_ROLES.includes(user.role as CompanyRole)) {
    return null;
  }

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    workspaceId: user.workspaceId.toString(),
    role: user.role as CompanyRole,
  };
}
