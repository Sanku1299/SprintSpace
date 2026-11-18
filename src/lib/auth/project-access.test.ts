import { describe, expect, it } from "vitest";

import { canAccessProject } from "./project-access";

const project = {
  workspaceId: "workspace-a",
  projectManagerId: "pm-1",
};

describe("canAccessProject", () => {
  it("allows Admins in their workspace and denies cross-workspace access", () => {
    expect(
      canAccessProject({ userId: "admin-1", workspaceId: "workspace-a", role: "admin" }, project),
    ).toBe(true);
    expect(
      canAccessProject({ userId: "admin-1", workspaceId: "workspace-b", role: "admin" }, project),
    ).toBe(false);
  });

  it("allows a PM only on the project they manage", () => {
    const responsiblePm = {
      userId: "pm-1",
      workspaceId: "workspace-a",
      role: "project_manager",
    } as const;
    const otherPm = { ...responsiblePm, userId: "pm-2" };

    expect(canAccessProject(responsiblePm, project)).toBe(true);
    expect(canAccessProject(otherPm, project)).toBe(false);
  });

  it("requires project membership for Developers and Designers", () => {
    const developer = { userId: "dev-1", workspaceId: "workspace-a", role: "developer" } as const;
    const designer = { userId: "design-1", workspaceId: "workspace-a", role: "designer" } as const;

    expect(canAccessProject(developer, project)).toBe(false);
    expect(canAccessProject(developer, project, true)).toBe(true);
    expect(canAccessProject(designer, project, true)).toBe(true);
  });
});
