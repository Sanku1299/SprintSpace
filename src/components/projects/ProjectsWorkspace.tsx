"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { PROJECT_STATUSES } from "@/lib/projects/project-constants";
import type { ProjectListItem } from "@/lib/projects/project-types";
import type { CompanyRole } from "@/models/User";

const STATUS_LABELS: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  archived: "Archived",
};

function statusStyle(status: string): string {
  if (status === "active") return "bg-emerald-50 text-emerald-700";
  if (status === "completed") return "bg-blue-50 text-blue-700";
  if (status === "on_hold") return "bg-amber-50 text-amber-700";
  if (status === "archived") return "bg-slate-100 text-slate-500";
  return "bg-indigo-50 text-indigo-700";
}

function pretty(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function ProjectsWorkspace({
  role,
  initialProjects,
  initialError,
}: {
  role: CompanyRole;
  initialProjects: ProjectListItem[];
  initialError: string;
}) {
  const projects = initialProjects;
  const error = initialError;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const canCreate = role === "admin" || role === "project_manager";

  const visibleProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return projects.filter((project) => {
      const matchesQuery =
        !normalizedQuery ||
        project.name.toLowerCase().includes(normalizedQuery) ||
        project.key.toLowerCase().includes(normalizedQuery) ||
        project.description.toLowerCase().includes(normalizedQuery);
      return matchesQuery && (status === "all" || project.status === status);
    });
  }, [projects, query, status]);

  const activeCount = projects.filter((project) => project.status === "active").length;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-9 sm:px-8 sm:py-12">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-700">Workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Projects
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Keep project plans, people, and progress together.
          </p>
        </div>
        {canCreate ? (
          <Link
            href="/projects/new"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            <span aria-hidden="true" className="text-lg leading-none">
              +
            </span>{" "}
            New project
          </Link>
        ) : null}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Visible projects" value={String(projects.length)} />
        <SummaryCard label="Active" value={String(activeCount)} accent="emerald" />
        <SummaryCard label="Your role" value={pretty(role)} accent="violet" />
      </div>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="font-semibold text-slate-900">Project directory</h2>
            <p className="mt-1 text-xs text-slate-500">{visibleProjects.length} shown</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor="project-search">
              Search projects
            </label>
            <input
              id="project-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects"
              className="h-10 min-w-0 rounded-lg border border-slate-200 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 sm:w-56"
            />
            <label className="sr-only" htmlFor="project-status">
              Filter by status
            </label>
            <select
              id="project-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="all">All statuses</option>
              {PROJECT_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {STATUS_LABELS[item]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? <InlineError message={error} /> : null}
        {visibleProjects.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-indigo-50 text-xl font-semibold text-indigo-700">
              P
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-950">
              {projects.length === 0 ? "Your project space starts here" : "No matching projects"}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
              {projects.length === 0
                ? canCreate
                  ? "Create a project to start planning work with your team."
                  : "Projects you are assigned to will appear here."
                : "Try a different search or status filter."}
            </p>
            {projects.length === 0 && canCreate ? (
              <Link
                href="/projects/new"
                className="mt-5 inline-flex rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800"
              >
                Create a project
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleProjects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group rounded-xl border border-slate-200 p-5 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xs font-bold tracking-wide text-indigo-800">
                    {project.key}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle(project.status)}`}
                  >
                    {STATUS_LABELS[project.status] ?? pretty(project.status)}
                  </span>
                </div>
                <h3 className="mt-4 truncate text-base font-semibold text-slate-950 group-hover:text-indigo-800">
                  {project.name}
                </h3>
                <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500">
                  {project.description || "No description yet."}
                </p>
                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs">
                  <span className="capitalize text-slate-500">
                    {pretty(project.priority)} priority
                  </span>
                  <span className="font-semibold text-indigo-700">
                    Open project <span aria-hidden="true">→</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  accent = "indigo",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  const colors: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-700",
    emerald: "bg-emerald-50 text-emerald-700",
    violet: "bg-violet-50 text-violet-700",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={`mt-3 inline-flex max-w-full rounded-lg px-2.5 py-1 text-lg font-semibold capitalize ${colors[accent]}`}
      >
        {value}
      </p>
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <p role="alert" className="mx-5 mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {message}
    </p>
  );
}
