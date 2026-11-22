import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { AdminDashboard } from "@/components/dashboard/AdminDashboard";
import { ProjectManagerDashboard } from "@/components/dashboard/ProjectManagerDashboard";
import { MyWorkDashboard } from "@/components/dashboard/MyWorkDashboard";
import { getAuthenticatedUser } from "@/lib/auth/current-user";

export default async function DashboardPage() {
  await connection();
  const user = await getAuthenticatedUser();

  const dashboard =
    user?.role === "admin" ? (
      <AdminDashboard name={user.name} workspaceId={user.workspaceId} />
    ) : user?.role === "project_manager" ? (
      <ProjectManagerDashboard name={user.name} />
    ) : user?.role === "developer" || user?.role === "designer" ? (
      <MyWorkDashboard name={user.name} role={user.role} />
    ) : null;

  return (
    <DashboardBackground>
      {dashboard ?? (
        <main className="mx-auto max-w-6xl px-6 py-12">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">
            Workspace dashboard
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Welcome{user?.name ? `, ${user.name}` : " back"}.
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Plan work, bring your team together, and keep project details in one place.
          </p>
          <Link
            href="/projects"
            className="mt-7 inline-flex h-11 items-center justify-center rounded-xl bg-indigo-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-800"
          >
            Go to projects{" "}
            <span aria-hidden="true" className="ml-2">
              →
            </span>
          </Link>
        </main>
      )}
    </DashboardBackground>
  );
}

function DashboardBackground({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate min-h-[calc(100vh-4rem)] overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
        <Image
          src="/dashboard-background.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
