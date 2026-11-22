import "server-only";

import { canAccessProject } from "@/lib/auth/project-access";
import { hasCompanyRole } from "@/lib/auth/company-role";
import { workspaceScopedFilter } from "@/lib/auth/workspace-scope";
import { connectToDatabase } from "@/lib/db/mongoose";
import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import type { ProjectListItem } from "@/lib/projects/project-types";
import { Project } from "@/models/Project";
import { ProjectMember } from "@/models/ProjectMember";

const PROJECT_FIELDS =
  "_id workspaceId name key description status priority projectManagerId startDate endDate createdAt updatedAt";

function toProjectListItem(project: {
  _id: { toString(): string };
  workspaceId: { toString(): string };
  name: string;
  key: string;
  description?: string;
  status: string;
  priority: string;
  projectManagerId: { toString(): string };
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}): ProjectListItem {
  return {
    id: project._id.toString(),
    workspaceId: project.workspaceId.toString(),
    name: project.name,
    key: project.key,
    description: project.description ?? "",
    status: project.status,
    priority: project.priority,
    projectManagerId: project.projectManagerId.toString(),
    startDate: project.startDate?.toISOString() ?? null,
    endDate: project.endDate?.toISOString() ?? null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

export async function getWorkspaceProjects(context: WorkspaceContext): Promise<ProjectListItem[]> {
  await connectToDatabase();

  let isProjectMember = false;
  const projectQuery = Project.find(workspaceScopedFilter(context, {}));

  if (hasCompanyRole(context, "project_manager")) {
    projectQuery.where("projectManagerId").equals(context.userId);
  } else if (hasCompanyRole(context, "developer", "designer")) {
    const memberships = await ProjectMember.find(
      workspaceScopedFilter(context, { userId: context.userId }),
    )
      .select("projectId")
      .lean();
    const memberProjectIds = memberships.map((membership) => membership.projectId);

    if (memberProjectIds.length === 0) {
      return [];
    }

    isProjectMember = true;
    projectQuery.where("_id").in(memberProjectIds);
  } else if (!hasCompanyRole(context, "admin")) {
    throw new Error("Project access is not allowed.");
  }

  const projects = await projectQuery.select(PROJECT_FIELDS).sort({ name: 1, key: 1 }).lean();
  const accessibleProjects = projects.filter((project) =>
    canAccessProject(context, project, isProjectMember),
  );

  return accessibleProjects.map(toProjectListItem);
}
