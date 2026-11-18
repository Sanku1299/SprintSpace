"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/tasks/task-constants";
import type { CompanyRole } from "@/models/User";

type Project = { id: string; name: string; key: string };
type TaskItem = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  dueDate: string | null;
  labels: string[];
};
type Member = { id: string; name: string; email: string; role: string; status: string };
type View = "all" | "mine";

const STATUS_LABELS: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  done: "Done",
};

function pretty(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isOverdue(task: TaskItem): boolean {
  return Boolean(
    task.dueDate &&
    task.status !== "done" &&
    task.dueDate.slice(0, 10) < new Date().toISOString().slice(0, 10),
  );
}

function dateLabel(value: string | null): string {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function TasksWorkspace({
  role,
  userId,
  initialProjectId,
}: {
  role: CompanyRole;
  userId: string;
  initialProjectId: string;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [view, setView] = useState<View>("all");
  const [projectFilter, setProjectFilter] = useState(initialProjectId);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const canCreate = role === "admin" || role === "project_manager";

  useEffect(() => {
    let active = true;

    async function loadTasks() {
      setLoading(true);
      setError("");
      try {
        const projectsResponse = await fetch("/api/projects", { cache: "no-store" });
        const projectsPayload = await projectsResponse.json();
        if (!projectsResponse.ok)
          throw new Error(projectsPayload.error?.message ?? "Could not load projects.");
        const visibleProjects = projectsPayload.data.projects as Project[];
        const taskLists = await Promise.all(
          visibleProjects.map(async (project) => {
            const response = await fetch(`/api/projects/${project.id}/tasks`, {
              cache: "no-store",
            });
            const payload = await response.json();
            if (!response.ok)
              throw new Error(payload.error?.message ?? `Could not load ${project.name} tasks.`);
            return payload.data.tasks as TaskItem[];
          }),
        );

        if (active) {
          setProjects(visibleProjects);
          setTasks(taskLists.flat());
          if (
            initialProjectId !== "all" &&
            !visibleProjects.some((project) => project.id === initialProjectId)
          ) {
            setProjectFilter("all");
          }
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load tasks.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadTasks();
    return () => {
      active = false;
    };
  }, [initialProjectId]);

  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );
  const visibleTasks = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return tasks
      .filter((task) => projectFilter === "all" || task.projectId === projectFilter)
      .filter((task) => view === "all" || task.assigneeId === userId)
      .filter((task) => statusFilter === "all" || task.status === statusFilter)
      .filter(
        (task) =>
          !normalized ||
          task.title.toLowerCase().includes(normalized) ||
          task.description.toLowerCase().includes(normalized) ||
          task.labels.some((label) => label.toLowerCase().includes(normalized)),
      )
      .sort((left, right) => {
        if (!left.dueDate) return right.dueDate ? 1 : left.title.localeCompare(right.title);
        if (!right.dueDate) return -1;
        return left.dueDate.localeCompare(right.dueDate);
      });
  }, [projectFilter, search, statusFilter, tasks, userId, view]);

  const inProgressCount = tasks.filter((task) => task.status === "in_progress").length;
  const overdueCount = tasks.filter(isOverdue).length;
  const projectCount = projects.length;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-9 sm:px-8 sm:py-12">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-700">
            Work management
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Tasks
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Track work across your projects and keep the next step clear.
          </p>
        </div>
        {canCreate ? (
          <button
            type="button"
            onClick={() => setShowCreate((current) => !current)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-800"
          >
            <span aria-hidden="true" className="text-lg leading-none">
              +
            </span>{" "}
            New task
          </button>
        ) : null}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Visible tasks" value={loading ? "—" : String(tasks.length)} />
        <SummaryCard
          label="In progress"
          value={loading ? "—" : String(inProgressCount)}
          tone="blue"
        />
        <SummaryCard label="Overdue" value={loading ? "—" : String(overdueCount)} tone="rose" />
      </div>

      {showCreate ? (
        <CreateTaskForm
          projects={projects}
          onCancel={() => setShowCreate(false)}
          onCreated={(task) => {
            setTasks((current) => [task, ...current]);
            setProjectFilter(task.projectId);
            setView("all");
            setShowCreate(false);
          }}
        />
      ) : null}

      <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4 sm:px-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-semibold text-slate-950">Task list</h2>
              <p className="mt-1 text-xs text-slate-500">
                {visibleTasks.length} tasks shown across {projectCount} projects
              </p>
            </div>
            <div className="flex rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Task view">
              <button
                type="button"
                role="tab"
                aria-selected={view === "all"}
                onClick={() => setView("all")}
                className={`rounded-md px-3 py-2 text-sm font-semibold transition ${view === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                All tasks
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === "mine"}
                onClick={() => setView("mine")}
                className={`rounded-md px-3 py-2 text-sm font-semibold transition ${view === "mine" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                My tasks
              </button>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_13rem_12rem]">
            <label className="sr-only" htmlFor="task-search">
              Search tasks
            </label>
            <input
              id="task-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tasks or labels"
              className={inputClass}
            />
            <label className="sr-only" htmlFor="task-project-filter">
              Filter by project
            </label>
            <select
              id="task-project-filter"
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
              className={inputClass}
            >
              <option value="all">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.key} · {project.name}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="task-status-filter">
              Filter by status
            </label>
            <select
              id="task-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className={inputClass}
            >
              <option value="all">All statuses</option>
              {TASK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="mx-5 mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            {error}
          </p>
        ) : null}
        {loading ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-20 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : visibleTasks.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-indigo-50 text-lg font-semibold text-indigo-700">
              ✓
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-950">
              {tasks.length === 0
                ? "No tasks yet"
                : view === "mine"
                  ? "Nothing assigned to you"
                  : "No tasks match those filters"}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
              {tasks.length === 0
                ? canCreate
                  ? "Create a task in one of your projects to get started."
                  : "Tasks in your projects will appear here."
                : "Try another project, status, or search term."}
            </p>
            {tasks.length === 0 && canCreate && projectCount > 0 ? (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="mt-5 rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800"
              >
                Create your first task
              </button>
            ) : null}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visibleTasks.map((task) => (
              <li key={task.id}>
                <Link
                  href={`/tasks/${task.id}`}
                  className="group grid gap-3 px-4 py-4 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 sm:grid-cols-[minmax(0,1fr)_9rem_9rem_8rem] sm:items-center sm:gap-4 sm:px-5"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-semibold text-slate-900 group-hover:text-indigo-800">
                        {task.title}
                      </span>
                      {isOverdue(task) ? (
                        <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700">
                          Overdue
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block truncate text-xs text-slate-500">
                      {projectById.get(task.projectId)?.key ?? "Project"} ·{" "}
                      {task.description || "No description"}
                    </span>
                    {task.labels.length ? (
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        {task.labels.slice(0, 3).map((item) => (
                          <span
                            key={item}
                            className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                          >
                            {item}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex items-center gap-2 text-xs sm:block">
                    <span className="text-slate-400 sm:hidden">Status</span>
                    <span
                      className={`rounded-full px-2.5 py-1 font-semibold ${statusClass(task.status)}`}
                    >
                      {STATUS_LABELS[task.status] ?? pretty(task.status)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 text-xs text-slate-500 sm:block">
                    <span className="sm:hidden">Priority</span>
                    <span className="font-medium text-slate-700">{pretty(task.priority)}</span>
                  </span>
                  <span
                    className={`flex items-center gap-2 text-xs sm:block ${isOverdue(task) ? "font-semibold text-rose-700" : "text-slate-500"}`}
                  >
                    <span className="sm:hidden">Due</span>
                    {dateLabel(task.dueDate)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function CreateTaskForm({
  projects,
  onCancel,
  onCreated,
}: {
  projects: Project[];
  onCancel: () => void;
  onCreated: (task: TaskItem) => void;
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [members, setMembers] = useState<Member[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!projectId) return;

    fetch(`/api/projects/${projectId}/members`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok)
          throw new Error(payload.error?.message ?? "Could not load project members.");
        return payload.data.members as Member[];
      })
      .then((items) => {
        if (active) setMembers(items.filter((member) => member.status === "active"));
      })
      .catch((reason: unknown) => {
        if (active)
          setError(reason instanceof Error ? reason.message : "Could not load project members.");
      });

    return () => {
      active = false;
    };
  }, [projectId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          priority,
          ...(dueDate ? { dueDate } : {}),
          ...(assigneeId ? { assigneeId } : {}),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const fields = payload.error?.fields as Record<string, string[]> | undefined;
        throw new Error(
          (fields && Object.values(fields).flat()[0]) ??
            payload.error?.message ??
            "Could not create task.",
        );
      }
      onCreated(payload.data.task as TaskItem);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create task.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-slate-950">Create a task</h2>
          <p className="mt-1 text-sm text-slate-600">Choose a project and set the task basics.</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close task form"
          className="rounded-lg px-2 py-1 text-slate-500 hover:bg-white hover:text-slate-900"
        >
          ✕
        </button>
      </div>
      <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
        {error ? (
          <p
            role="alert"
            className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:col-span-2"
          >
            {error}
          </p>
        ) : null}
        <Field label="Project" required>
          <select
            required
            value={projectId}
            onChange={(event) => {
              setProjectId(event.target.value);
              setAssigneeId("");
            }}
            className={inputClass}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.key} · {project.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Task title" required>
          <input
            required
            minLength={2}
            maxLength={200}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Design the onboarding flow"
            className={inputClass}
          />
        </Field>
        <Field label="Priority">
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            className={inputClass}
          >
            {TASK_PRIORITIES.map((item) => (
              <option key={item} value={item}>
                {pretty(item)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Due date">
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Assignee">
          <select
            value={assigneeId}
            onChange={(event) => setAssigneeId(event.target.value)}
            className={inputClass}
          >
            <option value="">Unassigned</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name} · {pretty(member.role)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Description">
          <textarea
            rows={3}
            maxLength={5000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What needs to be done?"
            className={`${inputClass} h-auto py-3`}
          />
        </Field>
        <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            disabled={busy || !projectId}
            type="submit"
            className="h-10 rounded-lg bg-indigo-700 px-4 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create task"}
          </button>
        </div>
      </form>
    </section>
  );
}

const inputClass =
  "mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

function Field({
  children,
  label,
  required,
}: {
  children: ReactNode;
  label: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-slate-800">
      {label}
      {required ? (
        <span className="ml-1 text-rose-600" aria-hidden="true">
          *
        </span>
      ) : null}
      {children}
    </label>
  );
}

function SummaryCard({
  label,
  value,
  tone = "indigo",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  const colors: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-700",
    blue: "bg-blue-50 text-blue-700",
    rose: "bg-rose-50 text-rose-700",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={`mt-3 inline-flex rounded-lg px-2.5 py-1 text-lg font-semibold ${colors[tone]}`}
      >
        {value}
      </p>
    </div>
  );
}

function statusClass(status: string): string {
  if (status === "done") return "bg-emerald-50 text-emerald-700";
  if (status === "in_progress") return "bg-blue-50 text-blue-700";
  if (status === "in_review") return "bg-violet-50 text-violet-700";
  return "bg-slate-100 text-slate-700";
}
