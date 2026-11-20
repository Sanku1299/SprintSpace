"use client";

import { useState, type FormEvent } from "react";

const ROLES = [
  { value: "project_manager", label: "Project Manager" },
  { value: "developer", label: "Developer" },
  { value: "designer", label: "Designer" },
] as const;

type Role = (typeof ROLES)[number]["value"];

type InvitationResponse = {
  success?: boolean;
  data?: {
    invitation?: { email: string; role: Role; expiresAt: string };
    token?: string;
  };
  error?: { message?: string };
};

export function InviteMemberForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role | "">("");
  const [copied, setCopied] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true);
    setError("");
    setInviteLink("");
    setCopied(false);

    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          name: form.get("name"),
          role: form.get("role"),
        }),
      });
      const responseText = await response.text();
      let payload: InvitationResponse;
      try {
        payload = JSON.parse(responseText) as InvitationResponse;
      } catch {
        throw new Error("The server returned an invalid response. Please try again.");
      }

      if (!response.ok) {
        throw new Error(payload.error?.message ?? "Could not create the invitation.");
      }

      const invitation = payload.data?.invitation;
      const token = payload.data?.token;
      if (!invitation || !token) {
        throw new Error("The invitation was created, but its signup link was missing.");
      }

      setInviteEmail(invitation.email);
      setInviteRole(invitation.role);
      setInviteLink(`${window.location.origin}/invite/${encodeURIComponent(token)}`);
      formElement.reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create the invitation.");
    } finally {
      setBusy(false);
    }
  }

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
    } catch {
      setError("Copying failed. Select and copy the invitation link below.");
    }
  }

  const roleLabel = ROLES.find((role) => role.value === inviteRole)?.label;

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-700">
          Workspace access
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
          Invite a team member
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Choose their company role. They’ll create their account from a private link that expires
          after seven days.
        </p>
      </div>

      <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-800">
          Full name
          <input
            name="name"
            autoComplete="name"
            required
            minLength={2}
            maxLength={100}
            className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          />
        </label>
        <label className="block text-sm font-medium text-slate-800">
          Email address
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          />
        </label>
        <label className="block text-sm font-medium text-slate-800 sm:col-span-2">
          Company role
          <select
            name="role"
            required
            defaultValue=""
            className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 sm:max-w-sm"
          >
            <option value="" disabled>
              Select a role
            </option>
            {ROLES.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs font-normal text-slate-500">
            The role is assigned from this invitation when they sign up.
          </span>
        </label>

        {error ? (
          <p
            role="alert"
            className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-2"
          >
            {error}
          </p>
        ) : null}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy}
            className="h-11 rounded-xl bg-indigo-700 px-5 text-sm font-semibold text-white transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Creating invitation…" : "Create invitation link"}
          </button>
        </div>
      </form>

      {inviteLink ? (
        <div
          className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4"
          aria-live="polite"
        >
          <p className="font-semibold text-emerald-950">Invitation ready for {inviteEmail}</p>
          <p className="mt-1 text-sm text-emerald-900">Assigned role: {roleLabel}</p>
          <p className="mt-3 break-all rounded-lg bg-white px-3 py-2 font-mono text-xs text-slate-700">
            {inviteLink}
          </p>
          <button
            type="button"
            onClick={copyInviteLink}
            className="mt-3 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
          >
            {copied ? "Copied" : "Copy invitation link"}
          </button>
          <p className="mt-2 text-xs text-emerald-900">
            Send this private link to the invited person. It can be used once and expires in seven
            days.
          </p>
        </div>
      ) : null}
    </section>
  );
}
