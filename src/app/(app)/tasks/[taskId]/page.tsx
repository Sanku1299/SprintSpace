import { TaskDetailsWorkspace } from "@/components/tasks/TaskDetailsWorkspace";
import { getAuthenticatedUser } from "@/lib/auth/current-user";

type PageProps = { params: Promise<{ taskId: string }> };

export default async function TaskDetailsPage({ params }: PageProps) {
  const [user, { taskId }] = await Promise.all([getAuthenticatedUser(), params]);

  return (
    <TaskDetailsWorkspace
      taskId={taskId}
      role={user?.role ?? "developer"}
      userId={user?.id ?? ""}
    />
  );
}
