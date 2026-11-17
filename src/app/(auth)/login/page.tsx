import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "../../../../auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

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
        <LoginForm />
      </section>
    </main>
  );
}
