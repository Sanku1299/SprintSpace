"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Metrics = {
  members: { total: number; active: number };
  projects: { total: number; active: number; byStatus: Array<{ status: string; count: number }> };
  tasks: { total: number; byStatus: Array<{ status: string; count: number }> };
};

export function AdminDashboard({ name }: { name: string }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void fetch("/api/dashboard/admin", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error?.message ?? "Could not load dashboard.");
        if (active) setMetrics(payload.data as Metrics);
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
        Admin overview
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        Welcome{name ? `, ${name}` : " back"}.
      </h1>
      <p className="mt-3 text-slate-600">Workspace activity and current workload at a glance.</p>
      {error ? (
        <p role="alert" className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {!metrics && !error ? (
        <p className="mt-8 text-sm text-slate-500">Loading workspace metrics…</p>
      ) : null}
      {metrics ? (
        <>
          <section className="mt-8 grid gap-4 sm:grid-cols-3" aria-label="Workspace totals">
            <Metric
              label="Team members"
              value={metrics.members.total}
              detail={`${metrics.members.active} active`}
            />
            <Metric
              label="Projects"
              value={metrics.projects.total}
              detail={`${metrics.projects.active} active`}
            />
            <Metric label="Tasks" value={metrics.tasks.total} detail="Across this workspace" />
          </section>
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <Breakdown title="Tasks by status" rows={metrics.tasks.byStatus} />
            <Breakdown title="Projects by status" rows={metrics.projects.byStatus} />
          </div>
        </>
      ) : null}
      <div className="mt-8 flex gap-3">
        <Link
          href="/projects"
          className="rounded-xl bg-indigo-700 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-800"
        >
          Manage projects
        </Link>
        <Link
          href="/employees"
          className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Manage team
        </Link>
      </div>
    </main>
  );
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </article>
  );
}

function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ status: string; count: number }>;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      {rows.length ? (
        <ul className="mt-4 divide-y divide-slate-100">
          {rows.map((row) => (
            <li key={row.status} className="flex justify-between py-3 text-sm">
              <span className="capitalize text-slate-600">{row.status.replaceAll("_", " ")}</span>
              <span className="font-semibold text-slate-900">{row.count}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-slate-500">No data yet.</p>
      )}
    </section>
  );
}
