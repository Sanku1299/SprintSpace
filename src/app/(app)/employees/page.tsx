import Link from "next/link";
import { redirect } from "next/navigation";

import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasCompanyRole } from "@/lib/auth/company-role";
import { listWorkspaceMembers } from "@/lib/members/workspace-members";
import { InviteMemberForm } from "@/components/members/InviteMemberForm";
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

export default async function EmployeesPage() {
  const context = await getWorkspaceContext();

  if (!context) {
    redirect("/login");
  }

  if (!hasCompanyRole(context, "admin")) {
    redirect("/dashboard");
  }

  const members = await listWorkspaceMembers(context);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-700">
            Workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Employees</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            View the people in your workspace and their company roles.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Team members</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">
            {members.length}
          </p>
        </div>
      </div>

      <InviteMemberForm />

      <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {members.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-indigo-50 text-lg font-semibold text-indigo-700">
              +
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-950">No employees yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
              Employees will appear here after they accept an invitation to your workspace.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(10rem,0.9fr)_8rem] gap-4 border-b border-slate-200 bg-slate-50 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid">
              <span>Employee</span>
              <span>Email</span>
              <span>Role</span>
              <span>Status</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {members.map((member) => (
                <li key={member.id}>
                  <Link
                    href={`/employees/${member.id}`}
                    className="grid gap-3 px-5 py-4 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(10rem,0.9fr)_8rem] md:items-center md:gap-4 md:px-6"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-800">
                        {initials(member.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-slate-900">
                          {member.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500 md:hidden">
                          {ROLE_LABELS[member.role]}
                        </span>
                      </span>
                    </span>
                    <span className="truncate pl-[3.25rem] text-sm text-slate-600 md:pl-0">
                      {member.email}
                    </span>
                    <span className="hidden text-sm text-slate-700 md:block">
                      {ROLE_LABELS[member.role]}
                    </span>
                    <span className="pl-[3.25rem] md:pl-0">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                          member.status === "active"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {member.status}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}
