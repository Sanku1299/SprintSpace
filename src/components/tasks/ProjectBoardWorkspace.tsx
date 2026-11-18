"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import type { ReactNode } from "react";
import { CollisionPriority } from "@dnd-kit/abstract";
import { DragDropProvider, useDroppable, type DragEndEvent } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";

import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/tasks/task-constants";
import { TaskDetailsDrawer } from "@/components/tasks/TaskDetailsDrawer";

type Project = { id: string; name: string; key: string; projectManagerId: string };
type TaskItem = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  dueDate: string | null;
  labels: string[];
  position: number;
};
type Member = { id: string; name: string; avatarUrl: string | null };
type TaskStatus = (typeof TASK_STATUSES)[number];
type CompanyRole = "admin" | "project_manager" | "developer" | "designer";

const STATUS_LABELS: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  done: "Done",
};

const STATUS_ACCENTS: Record<string, string> = {
  todo: "bg-slate-400",
  in_progress: "bg-blue-500",
  in_review: "bg-violet-500",
  done: "bg-emerald-500",
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-blue-50 text-blue-700",
  high: "bg-amber-50 text-amber-700",
  urgent: "bg-rose-50 text-rose-700",
};

function dueDateLabel(value: string | null): string {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
    new Date(value),
  );
}

function isOverdue(task: TaskItem): boolean {
  return Boolean(
    task.dueDate &&
    task.status !== "done" &&
    task.dueDate.slice(0, 10) < new Date().toISOString().slice(0, 10),
  );
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && (TASK_STATUSES as readonly string[]).includes(value);
}

function moveBoardTask(current: TaskItem[], event: DragEndEvent) {
  if (event.canceled || !isSortable(event.operation.source)) return null;

  const { source, target } = event.operation;
  const fromStatus = isTaskStatus(source.initialGroup) ? source.initialGroup : null;
  const emptyColumnStatus =
    typeof target?.id === "string" && target.id.startsWith("column:")
      ? target.id.slice("column:".length)
      : null;
  const toStatus = isTaskStatus(emptyColumnStatus)
    ? emptyColumnStatus
    : isTaskStatus(source.group)
      ? source.group
      : null;

  if (!fromStatus || !toStatus) return null;

  const groups = Object.fromEntries(
    TASK_STATUSES.map((status) => [status, current.filter((task) => task.status === status)]),
  ) as Record<TaskStatus, TaskItem[]>;
  const sourceTasks = groups[fromStatus];
  const movedIndex = sourceTasks.findIndex((task) => task.id === String(source.id));

  if (movedIndex < 0) return null;

  const [movedTask] = sourceTasks.splice(movedIndex, 1);
  const destinationTasks = groups[toStatus];
  const requestedIndex = emptyColumnStatus ? destinationTasks.length : source.index;
  const destinationIndex = Math.max(0, Math.min(requestedIndex, destinationTasks.length));

  if (fromStatus === toStatus && movedIndex === destinationIndex) return null;

  destinationTasks.splice(destinationIndex, 0, { ...movedTask, status: toStatus });

  return {
    tasks: TASK_STATUSES.flatMap((status) => groups[status]),
    taskId: movedTask.id,
    fromStatus,
    toStatus,
  };
}

