import "server-only";

import { getAuthenticatedUser } from "@/lib/auth/current-user";
import type { CompanyRole } from "@/models/User";

export type WorkspaceContext = {
  userId: string;
  workspaceId: string;
  role: CompanyRole;
};

export async function getWorkspaceContext(): Promise<WorkspaceContext | null> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return null;
  }

  return {
    userId: user.id,
    workspaceId: user.workspaceId,
    role: user.role,
  };
}
