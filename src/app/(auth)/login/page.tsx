import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { getAuthenticatedUser } from "@/lib/auth/current-user";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <>
      <Suspense fallback={null}>
        <RedirectAuthenticatedUser />
      </Suspense>
      <LoginPageContent />
    </>
  );
}

async function RedirectAuthenticatedUser() {
  await connection();
  const user = await getAuthenticatedUser();

  if (user) {
    redirect("/dashboard");
  }

  return null;
}

function LoginPageContent() {
  const demoLoginDefaults =
    process.env.DEMO_LOGIN_EMAIL &&
    process.env.DEMO_LOGIN_PASSWORD
      ? {
          email: process.env.DEMO_LOGIN_EMAIL,
          password: process.env.DEMO_LOGIN_PASSWORD,
        }
      : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
        <Link href="/" className="text-sm font-semibold tracking-wide text-indigo-700">
          SprintSpace
        </Link>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight text-slate-950">Welcome back</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Sign in to continue to your workspace.
        </p>
        <LoginForm
          initialEmail={demoLoginDefaults?.email}
          initialPassword={demoLoginDefaults?.password}
        />
        <p className="mt-6 text-center text-sm text-slate-600">
          New to SprintSpace?{" "}
          <Link href="/register" className="font-semibold text-indigo-700 hover:text-indigo-900">
            Create a workspace
          </Link>
        </p>
      </section>
    </main>
  );
}
