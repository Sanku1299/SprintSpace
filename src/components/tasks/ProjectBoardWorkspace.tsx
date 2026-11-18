"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { TASK_STATUSES } from "@/lib/tasks/task-constants";

type Project = { id: string; name: string; key: string };
type TaskItem = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
};

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

function dueDateLabel(value: string | null): string {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
    new Date(value),
  );
}

export function ProjectBoardWorkspace({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadBoard() {
      setLoading(true);
      setError("");
      try {
        const [projectResponse, tasksResponse] = await Promise.all([
          fetch(`/api/projects/${projectId}`, { cache: "no-store" }),
          fetch(`/api/projects/${projectId}/tasks`, { cache: "no-store" }),
        ]);
        const [projectPayload, tasksPayload] = await Promise.all([
          projectResponse.json(),
          tasksResponse.json(),
        ]);
        if (!projectResponse.ok)
          throw new Error(projectPayload.error?.message ?? "Could not load this project.");
        if (!tasksResponse.ok)
          throw new Error(tasksPayload.error?.message ?? "Could not load project tasks.");

        if (active) {
          setProject(projectPayload.data.project as Project);
          setTasks(tasksPayload.data.tasks as TaskItem[]);
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
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className="block rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <span className="block text-sm font-semibold leading-5 text-slate-900">
                      {task.title}
                    </span>
                    <span className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="capitalize">{task.priority} priority</span>
                      <span>{dueDateLabel(task.dueDate)}</span>
                    </span>
                  </Link>
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
