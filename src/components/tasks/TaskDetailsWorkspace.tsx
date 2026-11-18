"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/tasks/task-constants";
import { TaskCollaboration } from "@/components/tasks/TaskCollaboration";
import type { CompanyRole } from "@/models/User";

type TaskItem = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  allowedEditorIds: string[];
  dueDate: string | null;
  labels: string[];
  parentTaskId: string | null;
  createdAt: string;
};
type Member = { id: string; name: string; email: string; role: string; status: string };
type MentionMember = { id: string; name: string; role: string; avatarUrl: string | null };
type Subtask = {
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

function pretty(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateLabel(value: string | null): string {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function TaskDetailsWorkspace({
  taskId,
  role,
  userId,
  presentation = "page",
  onOpenTask,
}: {
  taskId: string;
  role: CompanyRole;
  userId: string;
  presentation?: "page" | "panel";
  onOpenTask?: (taskId: string) => void;
}) {
  const ContentRoot = presentation === "panel" ? "div" : "main";
  const contentClassName =
    presentation === "panel"
      ? "mx-auto w-full max-w-none px-4 py-5 sm:px-6 sm:py-7"
      : "mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-11";
  const [task, setTask] = useState<TaskItem | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [mentionableMembers, setMentionableMembers] = useState<MentionMember[]>([]);
  const [projectManagerId, setProjectManagerId] = useState("");
  const [collaborationRefresh, setCollaborationRefresh] = useState(0);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [assigneeId, setAssigneeId] = useState("");
  const [allowedEditorIds, setAllowedEditorIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [labels, setLabels] = useState("");
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const taskResponse = await fetch(`/api/tasks/${taskId}`, { cache: "no-store" });
        const taskPayload = await taskResponse.json();
        if (!taskResponse.ok) throw new Error(taskPayload.error?.message ?? "Could not load task.");
        const loadedTask = taskPayload.data.task as TaskItem;

        const [memberResponse, subtaskResponse] = await Promise.all([
          fetch(`/api/projects/${loadedTask.projectId}/members`, { cache: "no-store" }),
          fetch(`/api/tasks/${taskId}/subtasks`, { cache: "no-store" }),
        ]);
        const [memberPayload, subtaskPayload] = await Promise.all([
          memberResponse.json(),
          subtaskResponse.json(),
        ]);
        if (!memberResponse.ok)
          throw new Error(memberPayload.error?.message ?? "Could not load project members.");
        if (!subtaskResponse.ok)
          throw new Error(subtaskPayload.error?.message ?? "Could not load subtasks.");

        if (!active) return;
        setTask(loadedTask);
        setTitle(loadedTask.title);
        setDescription(loadedTask.description);
        setStatus(loadedTask.status);
        setPriority(loadedTask.priority);
        setAssigneeId(loadedTask.assigneeId ?? "");
        setAllowedEditorIds(loadedTask.allowedEditorIds);
        setDueDate(loadedTask.dueDate?.slice(0, 10) ?? "");
        setLabels(loadedTask.labels.join(", "));
        setMembers(
          (memberPayload.data.members as Member[]).filter((member) => member.status === "active"),
        );
        setMentionableMembers(memberPayload.data.mentionableMembers as MentionMember[]);
        setProjectManagerId(memberPayload.data.projectManagerId as string);
        setSubtasks(subtaskPayload.data.subtasks as Subtask[]);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load task.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [taskId]);

  const canManage = role === "admin" || role === "project_manager";
  const canEditStatus = Boolean(
    task && (canManage || task.assigneeId === userId || task.allowedEditorIds.includes(userId)),
  );
  const assignee = useMemo(
    () => members.find((member) => member.id === task?.assigneeId),
    [members, task?.assigneeId],
  );

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!task) return;
    setBusy(true);
    setError("");
    setNotice("");

    const body = canManage
      ? {
          title,
          description,
          status,
          priority,
          assigneeId: assigneeId || null,
          allowedEditorIds,
          dueDate: dueDate || null,
          labels: labels
            .split(",")
            .map((label) => label.trim())
            .filter(Boolean),
        }
      : { status };

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) {
        const fields = payload.error?.fields as Record<string, string[]> | undefined;
        throw new Error(
          (fields && Object.values(fields).flat()[0]) ??
            payload.error?.message ??
            "Could not save task.",
        );
      }
      const updated = payload.data.task as TaskItem;
      setTask(updated);
      setTitle(updated.title);
      setDescription(updated.description);
      setStatus(updated.status);
      setPriority(updated.priority);
      setAssigneeId(updated.assigneeId ?? "");
      setAllowedEditorIds(updated.allowedEditorIds);
      setDueDate(updated.dueDate?.slice(0, 10) ?? "");
      setLabels(updated.labels.join(", "));
      setCollaborationRefresh((revision) => revision + 1);
      setNotice("Task saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save task.");
    } finally {
      setBusy(false);
    }
  }

  async function addSubtask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subtaskTitle.trim()) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/tasks/${taskId}/subtasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: subtaskTitle.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Could not add subtask.");
      setSubtasks((current) => [...current, payload.data.subtask as Subtask]);
      setSubtaskTitle("");
      setNotice("Subtask added.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not add subtask.");
    } finally {
      setBusy(false);
    }
  }

  function toggleEditor(memberId: string) {
    setAllowedEditorIds((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId],
    );
  }

  if (loading) {
    return (
      <ContentRoot
        className={
          presentation === "panel"
            ? "mx-auto w-full max-w-none px-4 py-5 sm:px-6 sm:py-7"
            : "mx-auto w-full max-w-5xl px-5 py-10 sm:px-8"
        }
      >
        <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
        <div className="mt-5 h-64 animate-pulse rounded-2xl bg-slate-100" />
      </ContentRoot>
    );
  }

  if (!task) {
    return (
      <ContentRoot
        className={
          presentation === "panel"
            ? "mx-auto w-full max-w-none px-4 py-12 text-center sm:px-6"
            : "mx-auto w-full max-w-3xl px-5 py-16 text-center sm:px-8"
        }
      >
        <h1 className="text-2xl font-semibold text-slate-950">Task unavailable</h1>
        <p className="mt-2 text-sm text-slate-600">
          {error || "This task may not exist or may not be available to your account."}
        </p>
        {presentation === "page" ? (
          <Link
            href="/tasks"
            className="mt-5 inline-flex rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Back to tasks
          </Link>
        ) : null}
      </ContentRoot>
    );
  }

  return (
    <ContentRoot className={contentClassName}>
      {presentation === "page" ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/tasks?projectId=${task.projectId}`}
            className="text-sm font-medium text-slate-500 transition hover:text-indigo-700"
          >
            ← Back to project tasks
          </Link>
          <Link
            href={`/projects/${task.projectId}`}
            className="text-sm font-semibold text-indigo-700 hover:text-indigo-800"
          >
            Open project →
          </Link>
        </div>
      ) : null}

      <div
        className={`${presentation === "page" ? "mt-5" : ""} overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm`}
      >
        <div className="bg-gradient-to-r from-indigo-950 via-indigo-900 to-slate-900 px-5 py-7 text-white sm:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold">
              {STATUS_LABELS[task.status] ?? pretty(task.status)}
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold">
              {pretty(task.priority)} priority
            </span>
            {task.parentTaskId ? (
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold">
                Subtask
              </span>
            ) : null}
          </div>
          <h1 className="mt-4 max-w-3xl text-2xl font-semibold tracking-tight sm:text-3xl">
            {task.title}
          </h1>
          <p className="mt-2 text-sm text-indigo-100/80">Created {dateLabel(task.createdAt)}</p>
        </div>

        <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div>
            {error ? (
              <p
                role="alert"
                className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700"
              >
                {error}
              </p>
            ) : null}
            {notice ? (
              <p
                role="status"
                className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
              >
                {notice}
              </p>
            ) : null}

            <form onSubmit={saveTask} className="space-y-5">
              {canManage ? (
                <Field label="Task title">
                  <input
                    required
                    minLength={2}
                    maxLength={200}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className={inputClass}
                  />
                </Field>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Status">
                  <select
                    disabled={!canEditStatus}
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className={inputClass}
                  >
                    {TASK_STATUSES.map((item) => (
                      <option key={item} value={item}>
                        {STATUS_LABELS[item]}
                      </option>
                    ))}
                  </select>
                </Field>
                {canManage ? (
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
                ) : null}
              </div>
              {canManage ? (
                <>
                  <Field label="Description">
                    <textarea
                      rows={5}
                      maxLength={5000}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      className={`${inputClass} h-auto py-3`}
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
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
                    <Field label="Due date">
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(event) => setDueDate(event.target.value)}
                        className={inputClass}
                      />
                    </Field>
                  </div>
                  <Field label="Labels" hint="Separate labels with commas.">
                    <input
                      value={labels}
                      onChange={(event) => setLabels(event.target.value)}
                      placeholder="design, onboarding"
                      className={inputClass}
                    />
                  </Field>
                  <fieldset className="rounded-xl border border-slate-200 p-4">
                    <legend className="px-1 text-sm font-semibold text-slate-800">
                      Additional task editors
                    </legend>
                    <p className="mb-3 text-xs text-slate-500">
                      Editors can update task status. Select active project members.
                    </p>
                    {members.length ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {members.map((member) => (
                          <label
                            key={member.id}
                            className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              checked={allowedEditorIds.includes(member.id)}
                              onChange={() => toggleEditor(member.id)}
                              className="size-4 rounded border-slate-300 accent-indigo-700"
                            />
                            <span className="min-w-0 truncate">
                              {member.name}
                              <span className="ml-1.5 text-xs text-slate-400">
                                {pretty(member.role)}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No active project members to select.</p>
                    )}
                  </fieldset>
                </>
              ) : (
                <section className="rounded-xl border border-slate-200 p-4">
                  <h2 className="text-sm font-semibold text-slate-800">Description</h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                    {task.description || "No description has been added."}
                  </p>
                </section>
              )}
              {canManage || canEditStatus ? (
                <div className="flex justify-end border-t border-slate-100 pt-4">
                  <button
                    type="submit"
                    disabled={busy}
                    className="h-11 rounded-xl bg-indigo-700 px-5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"
                  >
                    {busy ? "Saving…" : canManage ? "Save task" : "Update status"}
                  </button>
                </div>
              ) : (
                <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  You can view this task but cannot edit it.
                </p>
              )}
            </form>

            <section className="mt-9 border-t border-slate-100 pt-6">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Subtasks</h2>
                  <p className="mt-1 text-sm text-slate-500">Break this task into smaller steps.</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {subtasks.length}
                </span>
              </div>
              {subtasks.length ? (
                <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {subtasks.map((subtask) => (
                    <li key={subtask.id}>
                      <Link
                        href={`/tasks/${subtask.id}`}
                        onClick={(event) => {
                          if (
                            !onOpenTask ||
                            event.button !== 0 ||
                            event.metaKey ||
                            event.ctrlKey ||
                            event.shiftKey ||
                            event.altKey
                          ) {
                            return;
                          }
                          event.preventDefault();
                          onOpenTask(subtask.id);
                        }}
                        className="flex flex-col gap-2 px-4 py-3 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="font-medium text-slate-800">{subtask.title}</span>
                        <span className="flex items-center gap-3 text-xs">
                          <span
                            className={`rounded-full px-2.5 py-1 font-semibold ${statusClass(subtask.status)}`}
                          >
                            {STATUS_LABELS[subtask.status] ?? pretty(subtask.status)}
                          </span>
                          <span className="text-slate-500">{dateLabel(subtask.dueDate)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-7 text-center text-sm text-slate-500">
                  No subtasks yet.
                </p>
              )}
              {canManage ? (
                <form onSubmit={addSubtask} className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <label className="sr-only" htmlFor="subtask-title">
                    New subtask title
                  </label>
                  <input
                    id="subtask-title"
                    required
                    minLength={2}
                    maxLength={200}
                    value={subtaskTitle}
                    onChange={(event) => setSubtaskTitle(event.target.value)}
                    placeholder="Add a subtask"
                    className={inputClass}
                  />
                  <button
                    disabled={busy}
                    type="submit"
                    className="h-11 shrink-0 rounded-lg border border-indigo-200 bg-indigo-50 px-4 text-sm font-semibold text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
                  >
                    Add subtask
                  </button>
                </form>
              ) : null}
            </section>
            <TaskCollaboration
              taskId={taskId}
              userId={userId}
              role={role}
              projectManagerId={projectManagerId}
              members={mentionableMembers}
              refreshKey={collaborationRefresh}
            />
          </div>

          <aside className="space-y-4">
            <section className="rounded-xl border border-slate-200 p-4">
              <h2 className="text-sm font-semibold text-slate-900">Task details</h2>
              <dl className="mt-4 space-y-4">
                <Detail label="Assignee" value={assignee?.name ?? "Unassigned"} />
                <Detail label="Due date" value={dateLabel(task.dueDate)} />
                <Detail
                  label="Project team"
                  value={`${members.length} active ${members.length === 1 ? "member" : "members"}`}
                />
              </dl>
            </section>
            {task.labels.length ? (
              <section className="rounded-xl border border-slate-200 p-4">
                <h2 className="text-sm font-semibold text-slate-900">Labels</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {task.labels.map((label) => (
                    <span
                      key={label}
                      className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </ContentRoot>
  );
}

const inputClass =
  "mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50 disabled:text-slate-500";

function Field({ children, label, hint }: { children: ReactNode; label: string; hint?: string }) {
  return (
    <label className="block text-sm font-medium text-slate-800">
      {label}
      {hint ? <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span> : null}
      {children}
    </label>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-800">{value}</dd>
    </div>
  );
}

function statusClass(status: string): string {
  if (status === "done") return "bg-emerald-50 text-emerald-700";
  if (status === "in_progress") return "bg-blue-50 text-blue-700";
  if (status === "in_review") return "bg-violet-50 text-violet-700";
  return "bg-slate-100 text-slate-700";
}
