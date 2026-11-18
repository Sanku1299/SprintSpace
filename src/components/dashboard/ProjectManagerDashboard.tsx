"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type DashboardData = {
  projects: Array<{
    id: string;
    name: string;
    key: string;
    status: string;
    priority: string;
    endDate: string | null;
  }>;
  projectCount: number;
  taskCount: number;
  overdueTasks: number;
  tasksByStatus: Array<{ status: string; count: number }>;
};

export function ProjectManagerDashboard({ name }: { name: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void fetch("/api/dashboard/project-manager", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error?.message ?? "Could not load dashboard.");
        if (active) setData(payload.data as DashboardData);
      })
      .catch((reason) => {
        if (active)
          setError(reason instanceof Error ? reason.message : "Could not load dashboard.");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 sm:py-12">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">
        Project Manager overview
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        Welcome{name ? `, ${name}` : " back"}.
      </h1>
      <p className="mt-3 text-slate-600">
        Your projects and workload, scoped to projects you manage.
      </p>
      {error ? (
        <p role="alert" className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {!data && !error ? (
        <p className="mt-8 text-sm text-slate-500">Loading your overview…</p>
      ) : null}
      {data ? (
        <>
          <section className="mt-8 grid gap-4 sm:grid-cols-3">
            <Metric label="Projects you manage" value={data.projectCount} />
            <Metric label="Tasks" value={data.taskCount} />
            <Metric label="Overdue tasks" value={data.overdueTasks} />
          </section>
          <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.4fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold text-slate-900">Tasks by status</h2>
              <ul className="mt-3 divide-y divide-slate-100">
                {data.tasksByStatus.map((row) => (
                  <li key={row.status} className="flex justify-between py-3 text-sm">
                    <span className="capitalize text-slate-600">
                      {row.status.replaceAll("_", " ")}
                    </span>
                    <span className="font-semibold">{row.count}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold text-slate-900">Your projects</h2>
              {data.projects.length ? (
                <ul className="mt-3 divide-y divide-slate-100">
                  {data.projects.map((project) => (
                    <li key={project.id}>
                      <Link
                        href={`/projects/${project.id}`}
                        className="flex items-center justify-between gap-3 py-3 hover:text-indigo-700"
                      >
                        <span>
                          <span className="block text-sm font-semibold">{project.name}</span>
                          <span className="text-xs text-slate-500">
                            {project.key} · {project.status}
                          </span>
                        </span>
                        <span aria-hidden="true">→</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No projects assigned yet.</p>
              )}
            </section>
          </div>
        </>
      ) : null}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-slate-950">{value}</p>
    </article>
  );
}
