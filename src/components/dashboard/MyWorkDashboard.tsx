"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Data = {
  projects: Array<{ id: string; name: string; key: string; status: string }>;
  tasks: Array<{
    id: string;
    projectId: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
  }>;
  taskCount: number;
  overdueTasks: number;
  tasksByStatus: Array<{ status: string; count: number }>;
};

export function MyWorkDashboard({ name, role }: { name: string; role: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void fetch("/api/dashboard/my-work", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error?.message ?? "Could not load your work.");
        if (active) setData(payload.data as Data);
      })
      .catch((reason) => {
        if (active)
          setError(reason instanceof Error ? reason.message : "Could not load your work.");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 sm:py-12">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">
        {role} dashboard
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        Welcome{name ? `, ${name}` : " back"}.
      </h1>
      <p className="mt-3 text-slate-600">Your assigned tasks and project memberships.</p>
      {error ? (
        <p role="alert" className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {!data && !error ? <p className="mt-8 text-sm text-slate-500">Loading your work…</p> : null}
      {data ? (
        <>
          <section className="mt-8 grid gap-4 sm:grid-cols-3">
            <Metric label="Assigned tasks" value={data.taskCount} />
            <Metric label="Overdue tasks" value={data.overdueTasks} />
            <Metric label="Project memberships" value={data.projects.length} />
          </section>
          <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.5fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold text-slate-900">Tasks by status</h2>
              <ul className="mt-3 divide-y divide-slate-100">
                {data.tasksByStatus.map((item) => (
                  <li key={item.status} className="flex justify-between py-3 text-sm">
                    <span className="capitalize text-slate-600">
                      {item.status.replaceAll("_", " ")}
                    </span>
                    <span className="font-semibold">{item.count}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold text-slate-900">My tasks</h2>
              {data.tasks.length ? (
                <ul className="mt-3 divide-y divide-slate-100">
                  {data.tasks.map((task) => (
                    <li key={task.id}>
                      <Link
                        href={`/tasks/${task.id}`}
                        className="flex items-center justify-between gap-4 py-3 hover:text-indigo-700"
                      >
                        <span>
                          <span className="block text-sm font-semibold">{task.title}</span>
                          <span className="text-xs capitalize text-slate-500">
                            {task.status.replaceAll("_", " ")} · {task.priority} priority
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-slate-500">
                          {task.dueDate
                            ? new Date(task.dueDate).toLocaleDateString()
                            : "No due date"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No tasks assigned to you yet.</p>
              )}
            </section>
          </div>
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Projects</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {data.projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-800"
                >
                  {project.key} · {project.name}
                </Link>
              ))}
              {!data.projects.length ? (
                <p className="text-sm text-slate-500">No project memberships yet.</p>
              ) : null}
            </div>
          </section>
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
