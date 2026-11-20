"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  project_manager: "Project Manager",
  developer: "Developer",
  designer: "Designer",
};

type Invitation = {
  email: string;
  name?: string;
  role: string;
  expiresAt: string;
};

type ApiPayload = {
  success?: boolean;
  data?: { invitation?: Invitation; user?: { name: string; role: string } };
  error?: { message?: string };
};

export function AcceptInvitationForm({ token }: { token: string }) {
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadInvitation() {
      try {
        const response = await fetch(`/api/invitations/accept?token=${encodeURIComponent(token)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as ApiPayload;
        if (!response.ok || !payload.data?.invitation) {
          throw new Error(payload.error?.message ?? "This invitation is no longer available.");
        }
        setInvitation(payload.data.invitation);
      } catch (reason) {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : "Could not load this invitation.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadInvitation();
    return () => controller.abort();
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: form.get("name"),
          password,
        }),
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Could not create your account.");
      }
      setAccepted(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create your account.");
    } finally {
      setBusy(false);
    }
  }

  if (accepted) {
    return (
      <section className="w-full max-w-md rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-sm sm:p-10">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-xl text-emerald-700">
          ✓
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-slate-950">Your account is ready</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Your {ROLE_LABELS[invitation?.role ?? ""] ?? "workspace"} account has been created. Sign
          in to get started.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-indigo-700 px-5 text-sm font-semibold text-white hover:bg-indigo-800"
        >
          Go to sign in
        </Link>
      </section>
    );
  }

  if (loading) {
    return (
      <section
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10"
        aria-busy="true"
      >
        <p className="text-sm text-slate-600">Checking your invitation…</p>
      </section>
    );
  }

  if (!invitation) {
    return (
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-700">SprintSpace</p>
        <h1 className="mt-5 text-2xl font-semibold text-slate-950">Invitation unavailable</h1>
        <p role="alert" className="mt-3 text-sm leading-6 text-slate-600">
          {error ||
            "This invitation is invalid or has expired. Ask your workspace Admin for a new link."}
        </p>
        <Link
          href="/login"
          className="mt-5 inline-flex text-sm font-semibold text-indigo-700 hover:text-indigo-900"
        >
          Go to sign in
        </Link>
      </section>
    );
  }

  const roleLabel = ROLE_LABELS[invitation.role] ?? invitation.role;

  return (
    <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
      <p className="text-sm font-semibold tracking-wide text-indigo-700">SprintSpace</p>
      <h1 className="mt-7 text-3xl font-semibold tracking-tight text-slate-950">
        Join your workspace
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Create your account to join as a{" "}
        <span className="font-semibold text-slate-800">{roleLabel}</span>.
      </p>

      <div className="mt-5 rounded-xl bg-indigo-50 p-4 text-sm">
        <p className="text-slate-600">Invited email</p>
        <p className="mt-0.5 font-semibold text-slate-900">{invitation.email}</p>
        <p className="mt-3 text-slate-600">Company role</p>
        <p className="mt-0.5 font-semibold text-indigo-800">{roleLabel}</p>
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm font-medium text-slate-800">
          Your name
          <input
            name="name"
            autoComplete="name"
            required
            minLength={2}
            maxLength={100}
            defaultValue={invitation.name ?? ""}
            className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          />
        </label>
        <label className="block text-sm font-medium text-slate-800">
          Create password
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">
            Use at least 12 characters.
          </span>
        </label>
        <label className="block text-sm font-medium text-slate-800">
          Confirm password
          <input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          />
        </label>

        {error ? (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="h-11 w-full rounded-xl bg-indigo-700 px-5 text-sm font-semibold text-white transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Creating account…" : `Join as ${roleLabel}`}
        </button>
      </form>
    </section>
  );
}
