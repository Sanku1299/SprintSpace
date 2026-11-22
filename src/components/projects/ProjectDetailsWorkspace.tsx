"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import { PROJECT_PRIORITIES, PROJECT_STATUSES } from "@/lib/projects/project-constants";
import type { CompanyRole } from "@/models/User";

type Project = {
  id: string;
  name: string;
  key: string;
  description: string;
  status: string;
  priority: string;
  projectManagerId: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
};

type Member = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  avatarUrl: string | null;
  addedAt?: string;
};

type Manager = { id: string; name: string; email: string };
type Tab = "overview" | "members" | "settings";

const STATUS_LABELS: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  archived: "Archived",
};

function label(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateLabel(value: string | null): string {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function ProjectDetailsWorkspace({
  projectId,
  role,
  userId,
}: {
  projectId: string;
  role: CompanyRole;
  userId: string;
}) {
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [availableMembers, setAvailableMembers] = useState<Member[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [selectedMember, setSelectedMember] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("planning");
  const [priority, setPriority] = useState("medium");
  const [projectManagerId, setProjectManagerId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const canManage =
    role === "admin" || (role === "project_manager" && project?.projectManagerId === userId);
  const statusClasses =
    project?.status === "active"
      ? "bg-emerald-50 text-emerald-700"
      : project?.status === "completed"
        ? "bg-blue-50 text-blue-700"
        : project?.status === "on_hold"
          ? "bg-amber-50 text-amber-700"
          : "bg-indigo-50 text-indigo-700";

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const managersRequest =
          role === "admin"
            ? fetch("/api/members", { cache: "no-store" }).catch(() => null)
            : null;
        const [projectResponse, memberResponse] = await Promise.all([
          fetch(`/api/projects/${projectId}`, { cache: "no-store" }),
          fetch(
            `/api/projects/${projectId}/members${role === "admin" || role === "project_manager" ? "?available=true" : ""}`,
            { cache: "no-store" },
          ),
        ]);
        const [projectPayload, memberPayload] = await Promise.all([
          projectResponse.json(),
          memberResponse.json(),
        ]);
        if (!projectResponse.ok)
          throw new Error(projectPayload.error?.message ?? "Could not load project.");
        if (!memberResponse.ok)
          throw new Error(memberPayload.error?.message ?? "Could not load project members.");

        const loadedProject = projectPayload.data.project as Project;
        if (!active) return;
        setProject(loadedProject);
        setName(loadedProject.name);
        setKey(loadedProject.key);
        setDescription(loadedProject.description);
        setStatus(loadedProject.status);
        setPriority(loadedProject.priority);
        setProjectManagerId(loadedProject.projectManagerId);
        setStartDate(loadedProject.startDate?.slice(0, 10) ?? "");
        setEndDate(loadedProject.endDate?.slice(0, 10) ?? "");
        setMembers(memberPayload.data.members as Member[]);
        setAvailableMembers((memberPayload.data.availableMembers ?? []) as Member[]);
        setLoading(false);

        if (managersRequest) {
          const managersResponse = await managersRequest;
          if (managersResponse?.ok) {
            const managersPayload = await managersResponse.json();
            if (!active) return;
            setManagers(
              (managersPayload.data.members as Manager[]).filter(
                (member) =>
                  (member as Manager & { role?: string; status?: string }).role ===
                    "project_manager" &&
                  (member as Manager & { status?: string }).status === "active",
              ),
            );
          }
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load project.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [projectId, role]);

  const projectManagerName = useMemo(() => {
    if (project?.projectManagerId === userId && role === "project_manager") return "You";
    return (
      managers.find((manager) => manager.id === project?.projectManagerId)?.name ??
      "Project manager"
    );
  }, [managers, project?.projectManagerId, role, userId]);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const body: Record<string, string | null> = {
        name,
        key,
        description,
        status,
        priority,
        startDate: startDate || null,
        endDate: endDate || null,
      };
      if (role === "admin") body.projectManagerId = projectManagerId;

      const response = await fetch(`/api/projects/${projectId}`, {
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
            "Could not save settings.",
        );
      }
      const updated = payload.data.project as Project;
      setProject(updated);
      setNotice("Project settings saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save settings.");
    } finally {
      setBusy(false);
    }
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMember) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedMember }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Could not add this member.");
      setMembers((current) => [...current, payload.data.member as Member]);
      setAvailableMembers((current) => current.filter((member) => member.id !== selectedMember));
      setSelectedMember("");
      setNotice("Member added to the project.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not add this member.");
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(member: Member) {
    if (!window.confirm(`Remove ${member.name} from ${project?.name}?`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/projects/${projectId}/members/${member.id}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "Could not remove this member.");
      setMembers((current) => current.filter((item) => item.id !== member.id));
      setAvailableMembers((current) =>
        [...current, member].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setNotice(`${member.name} was removed from the project.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not remove this member.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
        <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
        <div className="mt-5 h-48 animate-pulse rounded-2xl bg-slate-100" />
      </main>
    );
  }

  if (!project) {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-16 text-center sm:px-8">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-xl text-slate-500">
          ?
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-slate-950">Project unavailable</h1>
        <p className="mt-2 text-sm text-slate-600">
          {error || "This project may not exist or may not be available to your account."}
        </p>
        <Link
          href="/projects"
          className="mt-5 inline-flex rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white"
        >
          Back to projects
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-11">
      <Link
        href="/projects"
        className="text-sm font-medium text-slate-500 transition hover:text-indigo-700"
      >
        ← All projects
      </Link>
      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-indigo-950 via-indigo-900 to-slate-900 px-5 py-7 text-white sm:px-8 sm:py-9">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-sm font-bold tracking-wider">
                {project.key}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">
                  Project overview
                </p>
                <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight sm:text-3xl">
                  {project.name}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-indigo-100/80">
                  {project.description || "Add a short description in project settings."}
                </p>
              </div>
            </div>
            <span className="inline-flex w-fit rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold">
              {STATUS_LABELS[project.status] ?? label(project.status)}
            </span>
          </div>
        </div>
        <nav
          aria-label="Project sections"
          className="flex gap-1 overflow-x-auto border-b border-slate-200 px-4 sm:px-7"
        >
          {(["overview", "members", "settings"] as Tab[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`-mb-px shrink-0 border-b-2 px-4 py-3.5 text-sm font-semibold capitalize transition ${tab === item ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
            >
              {item}
              {item === "members" ? (
                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {members.length}
                </span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="p-5 sm:p-8">
          {error ? (
            <p role="alert" className="mb-5 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p
              role="status"
              className="mb-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
            >
              {notice}
            </p>
          ) : null}

          {tab === "overview" ? (
            <div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <InfoCard label="Status">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses}`}
                  >
                    {STATUS_LABELS[project.status] ?? label(project.status)}
                  </span>
                </InfoCard>
                <InfoCard label="Priority">
                  <span className="font-semibold text-slate-900">{label(project.priority)}</span>
                </InfoCard>
                <InfoCard label="Project manager">
                  <span className="font-semibold text-slate-900">{projectManagerName}</span>
                </InfoCard>
                <InfoCard label="Project team">
                  <span className="font-semibold text-slate-900">
                    {members.length} {members.length === 1 ? "member" : "members"}
                  </span>
                </InfoCard>
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                <section className="rounded-xl border border-slate-200 p-5">
                  <h2 className="font-semibold text-slate-900">About this project</h2>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                    {project.description || "No description has been added yet."}
                  </p>
                </section>
                <section className="rounded-xl border border-slate-200 p-5">
                  <h2 className="font-semibold text-slate-900">Timeline</h2>
                  <dl className="mt-4 space-y-4">
                    <TimelineItem label="Start date" value={dateLabel(project.startDate)} />
                    <TimelineItem label="Target end" value={dateLabel(project.endDate)} />
                    <TimelineItem label="Created" value={dateLabel(project.createdAt)} />
                  </dl>
                </section>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={`/projects/${project.id}/board`}
                  className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-800 transition hover:bg-indigo-100"
                >
                  Open workflow board
                </Link>
                <Link
                  href={`/tasks?projectId=${project.id}`}
                  className="rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-800"
                >
                  View project tasks
                </Link>
                <button
                  type="button"
                  onClick={() => setTab("members")}
                  className="rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-800"
                >
                  View project team
                </button>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => setTab("settings")}
                    className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Edit project settings
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {tab === "members" ? (
            <section>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Project members</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Members can access this project and its tasks.
                  </p>
                </div>
                {canManage ? (
                  <form onSubmit={addMember} className="flex flex-col gap-2 sm:flex-row">
                    <label className="sr-only" htmlFor="add-project-member">
                      Add a workspace member
                    </label>
                    <select
                      id="add-project-member"
                      value={selectedMember}
                      onChange={(event) => setSelectedMember(event.target.value)}
                      className={inputClass}
                    >
                      <option value="">Choose a team member</option>
                      {availableMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name} · {label(member.role)}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={!selectedMember || busy}
                      type="submit"
                      className="h-11 shrink-0 rounded-lg bg-indigo-700 px-4 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Add member
                    </button>
                  </form>
                ) : null}
              </div>
              {members.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-slate-300 px-5 py-12 text-center">
                  <h3 className="font-semibold text-slate-900">No project members yet</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {canManage
                      ? "Add Developers or Designers from your workspace to get started."
                      : "The project team will appear here when members are added."}
                  </p>
                </div>
              ) : (
                <ul className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {members.map((member) => (
                    <li
                      key={member.id}
                      className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-800">
                          {initials(member.name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-900">
                            {member.name}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                            {member.email} · {label(member.role)}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 pl-[3.25rem] sm:pl-0">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${member.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                        >
                          {label(member.status)}
                        </span>
                        {canManage ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void removeMember(member)}
                            className="text-sm font-semibold text-rose-700 hover:text-rose-800 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          {tab === "settings" ? (
            canManage ? (
              <form onSubmit={saveSettings} className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Project settings</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Update the project details and ownership.
                  </p>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Project name" required>
                    <input
                      required
                      minLength={2}
                      maxLength={100}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Project number" required>
                    <input
                      required
                      minLength={1}
                      maxLength={20}
                      pattern="([A-Za-z][A-Za-z0-9]{1,9}|[0-9]{1,20})"
                      value={key}
                      onChange={(event) => setKey(event.target.value.toUpperCase())}
                      className={inputClass}
                    />
                  </Field>
                  {role === "admin" ? (
                    <Field label="Responsible project manager" required>
                      <select
                        required
                        value={projectManagerId}
                        onChange={(event) => setProjectManagerId(event.target.value)}
                        className={inputClass}
                      >
                        {managers.map((manager) => (
                          <option key={manager.id} value={manager.id}>
                            {manager.name} · {manager.email}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ) : (
                    <Field label="Responsible project manager">
                      <div className={`${inputClass} flex items-center bg-slate-50 text-slate-600`}>
                        You
                      </div>
                    </Field>
                  )}
                  <Field label="Status">
                    <select
                      value={status}
                      onChange={(event) => setStatus(event.target.value)}
                      className={inputClass}
                    >
                      {PROJECT_STATUSES.map((item) => (
                        <option key={item} value={item}>
                          {STATUS_LABELS[item]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Priority">
                    <select
                      value={priority}
                      onChange={(event) => setPriority(event.target.value)}
                      className={inputClass}
                    >
                      {PROJECT_PRIORITIES.map((item) => (
                        <option key={item} value={item}>
                          {label(item)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Start date">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Target end date">
                    <input
                      type="date"
                      min={startDate || undefined}
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                      className={inputClass}
                    />
                  </Field>
                </div>
                <Field label="Description">
                  <textarea
                    rows={4}
                    maxLength={3000}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className={`${inputClass} h-auto py-3`}
                  />
                  <span className="mt-1 block text-right text-xs text-slate-400">
                    {description.length}/3000
                  </span>
                </Field>
                <div className="flex justify-end border-t border-slate-100 pt-5">
                  <button
                    disabled={busy || (role === "admin" && managers.length === 0)}
                    type="submit"
                    className="h-11 rounded-xl bg-indigo-700 px-5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="rounded-xl bg-slate-50 px-5 py-8 text-center text-sm text-slate-600">
                You do not have permission to change project settings.
              </div>
            )
          ) : null}
        </div>
      </section>
    </main>
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

function InfoCard({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex min-h-24 flex-col items-start justify-center gap-2 rounded-xl border border-slate-200 p-4">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </div>
  );
}

function TimelineItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  );
}
