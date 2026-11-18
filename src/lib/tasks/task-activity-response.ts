type IdLike = { toString(): string };

export type TaskActivityApiDocument = {
  _id: IdLike;
  workspaceId: IdLike;
  projectId: IdLike;
  taskId: IdLike;
  actorId: IdLike;
  type: string;
  changes: Array<{ field: string; from: unknown; to: unknown }>;
  createdAt: Date;
};

export type TaskActivityActor = {
  _id: IdLike;
  name: string;
  avatarUrl?: string | null;
};

export function toTaskActivityResponse(
  activity: TaskActivityApiDocument,
  actor?: TaskActivityActor,
) {
  return {
    id: activity._id.toString(),
    workspaceId: activity.workspaceId.toString(),
    projectId: activity.projectId.toString(),
    taskId: activity.taskId.toString(),
    actorId: activity.actorId.toString(),
    actorName: actor?.name ?? "Former member",
    actorAvatarUrl: actor?.avatarUrl ?? null,
    type: activity.type,
    changes: activity.changes,
    createdAt: activity.createdAt.toISOString(),
  };
}
