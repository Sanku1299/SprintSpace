import Link from "next/link";

import { auth } from "../../../auth";
import { SignOutButton } from "@/components/auth/SignOutButton";

export default async function HomePage() {
  const session = await auth();

  return (
    <main className="flex min-h-screen flex-col bg-slate-50 text-slate-950">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-bold tracking-tight text-indigo-700">
          SprintSpace
        </Link>
        {session?.user ? (
          <SignOutButton />
        ) : (
          <Link
            href="/login"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200"
          >
            Sign in
          </Link>
        )}
      </header>

      <section className="mx-auto flex w-full max-w-6xl flex-1 items-center px-6 py-16">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">
            Project work, in one space
          </p>
          {session?.user ? (
            <>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-6xl">
                Welcome{session.user.name ? `, ${session.user.name}` : " back"}.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
                You’re signed in as {session.user.role.replaceAll("_", " ")}.
              </p>
              <p className="mt-3 text-sm text-slate-500">
                Your project workspace is being prepared.
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-6xl">
                Plan together. Keep every sprint moving.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
                SprintSpace brings your projects, tasks, and team updates together in one workspace.
              </p>
              <Link
                href="/login"
                className="mt-8 inline-flex rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200"
              >
                Sign in to your workspace
              </Link>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
