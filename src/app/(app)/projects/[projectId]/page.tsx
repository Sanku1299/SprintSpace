import { connection } from "next/server";
import { Suspense } from "react";

import { ProjectDetailsWorkspace } from "@/components/projects/ProjectDetailsWorkspace";
import { getAuthenticatedUser } from "@/lib/auth/current-user";

type PageProps = { params: Promise<{ projectId: string }> };

export default function ProjectDetailsPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8" aria-busy="true">
          <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
          <div className="mt-5 h-48 animate-pulse rounded-2xl bg-slate-100" />
        </main>
      }
    >
      <ProjectDetailsContent params={params} />
    </Suspense>
  );
}

async function ProjectDetailsContent({ params }: PageProps) {
  await connection();
  const [user, { projectId }] = await Promise.all([getAuthenticatedUser(), params]);

  return (
    <ProjectDetailsWorkspace
      projectId={projectId}
      role={user?.role ?? "developer"}
      userId={user?.id ?? ""}
    />
  );
}
