import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { hasCompanyRole } from "@/lib/auth/company-role";
import { getAuthenticatedUser } from "@/lib/auth/current-user";

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="font-bold tracking-tight text-indigo-700">
            SprintSpace
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/projects"
              className="text-sm font-medium text-slate-600 transition hover:text-indigo-700"
            >
              Projects
            </Link>
            {hasCompanyRole(user, "admin") ? (
              <Link
                href="/employees"
                className="text-sm font-medium text-slate-600 transition hover:text-indigo-700"
              >
                Employees
              </Link>
            ) : null}
            <span className="hidden text-sm text-slate-600 sm:inline">
              {user.name ?? user.email}
            </span>
            <SignOutButton />
          </div>
        </nav>
      </header>
      {children}
    </div>
  );
}
