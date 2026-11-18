import "server-only";

import type mongoose from "mongoose";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { TaskActivity } from "@/models/TaskActivity";

export type TaskActivityChangeInput = {
  field: string;
  from: unknown;
  to: unknown;
};

export async function recordTaskActivity({
  context,
  projectId,
  taskId,
  type,
  changes = [],
  session,
}: {
  context: WorkspaceContext;
  projectId: unknown;
  taskId: unknown;
  type:
    | "task_created"
    | "task_updated"
    | "task_status_changed"
    | "task_reordered"
    | "comment_created"
    | "comment_updated"
    | "comment_deleted";
  changes?: TaskActivityChangeInput[];
  session?: mongoose.ClientSession;
}): Promise<void> {
  try {
    await TaskActivity.create(
      [
        {
          workspaceId: context.workspaceId,
          projectId,
          taskId,
          actorId: context.userId,
          type,
          changes: changes.map((change) => ({
            field: change.field,
            from: serializeActivityValue(change.from),
            to: serializeActivityValue(change.to),
          })),
        },
      ],
      session ? { session } : undefined,
    );
  } catch (error) {
    if (session) throw error;
    console.error("Could not record task activity.", error);
  }
}

export function taskActivityChanges(
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
): TaskActivityChangeInput[] {
  return Object.entries(next)
    .map(([field, to]) => ({ field, from: previous[field], to }))
    .filter(
      ({ from, to }) =>
        JSON.stringify(serializeActivityValue(from)) !== JSON.stringify(serializeActivityValue(to)),
    );
}

function serializeActivityValue(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeActivityValue);
  if (typeof value === "object" && value !== null && "toHexString" in value) {
    return String((value as { toHexString(): string }).toHexString()).toLowerCase();
  }
  if (typeof value === "object" && value !== null && "_id" in value) {
    return serializeActivityValue((value as { _id: unknown })._id);
  }
  return value;
}
