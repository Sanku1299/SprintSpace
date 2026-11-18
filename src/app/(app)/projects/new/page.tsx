import { redirect } from "next/navigation";

import { CreateProjectForm } from "@/components/projects/CreateProjectForm";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { listWorkspaceMembers } from "@/lib/members/workspace-members";
import type { CompanyRole } from "@/models/User";

export default async function NewProjectPage() {
  const context = await getWorkspaceContext();

  if (!context) {
    redirect("/login");
  }

  if (context.role !== "admin" && context.role !== "project_manager") {
    redirect("/projects");
  }

  const managers =
    context.role === "admin"
      ? (await listWorkspaceMembers(context))
          .filter((member) => member.role === "project_manager" && member.status === "active")
          .map((member) => ({ id: member.id, name: member.name, email: member.email }))
      : [];

  return (
    <CreateProjectForm
      role={context.role as CompanyRole}
      userId={context.userId}
      managers={managers}
    />
  );
}
