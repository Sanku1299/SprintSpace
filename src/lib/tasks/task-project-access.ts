import "server-only";

import { canAccessProject } from "@/lib/auth/project-access";
import { hasCompanyRole } from "@/lib/auth/company-role";
import { workspaceScopedFilter } from "@/lib/auth/workspace-scope";
import { Project } from "@/models/Project";
import { ProjectMember } from "@/models/ProjectMember";
import type { WorkspaceContext } from "@/lib/auth/workspace-context";

export async function getAccessibleTaskProject(context: WorkspaceContext, projectId: string) {
  const project = await Project.findOne(workspaceScopedFilter(context, { _id: projectId })).select(
    "_id workspaceId projectManagerId",
  );

  if (!project) {
    return null;
  }

  let isProjectMember = false;

  if (hasCompanyRole(context, "developer", "designer")) {
    const membership = await ProjectMember.findOne(
      workspaceScopedFilter(context, { projectId: project._id, userId: context.userId }),
    )
      .select("_id")
      .lean();
    isProjectMember = Boolean(membership);
  }

  if (!canAccessProject(context, project, isProjectMember)) {
    return null;
  }

  return { project, isProjectMember };
}
