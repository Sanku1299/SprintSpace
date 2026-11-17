"use client";

import { useState, useTransition, type FormEvent } from "react";

import type { CompanyRole } from "@/models/User";

const ROLE_OPTIONS: { value: CompanyRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "project_manager", label: "Project Manager" },
  { value: "developer", label: "Developer" },
  { value: "designer", label: "Designer" },
];

type MemberRoleEditorProps = {
  userId: string;
  role: CompanyRole;
};

type RoleUpdateResponse = {
  success?: boolean;
  error?: { message?: string };
};

export function MemberRoleEditor({ userId, role }: MemberRoleEditorProps) {
  const [savedRole, setSavedRole] = useState(role);
  const [selectedRole, setSelectedRole] = useState(role);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function saveRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    startTransition(async () => {
      try {
        const response = await fetch(`/api/members/${encodeURIComponent(userId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: selectedRole }),
        });
        const result = (await response.json()) as RoleUpdateResponse;

        if (!response.ok || !result.success) {
          setMessage(result.error?.message ?? "The role could not be updated.");
          return;
        }

        setSavedRole(selectedRole);
        setMessage("Role updated.");
      } catch {
        setMessage("The role could not be updated. Check your connection and try again.");
      }
    });
  }

  return (
    <form onSubmit={saveRole} className="rounded-2xl border border-slate-200 p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:max-w-sm">
          <label htmlFor="employee-role" className="block text-sm font-semibold text-slate-900">
            Company role
          </label>
          <select
            id="employee-role"
            value={selectedRole}
            onChange={(event) => {
              setSelectedRole(event.target.value as CompanyRole);
              setMessage("");
            }}
            disabled={isPending}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:opacity-60"
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={isPending || selectedRole === savedRole}
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save role"}
        </button>
      </div>
      <p aria-live="polite" className="mt-3 min-h-5 text-sm text-slate-600">
        {message}
      </p>
    </form>
  );
}
