export const TASK_API_FIELDS =
  "_id workspaceId projectId title description status priority assigneeId allowedEditorIds dueDate labels parentTaskId position createdBy createdAt updatedAt";

export type TaskApiDocument = {
  _id: { toString(): string };
  workspaceId: { toString(): string };
  projectId: { toString(): string };
  title: string;
  description?: string;
  status: string;
  priority: string;
  assigneeId?: { toString(): string } | null;
  allowedEditorIds: Array<{ toString(): string }>;
  dueDate?: Date | null;
  labels: string[];
  parentTaskId?: { toString(): string } | null;
  position: number;
  createdBy: { toString(): string };
  createdAt: Date;
  updatedAt: Date;
};

export function toTaskResponse(task: TaskApiDocument) {
  return {
    id: task._id.toString(),
    workspaceId: task.workspaceId.toString(),
    projectId: task.projectId.toString(),
    title: task.title,
    description: task.description ?? "",
    status: task.status,
    priority: task.priority,
    assigneeId: task.assigneeId?.toString() ?? null,
    allowedEditorIds: task.allowedEditorIds.map((id) => id.toString()),
    dueDate: task.dueDate?.toISOString() ?? null,
    labels: task.labels,
    parentTaskId: task.parentTaskId?.toString() ?? null,
    position: task.position,
    createdBy: task.createdBy.toString(),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}
