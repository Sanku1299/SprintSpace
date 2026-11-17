import { auth } from "../../../../auth";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-700">
        Workspace dashboard
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        Welcome{session?.user.name ? `, ${session.user.name}` : " back"}.
      </h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        Your workspace is ready for project setup. Role-based project views will be added in the
        project management phases.
      </p>
    </main>
  );
}
