"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { TASK_STATUSES } from "@/lib/tasks/task-constants";

type Project = { id: string; name: string; key: string };
type TaskItem = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  dueDate: string | null;
  labels: string[];
};
type Member = { id: string; name: string; avatarUrl: string | null };

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

export function ProjectBoardWorkspace({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

      <div className="mt-8 flex gap-4 overflow-x-auto pb-3">
        {TASK_STATUSES.map((status) => {
          const statusTasks = tasks.filter((task) => task.status === status);

          return (
            <section
              key={status}
              aria-labelledby={`board-column-${status}`}
              className="min-h-80 w-72 shrink-0 rounded-2xl border border-slate-200 bg-slate-100/70 p-3 xl:w-auto xl:flex-1"
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
                  {loading ? "—" : statusTasks.length}
                </span>
              </div>

              <div className="space-y-2">
                {statusTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    assignee={membersById.get(task.assigneeId ?? "")}
                  />
                ))}
                {!loading && statusTasks.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400">
                    No tasks in this status
                  </p>
                ) : null}
                {loading ? <div className="h-20 animate-pulse rounded-xl bg-white/80" /> : null}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}

function TaskCard({ task, assignee }: { task: TaskItem; assignee?: Member }) {
  const overdue = isOverdue(task);

  return (
    <Link
      href={`/tasks/${task.id}`}
      className="block rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      <span className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold leading-5 text-slate-900">{task.title}</span>
        <span
          className={`shrink-0 rounded-md px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide ${PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.medium}`}
        >
          {task.priority}
        </span>
      </span>
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
  );
}
