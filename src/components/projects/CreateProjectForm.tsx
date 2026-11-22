"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

import { PROJECT_PRIORITIES, PROJECT_STATUSES } from "@/lib/projects/project-constants";
import type { CompanyRole } from "@/models/User";

type Manager = { id: string; name: string; email: string };

const STATUS_LABELS: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  archived: "Archived",
};

export function CreateProjectForm({
  role,
  userId,
  managers,
}: {
  role: CompanyRole;
  userId: string;
  managers: Manager[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectManagerId, setProjectManagerId] = useState(
    role === "project_manager" ? userId : "",
  );
  const [status, setStatus] = useState("planning");
  const [priority, setPriority] = useState("medium");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          projectManagerId,
          status,
          priority,
          ...(startDate ? { startDate } : {}),
          ...(endDate ? { endDate } : {}),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const fields = payload.error?.fields as Record<string, string[]> | undefined;
        const firstFieldError = fields ? Object.values(fields).flat()[0] : undefined;
        throw new Error(
          firstFieldError ?? payload.error?.message ?? "Could not create the project.",
        );
      }
      router.push(`/projects/${payload.data.project.id}`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the project.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-9 sm:px-8 sm:py-12">
      <Link
        href="/projects"
        className="text-sm font-medium text-slate-500 transition hover:text-indigo-700"
      >
        ← Back to projects
      </Link>
      <div className="mt-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-700">
          Project setup
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
          Create a project
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Set the project basics now. You can update these details later.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="mt-8 space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"
      >
        {error ? (
          <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Project name" required>
            <input
              required
              minLength={2}
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Website redesign"
              className={inputClass}
            />
          </Field>
          <Field label="Project number" hint="Assigned automatically in sequence for this workspace.">
            <div className={`${inputClass} flex items-center bg-slate-50 text-slate-600`}>
              1, 2, 3…
            </div>
          </Field>
          <Field label="Responsible project manager" required>
            {role === "project_manager" ? (
              <div className={`${inputClass} flex items-center bg-slate-50 text-slate-600`}>
                You
              </div>
            ) : (
              <select
                required
                value={projectManagerId}
                onChange={(event) => setProjectManagerId(event.target.value)}
                className={inputClass}
              >
                <option value="">Choose a project manager</option>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.name} · {manager.email}
                  </option>
                ))}
              </select>
            )}
            {role === "admin" && managers.length === 0 ? (
              <span className="mt-1 block text-xs text-amber-700">
                Invite an active Project Manager before creating a project.
              </span>
            ) : null}
          </Field>
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
                <option key={item} value={item} className="capitalize">
                  {item[0].toUpperCase() + item.slice(1)}
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

        <Field label="Description" hint="Give your team a quick overview of the work.">
          <textarea
            rows={4}
            maxLength={3000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What is this project for?"
            className={`${inputClass} h-auto py-3`}
          />
          <span className="mt-1 block text-right text-xs text-slate-400">
            {description.length}/3000
          </span>
        </Field>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
          <Link
            href="/projects"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            disabled={busy || (role === "admin" && managers.length === 0)}
            type="submit"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-indigo-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Creating…" : "Create project"}
          </button>
        </div>
      </form>
    </main>
  );
}

const inputClass =
  "mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

function Field({
  children,
  label,
  hint,
  required,
}: {
  children: ReactNode;
  label: string;
  hint?: string;
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
      {hint ? <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span> : null}
      {children}
    </label>
  );
}
