import { logoutAction } from "../../app/(auth)/login/actions";

export function SignOutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-indigo-100"
      >
        Sign out
      </button>
    </form>
  );
}
