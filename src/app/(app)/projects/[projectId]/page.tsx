import { ProjectDetailsWorkspace } from "@/components/projects/ProjectDetailsWorkspace";
import { getAuthenticatedUser } from "@/lib/auth/current-user";

type PageProps = { params: Promise<{ projectId: string }> };

export default async function ProjectDetailsPage({ params }: PageProps) {
  const [user, { projectId }] = await Promise.all([getAuthenticatedUser(), params]);

  return (
    <ProjectDetailsWorkspace
      projectId={projectId}
      role={user?.role ?? "developer"}
      userId={user?.id ?? ""}
    />
  );
}
