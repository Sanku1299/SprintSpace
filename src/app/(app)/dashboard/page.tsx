import { getAuthenticatedUser } from "@/lib/auth/current-user";
import Link from "next/link";

export default async function DashboardPage() {
  const user = await getAuthenticatedUser();

  return (
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
  );
}
