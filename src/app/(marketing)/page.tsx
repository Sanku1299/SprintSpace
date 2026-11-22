import Image from "next/image";
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
    <main className="relative isolate flex min-h-screen flex-col overflow-hidden bg-slate-50 text-slate-950">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <Image
          src="/workspace-hero-background.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-white/70 via-white/30 to-transparent"
      />
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

      <section className="relative z-10 flex flex-1 items-center">
        <div className="mx-auto w-full max-w-6xl px-6 py-12 sm:py-16 lg:py-20">
          <div className="max-w-xl rounded-3xl bg-white/65 p-6 shadow-lg shadow-slate-900/5 backdrop-blur-sm sm:rounded-none sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-0">
            <p className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-3.5 py-2 text-sm font-semibold text-indigo-800 shadow-sm">
              <span aria-hidden="true" className="size-2 rounded-full bg-indigo-600" />
              Project work, in one space
            </p>
            {session?.user ? (
              <>
                <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                  Welcome back.
                </h1>
                <p className="mt-5 max-w-lg text-lg leading-8 text-slate-600">
                  You’re signed in to SprintSpace. Pick up where your team left off.
                </p>
              </>
            ) : (
              <>
                <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                  Plan together. Keep every sprint moving.
                </h1>
                <p className="mt-5 max-w-lg text-lg leading-8 text-slate-600">
                  Bring projects, tasks, and team updates together in one clear workspace.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link
                    href="/register"
                    className="inline-flex min-h-12 items-center rounded-xl bg-indigo-700 px-5 py-3 font-semibold text-white shadow-lg shadow-indigo-900/15 transition hover:-translate-y-0.5 hover:bg-indigo-800 focus:outline-none focus:ring-4 focus:ring-indigo-200"
                  >
                    Create your workspace
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex min-h-12 items-center rounded-xl border border-slate-300 bg-white/85 px-5 py-3 font-semibold text-slate-700 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200"
                  >
                    Sign in
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
