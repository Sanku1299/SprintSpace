import { TASK_STATUSES } from "@/lib/tasks/task-constants";

export type BoardTask = { id: string; status: string };
export type BoardTaskStatus = (typeof TASK_STATUSES)[number];

export function hasActiveBoardFilters(search: string, priority: string, assignee: string): boolean {
  return Boolean(search.trim() || priority !== "all" || assignee !== "all");
}

export function moveBoardTask<T extends BoardTask>(
  current: T[],
  taskId: string,
  toStatus: BoardTaskStatus,
  requestedIndex: number,
): { tasks: T[]; taskId: string; fromStatus: BoardTaskStatus; toStatus: BoardTaskStatus } | null {
  const movedTask = current.find((task) => task.id === taskId);
  if (!movedTask || !isBoardTaskStatus(movedTask.status)) return null;

  const fromStatus = movedTask.status;
  const groups = Object.fromEntries(
    TASK_STATUSES.map((status) => [status, current.filter((task) => task.status === status)]),
  ) as Record<BoardTaskStatus, T[]>;
  const sourceTasks = groups[fromStatus];
  const movedIndex = sourceTasks.findIndex((task) => task.id === taskId);
  sourceTasks.splice(movedIndex, 1);

  const destinationTasks = groups[toStatus];
  const destinationIndex = Math.max(0, Math.min(requestedIndex, destinationTasks.length));
  if (fromStatus === toStatus && movedIndex === destinationIndex) return null;

  destinationTasks.splice(destinationIndex, 0, { ...movedTask, status: toStatus });

  return {
    tasks: TASK_STATUSES.flatMap((status) => groups[status]),
    taskId,
    fromStatus,
    toStatus,
  };
}

export function isBoardTaskStatus(value: unknown): value is BoardTaskStatus {
  return typeof value === "string" && (TASK_STATUSES as readonly string[]).includes(value);
}
