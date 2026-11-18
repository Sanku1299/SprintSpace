import Link from "next/link";

import { RegisterCompanyForm } from "./RegisterCompanyForm";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
        <Link href="/" className="text-sm font-semibold tracking-wide text-indigo-700">
          SprintSpace
        </Link>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight text-slate-950">
          Create your workspace
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Set up your team space and Admin account.
        </p>
        <RegisterCompanyForm />
        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-indigo-700 hover:text-indigo-900">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