export function ProjectBoardWorkspace({
  projectId,
  role,
  userId,
}: {
  projectId: string;
  role: CompanyRole;
  userId: string;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingMove, setSavingMove] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadBoard() {
      setLoading(true);
      setError("");
      try {
        const [projectResponse, tasksResponse, membersResponse] = await Promise.all([
          fetch(`/api/projects/${projectId}`, { cache: "no-store" }),
          fetch(`/api/projects/${projectId}/tasks`, { cache: "no-store" }),
          fetch(`/api/projects/${projectId}/members`, { cache: "no-store" }),
        ]);
        const [projectPayload, tasksPayload, membersPayload] = await Promise.all([
          projectResponse.json(),
          tasksResponse.json(),
          membersResponse.json(),
        ]);
        if (!projectResponse.ok)
          throw new Error(projectPayload.error?.message ?? "Could not load this project.");
        if (!tasksResponse.ok)
          throw new Error(tasksPayload.error?.message ?? "Could not load project tasks.");
        if (!membersResponse.ok)
          throw new Error(membersPayload.error?.message ?? "Could not load project members.");

        if (active) {
          setProject(projectPayload.data.project as Project);
          setTasks(tasksPayload.data.tasks as TaskItem[]);
          setMembers(membersPayload.data.members as Member[]);
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load board.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadBoard();
    return () => {
      active = false;
    };
  }, [projectId]);

  const membersById = new Map(members.map((member) => [member.id, member]));
  const canManagePositions = Boolean(
    role === "admin" || (role === "project_manager" && project?.projectManagerId === userId),
  );
  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tasks.filter((task) => {
      if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
      if (assigneeFilter === "unassigned" && task.assigneeId) return false;
      if (
        assigneeFilter !== "all" &&
        assigneeFilter !== "unassigned" &&
        task.assigneeId !== assigneeFilter
      ) {
        return false;
      }
      if (!query) return true;

      return (
        task.title.toLowerCase().includes(query) ||
        task.description.toLowerCase().includes(query) ||
        task.labels.some((label) => label.toLowerCase().includes(query))
      );
    });
  }, [assigneeFilter, priorityFilter, search, tasks]);
  const filtersActive = Boolean(
    search.trim() || priorityFilter !== "all" || assigneeFilter !== "all",
  );

  async function saveMove(event: DragEndEvent) {
    const change = moveBoardTask(tasks, event);
    if (!change) return;

    if (change.fromStatus === change.toStatus && !canManagePositions) {
      setError("Only the project manager or an Admin can reorder tasks within a status.");
      return;
    }

    setError("");
    setNotice("");
    setTasks(change.tasks);
    setSavingMove(true);

    const affectedTasks = canManagePositions
      ? change.tasks.filter(
          (task) => task.status === change.fromStatus || task.status === change.toStatus,
        )
      : change.tasks.filter((task) => task.id === change.taskId);
    const updates = affectedTasks.map((task) => ({
      task,
      body: canManagePositions
        ? {
            status: task.status,
            position: change.tasks
              .filter((item) => item.status === task.status)
              .findIndex((item) => item.id === task.id),
          }
        : { status: task.status },
    }));

    try {
      const responses = await Promise.all(
        updates.map(({ task, body }) =>
          fetch(`/api/tasks/${task.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
        ),
      );
      const payloads = await Promise.all(responses.map((response) => response.json()));
      const failed = responses.findIndex((response) => !response.ok);

      if (failed >= 0) {
        const payload = payloads[failed];
        throw new Error(payload.error?.message ?? "Could not save the task move.");
      }
      setNotice("Task move saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save the task move.");
      try {
        const response = await fetch(`/api/projects/${projectId}/tasks`, { cache: "no-store" });
        const payload = await response.json();
        if (response.ok) setTasks(payload.data.tasks as TaskItem[]);
      } catch {
        // Keep the optimistic board state visible if a refresh also fails.
      }
    } finally {
      setSavingMove(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 sm:py-11">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            href={`/projects/${projectId}`}
            className="text-sm font-medium text-slate-500 transition hover:text-indigo-700"
          >
            ← Back to project
          </Link>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-indigo-700">
            {project?.key ?? "Project"} · Workflow board
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            {project?.name ?? (loading ? "Loading board…" : "Project board")}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Tasks move through To do, In progress, In review, and Done.
          </p>
        </div>
        <Link
          href={`/tasks?projectId=${projectId}`}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:text-indigo-700"
        >
          Open task list
        </Link>
      </div>

      {error ? (
        <p role="alert" className="mt-6 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p
          role="status"
          className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          {notice}
        </p>
      ) : null}
      {savingMove ? (
        <p className="mt-4 text-xs font-medium text-slate-500" role="status">
          Saving task order…
        </p>
      ) : null}

      <section
        aria-label="Board search and filters"
        className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_14rem]">
          <label className="sr-only" htmlFor="board-search">
            Search task titles, descriptions, and labels
          </label>
          <input
            id="board-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tasks or labels"
            className={filterInputClass}
          />
          <label className="sr-only" htmlFor="board-priority-filter">
            Filter tasks by priority
          </label>
          <select
            id="board-priority-filter"
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
            className={filterInputClass}
          >
            <option value="all">All priorities</option>
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority[0].toUpperCase() + priority.slice(1)}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="board-assignee-filter">
            Filter tasks by assignee
          </label>
          <select
            id="board-assignee-filter"
            value={assigneeFilter}
            onChange={(event) => setAssigneeFilter(event.target.value)}
            className={filterInputClass}
          >
            <option value="all">All assignees</option>
            <option value="unassigned">Unassigned</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">
            Showing {filteredTasks.length} of {tasks.length} tasks
            {filtersActive ? " · Clear filters to rearrange cards" : ""}
          </p>
          {filtersActive ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPriorityFilter("all");
                setAssigneeFilter("all");
              }}
              className="text-xs font-semibold text-indigo-700 hover:text-indigo-900"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </section>

      <DragDropProvider
        onBeforeDragStart={(event) => {
          if (savingMove) event.preventDefault();
          if (filtersActive) event.preventDefault();
        }}
        onDragEnd={(event) => void saveMove(event)}
      >
        <div className="mt-8 flex gap-4 overflow-x-auto pb-3">
          {TASK_STATUSES.map((status) => {
            const statusTasks = filteredTasks.filter((task) => task.status === status);

            return (
              <BoardColumn
                key={status}
                status={status}
                count={statusTasks.length}
                loading={loading}
                filtersActive={filtersActive}
              >
                {statusTasks.map((task, index) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    index={index}
                    assignee={membersById.get(task.assigneeId ?? "")}
                    disabled={filtersActive}
                    onOpenTask={setSelectedTaskId}
                  />
                ))}
              </BoardColumn>
            );
          })}
        </div>
      </DragDropProvider>
      {selectedTaskId ? (
        <TaskDetailsDrawer
          taskId={selectedTaskId}
          role={role}
          userId={userId}
          onClose={() => setSelectedTaskId(null)}
          onOpenTask={setSelectedTaskId}
        />
      ) : null}
    </main>
  );
}

function BoardColumn({
  status,
  count,
  loading,
  filtersActive,
  children,
}: {
  status: TaskStatus;
  count: number;
  loading: boolean;
  filtersActive: boolean;
  children: ReactNode;
}) {
  const { isDropTarget, ref } = useDroppable({
    id: `column:${status}`,
    accept: "task",
    collisionPriority: CollisionPriority.Low,
  });

  return (
    <section
      ref={ref}
      aria-labelledby={`board-column-${status}`}
      className={`min-h-80 w-72 shrink-0 rounded-2xl border p-3 transition-colors xl:w-auto xl:flex-1 ${isDropTarget ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-slate-100/70"}`}
    >
      <div className="flex items-center justify-between px-1 pb-3">
        <h2
          id={`board-column-${status}`}
          className="flex items-center gap-2 text-sm font-semibold text-slate-800"
        >
          <span className={`size-2.5 rounded-full ${STATUS_ACCENTS[status]}`} />
          {STATUS_LABELS[status]}
        </h2>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">
          {loading ? "—" : count}
        </span>
      </div>

      <div className="min-h-64 space-y-2">
        {children}
        {!loading && count === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400">
            {filtersActive ? "No matching tasks" : "Drop tasks here"}
          </p>
        ) : null}
        {loading ? <div className="h-20 animate-pulse rounded-xl bg-white/80" /> : null}
      </div>
    </section>
  );
}

function TaskCard({
  task,
  index,
  assignee,
  disabled,
  onOpenTask,
}: {
  task: TaskItem;
  index: number;
  assignee?: Member;
  disabled: boolean;
  onOpenTask: (taskId: string) => void;
}) {
  const { ref, handleRef, isDragging } = useSortable({
    id: task.id,
    index,
    group: task.status,
    type: "task",
    accept: "task",
    disabled,
  });
  const overdue = isOverdue(task);

  return (
    <article
      ref={ref}
      className={`rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-indigo-200 hover:shadow-md ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="flex items-start gap-2">
        <Link
          href={`/tasks/${task.id}`}
          onClick={(event) => openTaskDetails(event, task.id, onOpenTask)}
          className="min-w-0 flex-1"
        >
          <span className="flex items-start justify-between gap-2">
            <span className="text-sm font-semibold leading-5 text-slate-900">{task.title}</span>
            <span
              className={`shrink-0 rounded-md px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide ${PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.medium}`}
            >
              {task.priority}
            </span>
          </span>
        </Link>
        <button
          ref={handleRef}
          type="button"
          aria-label={`Drag ${task.title}`}
          title="Drag to move task"
          className="-mr-1 -mt-1 flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing"
        >
          <span aria-hidden="true">⠿</span>
        </button>
      </div>
      <Link
        href={`/tasks/${task.id}`}
        onClick={(event) => openTaskDetails(event, task.id, onOpenTask)}
        className="block"
      >
        {task.description ? (
          <span className="mt-2 line-clamp-2 block text-xs leading-5 text-slate-500">
            {task.description}
          </span>
        ) : null}
        {task.labels.length ? (
          <span className="mt-3 flex flex-wrap gap-1.5">
            {task.labels.slice(0, 2).map((label) => (
              <span
                key={label}
                className="max-w-full truncate rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600"
              >
                {label}
              </span>
            ))}
            {task.labels.length > 2 ? (
              <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500">
                +{task.labels.length - 2}
              </span>
            ) : null}
          </span>
        ) : null}
        <span className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <span className="flex min-w-0 items-center gap-2">
            {assignee ? (
              <>
                <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-800">
                  {assignee.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={assignee.avatarUrl} alt="" className="size-full object-cover" />
                  ) : (
                    initials(assignee.name)
                  )}
                </span>
                <span className="truncate text-xs font-medium text-slate-600">{assignee.name}</span>
              </>
            ) : (
              <span className="text-xs text-slate-400">Unassigned</span>
            )}
          </span>
          <span
            className={`shrink-0 text-xs ${overdue ? "font-semibold text-rose-700" : "text-slate-500"}`}
          >
            {overdue ? "Overdue · " : ""}
            {dueDateLabel(task.dueDate)}
          </span>
        </span>
      </Link>
    </article>
  );
}

function openTaskDetails(
  event: MouseEvent<HTMLAnchorElement>,
  taskId: string,
  onOpenTask: (taskId: string) => void,
) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }

  event.preventDefault();
  onOpenTask(taskId);
}

const filterInputClass =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
