import { hasCompanyRole } from "@/lib/auth/company-role";
import type { WorkspaceContext } from "@/lib/auth/workspace-context";

type PolicyId = string | { toString(): string };

export const TASK_EDITABLE_FIELDS = [
  "title",
  "description",
  "status",
  "priority",
  "assigneeId",
  "allowedEditorIds",
  "dueDate",
  "labels",
  "parentTaskId",
  "position",
] as const;

export const LIMITED_TASK_EDITABLE_FIELDS = ["status"] as const;

export type TaskEditableField = (typeof TASK_EDITABLE_FIELDS)[number];

export type TaskEditPolicyInput = {
  context: WorkspaceContext;
  task: {
    workspaceId: PolicyId;
    projectId: PolicyId;
    assigneeId?: PolicyId | null;
    allowedEditorIds?: readonly PolicyId[];
  };
  project: {
    id: PolicyId;
    workspaceId: PolicyId;
    projectManagerId?: PolicyId | null;
  };
  isProjectMember?: boolean;
};

function sameId(left: PolicyId | null | undefined, right: PolicyId): boolean {
  if (left == null) {
    return false;
  }

  return left.toString().toLowerCase() === right.toString().toLowerCase();
}

/**
 * Returns editable fields for a task loaded with its project inside the
 * authenticated workspace. Membership evidence must be verified in that project.
 */
export function getEditableTaskFields({
  context,
  task,
  project,
  isProjectMember = false,
}: TaskEditPolicyInput): readonly TaskEditableField[] {
  if (
    !sameId(task.workspaceId, context.workspaceId) ||
    !sameId(project.workspaceId, context.workspaceId) ||
    !sameId(task.projectId, project.id)
  ) {
    return [];
  }

  if (hasCompanyRole(context, "admin")) {
    return TASK_EDITABLE_FIELDS;
  }

  if (hasCompanyRole(context, "project_manager")) {
    return sameId(project.projectManagerId, context.userId) ? TASK_EDITABLE_FIELDS : [];
  }

  if (!hasCompanyRole(context, "developer", "designer") || !isProjectMember) {
    return [];
  }

  const isAssignee = sameId(task.assigneeId, context.userId);
  const isAuthorizedEditor = task.allowedEditorIds?.some((editorId) =>
    sameId(editorId, context.userId),
  );

  return isAssignee || isAuthorizedEditor ? LIMITED_TASK_EDITABLE_FIELDS : [];
}

export function canEditTaskField(input: TaskEditPolicyInput, field: TaskEditableField): boolean {
  return getEditableTaskFields(input).includes(field);
}
