import "server-only";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { workspaceScopedFilter } from "@/lib/auth/workspace-scope";
import { ProjectMember } from "@/models/ProjectMember";
import { User } from "@/models/User";

export async function validateCommentMentions({
  context,
  projectId,
  mentionIds,
}: {
  context: WorkspaceContext;
  projectId: string;
  mentionIds: string[];
}): Promise<string | null> {
  if (mentionIds.length === 0) return null;

  const activeUsers = await User.find(
    workspaceScopedFilter(context, {
      _id: { $in: mentionIds },
      status: "active",
    }),
  )
    .select("_id")
    .lean();

  if (activeUsers.length !== mentionIds.length) {
    return "Mentions must reference active members in this workspace.";
  }

  const memberships = await ProjectMember.find(
    workspaceScopedFilter(context, { projectId, userId: { $in: mentionIds } }),
  )
    .select("userId")
    .lean();
  const memberIds = new Set(memberships.map((membership) => membership.userId.toString()));

  if (mentionIds.some((mentionId) => !memberIds.has(mentionId))) {
    return "Mentions must reference members of this project.";
  }

  return null;
}
