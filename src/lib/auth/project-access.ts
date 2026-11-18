import { hasCompanyRole } from "@/lib/auth/company-role";
import type { WorkspaceContext } from "@/lib/auth/workspace-context";

type ProjectResourceId = string | { toString(): string };

export type ProjectAccessResource = {
  workspaceId: ProjectResourceId;
  projectManagerId?: ProjectResourceId | null;
};

function sameId(left: ProjectResourceId | null | undefined, right: ProjectResourceId): boolean {
  if (left == null) {
    return false;
  }

  return left.toString().toLowerCase() === right.toString().toLowerCase();
}

/**
 * Checks a project that has already been loaded within a trusted workspace.
 * `isProjectMember` must come from a membership lookup scoped to that same workspace.
 */
export function canAccessProject(
  context: WorkspaceContext,
  project: ProjectAccessResource,
  isProjectMember = false,
): boolean {
  if (!sameId(project.workspaceId, context.workspaceId)) {
    return false;
  }

  if (hasCompanyRole(context, "admin")) {
    return true;
  }

  if (hasCompanyRole(context, "project_manager")) {
    return sameId(project.projectManagerId, context.userId);
  }

  if (hasCompanyRole(context, "developer", "designer")) {
    return isProjectMember;
  }

  return false;
}
