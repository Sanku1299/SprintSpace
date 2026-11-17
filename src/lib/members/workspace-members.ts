import "server-only";

import { connectToDatabase } from "@/lib/db/mongoose";
import { workspaceScopedFilter } from "@/lib/auth/workspace-scope";
import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { User, type CompanyRole } from "@/models/User";

export type WorkspaceMemberSummary = {
  id: string;
  name: string;
  email: string;
  role: CompanyRole;
  status: string;
  avatarUrl?: string;
  createdAt: string;
};

const MEMBER_FIELDS = "name email role status avatarUrl createdAt";

function toMemberSummary(user: {
  _id: { toString(): string };
  name: string;
  email: string;
  role: string;
  status: string;
  avatarUrl?: string;
  createdAt: Date;
}): WorkspaceMemberSummary {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role as CompanyRole,
    status: user.status,
    ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
    createdAt: user.createdAt.toISOString(),
  };
}

export async function listWorkspaceMembers(
  context: Pick<WorkspaceContext, "workspaceId">,
): Promise<WorkspaceMemberSummary[]> {
  await connectToDatabase();
  const users = await User.find(workspaceScopedFilter(context, {}))
    .select(MEMBER_FIELDS)
    .sort({ name: 1, _id: 1 })
    .lean();

  return users.map(toMemberSummary);
}

export async function getWorkspaceMember(
  context: Pick<WorkspaceContext, "workspaceId">,
  userId: string,
): Promise<WorkspaceMemberSummary | null> {
  await connectToDatabase();
  const user = await User.findOne(workspaceScopedFilter(context, { _id: userId }))
    .select(MEMBER_FIELDS)
    .lean();

  return user ? toMemberSummary(user) : null;
}
