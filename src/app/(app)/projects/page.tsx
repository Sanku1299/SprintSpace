import { connection } from "next/server";

import { ProjectsWorkspace } from "@/components/projects/ProjectsWorkspace";
import { getAuthenticatedUser } from "@/lib/auth/current-user";
import { getWorkspaceProjects } from "@/lib/projects/workspace-projects";
import type { ProjectListItem } from "@/lib/projects/project-types";

export default async function ProjectsPage() {
  await connection();
  const user = await getAuthenticatedUser();
  const role = user?.role ?? "developer";
  let initialProjects: ProjectListItem[] = [];
  let initialError = "";

  if (user) {
    try {
      initialProjects = await getWorkspaceProjects({
        userId: user.id,
        workspaceId: user.workspaceId,
        role: user.role,
      });
    } catch {
      initialError = "Project service is temporarily unavailable.";
    }
  }

  return (
    <ProjectsWorkspace
      role={role}
      initialProjects={initialProjects}
      initialError={initialError}
    />
  );
}
