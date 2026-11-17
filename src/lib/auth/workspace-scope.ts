import "server-only";

import type { WorkspaceContext } from "@/lib/auth/workspace-context";

export function workspaceScopedFilter<T extends Record<string, unknown>>(
  context: Pick<WorkspaceContext, "workspaceId">,
  filter: T,
): Omit<T, "workspaceId"> & { workspaceId: string } {
  return { ...filter, workspaceId: context.workspaceId } as Omit<T, "workspaceId"> & {
    workspaceId: string;
  };
}
