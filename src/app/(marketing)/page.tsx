import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { auth } from "../../../auth";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
          <p>Loading SprintSpace…</p>
        </main>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}

async function HomePageContent() {
  await connection();
  const session = await auth();

  return (
    <main className="flex min-h-screen flex-col overflow-hidden bg-slate-50 text-slate-950">
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-bold tracking-tight text-indigo-700">
          SprintSpace
        </Link>
        <nav className="flex items-center gap-3" aria-label="Account">
          {session?.user ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-800 focus:outline-none focus:ring-4 focus:ring-indigo-200"
            >
              Open dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white/70 hover:text-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-800 focus:outline-none focus:ring-4 focus:ring-indigo-200"
              >
                Create your workspace
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="relative isolate flex flex-1 items-center overflow-hidden bg-slate-50">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/workspace-hero.svg')" }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-r from-slate-50 via-slate-50/95 to-slate-50/20"
        />

        <div className="relative z-10 mx-auto w-full max-w-6xl px-6 py-16 sm:py-20 lg:py-28">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">
            Project work, in one space
          </p>
          {session?.user ? (
            <>
              <h1 className="mt-5 max-w-2xl text-4xl font-semibold tracking-tight sm:text-6xl">
                Welcome back.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
                You’re signed in to SprintSpace.
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
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/register"
                  className="inline-flex min-h-12 items-center rounded-xl bg-indigo-700 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-indigo-800 focus:outline-none focus:ring-4 focus:ring-indigo-200"
                >
                  Create your workspace
                </Link>
                <Link
                  href="/login"
                  className="inline-flex min-h-12 items-center rounded-xl border border-slate-300 bg-white/80 px-5 py-3 font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200"
                >
                  Sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
