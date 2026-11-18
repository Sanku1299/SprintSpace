import "server-only";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { workspaceScopedFilter } from "@/lib/auth/workspace-scope";
import { Notification } from "@/models/Notification";
import { ProjectMember } from "@/models/ProjectMember";
import { User } from "@/models/User";

type IdLike = { toString(): string };

type NotificationInput = {
  context: WorkspaceContext;
  recipientId: string;
  projectId: IdLike;
  taskId: IdLike;
  type: "task_assigned" | "task_status_changed" | "comment_mention";
  message: string;
};

export async function createTaskNotification(input: NotificationInput): Promise<void> {
  if (input.recipientId === input.context.userId) return;

  const activeRecipient = await User.exists(
    workspaceScopedFilter(input.context, { _id: input.recipientId, status: "active" }),
  );
  if (!activeRecipient) return;

  await Notification.create({
    workspaceId: input.context.workspaceId,
    recipientId: input.recipientId,
    actorId: input.context.userId,
    projectId: input.projectId,
    taskId: input.taskId,
    type: input.type,
    message: input.message.slice(0, 300),
  });
}

export async function createTaskStatusNotifications({
  context,
  projectId,
  taskId,
  taskTitle,
  previousStatus,
  nextStatus,
  assigneeId,
}: {
  context: WorkspaceContext;
  projectId: IdLike;
  taskId: IdLike;
  taskTitle: string;
  previousStatus: string;
  nextStatus: string;
  assigneeId?: IdLike | null;
}): Promise<void> {
  const memberIds = await ProjectMember.find(workspaceScopedFilter(context, { projectId }))
    .distinct("userId")
    .exec();
  const recipients = new Set<string>(memberIds.map((id: IdLike) => id.toString()));
  if (assigneeId) recipients.add(assigneeId.toString());

  await Promise.all(
    [...recipients].map((recipientId) =>
      createTaskNotification({
        context,
        recipientId,
        projectId,
        taskId,
        type: "task_status_changed",
        message: `${context.userId} changed “${taskTitle}” from ${previousStatus} to ${nextStatus}.`,
      }),
    ),
  );
}
