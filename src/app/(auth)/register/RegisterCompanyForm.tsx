"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

export function RegisterCompanyForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/register-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceName: form.get("workspaceName"),
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error?.message ?? "Could not create your workspace.");
      setComplete(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create your workspace.");
    } finally {
      setBusy(false);
    }
  }

  if (complete)
    return (
      <div className="mt-7 rounded-xl bg-emerald-50 p-5 text-center">
        <p className="font-semibold text-emerald-900">Your workspace is ready.</p>
        <p className="mt-1 text-sm text-emerald-800">
          Sign in with the email and password you just created.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-flex rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800"
        >
          Go to sign in
        </Link>
      </div>
    );

  return (
    <form onSubmit={submit} className="mt-7 space-y-4">
      <Field id="workspaceName" label="Workspace name" minLength={2} maxLength={100} />
      <Field id="name" label="Your name" minLength={2} maxLength={100} />
      <Field id="email" label="Email" type="email" maxLength={254} />
      <Field
        id="password"
        label="Password"
        type="password"
        minLength={12}
        maxLength={128}
        hint="Use at least 12 characters."
      />
      {error ? (
        <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="h-11 w-full rounded-xl bg-indigo-700 px-5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"
      >
        {busy ? "Creating workspace…" : "Create workspace"}
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  type = "text",
  minLength,
  maxLength,
  hint,
}: {
  id: string;
  label: string;
  type?: string;
  minLength?: number;
  maxLength?: number;
  hint?: string;
}) {
  return (
    <label htmlFor={id} className="block text-sm font-medium text-slate-800">
      {label}
      {hint ? <span className="ml-2 text-xs font-normal text-slate-500">{hint}</span> : null}
      <input
        id={id}
        name={id}
        type={type}
        required
        minLength={minLength}
        maxLength={maxLength}
        autoComplete={id === "password" ? "new-password" : id === "email" ? "email" : "name"}
        className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
      />
    </label>
  );
}
