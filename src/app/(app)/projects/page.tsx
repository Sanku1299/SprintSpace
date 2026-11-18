import { ProjectsWorkspace } from "@/components/projects/ProjectsWorkspace";
import { getAuthenticatedUser } from "@/lib/auth/current-user";

export default async function ProjectsPage() {
  const user = await getAuthenticatedUser();

  return <ProjectsWorkspace role={user?.role ?? "developer"} />;
}
