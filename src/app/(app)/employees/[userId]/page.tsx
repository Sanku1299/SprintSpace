import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import mongoose from "mongoose";

import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { getWorkspaceMember } from "@/lib/members/workspace-members";
import { MemberRoleEditor } from "@/components/members/MemberRoleEditor";
import type { CompanyRole } from "@/models/User";

const ROLE_LABELS: Record<CompanyRole, string> = {
  admin: "Admin",
  project_manager: "Project Manager",
  developer: "Developer",
  designer: "Designer",
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date(value));
}

export default async function EmployeeDetailsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const context = await getWorkspaceContext();

  if (!context) {
    redirect("/login");
  }

  if (context.role !== "admin") {
    redirect("/dashboard");
  }

  const { userId } = await params;

  if (!mongoose.isValidObjectId(userId)) {
    notFound();
  }

  const member = await getWorkspaceMember(context.workspaceId, userId);

  if (!member) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10 sm:py-14">
      <Link
        href="/employees"
        className="text-sm font-semibold text-indigo-700 hover:text-indigo-800 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        ← Back to employees
      </Link>

      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="h-28 bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500" />
        <div className="px-6 pb-8 sm:px-9">
          <div className="-mt-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <div className="flex size-20 items-center justify-center rounded-2xl border-4 border-white bg-indigo-100 text-xl font-bold text-indigo-800 shadow-sm">
                {initials(member.name)}
              </div>
              <div className="pb-1">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                  {member.name}
                </h1>
                <p className="mt-1 text-sm text-slate-600">{ROLE_LABELS[member.role]}</p>
              </div>
            </div>
            <span
              className={`w-fit rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${
                member.status === "active"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {member.status}
            </span>
          </div>

          <div className="mt-8 grid gap-4 border-t border-slate-200 pt-6 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</p>
              <a
                href={`mailto:${member.email}`}
                className="mt-2 block break-all text-sm font-medium text-indigo-700 hover:text-indigo-800"
              >
                {member.email}
              </a>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Member since
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900">
                {formatDate(member.createdAt)}
              </p>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-6">
            <h2 className="mb-3 text-lg font-semibold text-slate-950">Manage role</h2>
            {member.id === context.userId ? (
              <p className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                You can’t change your own role. Ask another workspace Admin to update it.
              </p>
            ) : (
              <MemberRoleEditor userId={member.id} role={member.role} />
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
