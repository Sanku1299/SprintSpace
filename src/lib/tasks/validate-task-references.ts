import "server-only";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { workspaceScopedFilter } from "@/lib/auth/workspace-scope";
import { ProjectMember } from "@/models/ProjectMember";
import { Task } from "@/models/Task";
import { User } from "@/models/User";

type TaskReferenceInput = {
  context: WorkspaceContext;
  projectId: string;
  taskId?: string;
  assigneeId?: string | null;
  allowedEditorIds?: string[];
  parentTaskId?: string | null;
};

/** Validates task references as active users or tasks inside the same project. */
export async function validateTaskReferences({
  context,
  projectId,
  taskId,
  assigneeId,
  allowedEditorIds,
  parentTaskId,
}: TaskReferenceInput): Promise<string | null> {
  const editorIds = allowedEditorIds ?? [];
  const userIds = [...new Set([...editorIds, ...(assigneeId ? [assigneeId] : [])])];

  if (userIds.length > 0) {
    const users = await User.find(
      workspaceScopedFilter(context, {
        _id: { $in: userIds },
        role: { $in: ["developer", "designer"] },
        status: "active",
      }),
    )
      .select("_id")
      .lean();

    if (users.length !== userIds.length) {
      return "Assignees and additional editors must be active Developers or Designers in this workspace.";
    }

    const memberships = await ProjectMember.find(
      workspaceScopedFilter(context, { projectId, userId: { $in: userIds } }),
    )
      .select("userId")
      .lean();
    const memberIds = new Set(memberships.map((membership) => membership.userId.toString()));

    if (userIds.some((userId) => !memberIds.has(userId))) {
      return "Assignees and additional editors must be members of this project.";
    }
  }

  if (parentTaskId) {
    if (taskId && parentTaskId === taskId) {
      return "A task cannot be its own parent.";
    }

    const parentTask = await Task.findOne(
      workspaceScopedFilter(context, { _id: parentTaskId, projectId }),
    ).select("_id");

    if (!parentTask) {
      return "Parent task must belong to this project and workspace.";
    }
  }

  return null;
}
