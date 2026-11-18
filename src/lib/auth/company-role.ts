import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import type { CompanyRole } from "@/models/User";

export function hasCompanyRole(
  context: Pick<WorkspaceContext, "role">,
  ...allowedRoles: CompanyRole[]
): boolean {
  return allowedRoles.includes(context.role);
}
