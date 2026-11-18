import { ProjectBoardWorkspace } from "@/components/tasks/ProjectBoardWorkspace";
import { getAuthenticatedUser } from "@/lib/auth/current-user";

type PageProps = { params: Promise<{ projectId: string }> };

export default async function ProjectBoardPage({ params }: PageProps) {
  const [user, { projectId }] = await Promise.all([getAuthenticatedUser(), params]);

  return (
    <ProjectBoardWorkspace
      projectId={projectId}
      role={user?.role ?? "developer"}
      userId={user?.id ?? ""}
    />
  );
}
