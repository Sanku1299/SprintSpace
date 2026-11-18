import { TasksWorkspace } from "@/components/tasks/TasksWorkspace";
import { getAuthenticatedUser } from "@/lib/auth/current-user";

type PageProps = { searchParams: Promise<{ projectId?: string }> };

export default async function TasksPage({ searchParams }: PageProps) {
  const [user, query] = await Promise.all([getAuthenticatedUser(), searchParams]);

  return (
    <TasksWorkspace
      role={user?.role ?? "developer"}
      userId={user?.id ?? ""}
      initialProjectId={query.projectId ?? "all"}
    />
  );
}
