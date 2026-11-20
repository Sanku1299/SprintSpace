import { Suspense } from "react";

import { AcceptInvitationForm } from "@/components/auth/AcceptInvitationForm";

type InvitePageProps = { params: Promise<{ token: string }> };

export default function InvitePage({ params }: InvitePageProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12">
      <Suspense
        fallback={
          <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
            <p className="text-sm text-slate-600">Loading invitation…</p>
          </section>
        }
      >
        <InvitePageContent params={params} />
      </Suspense>
    </main>
  );
}

async function InvitePageContent({ params }: InvitePageProps) {
  const { token } = await params;
  return <AcceptInvitationForm token={token} />;
}
