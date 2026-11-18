import { describe, expect, it } from "vitest";

import { workspaceScopedFilter } from "./workspace-scope";

describe("workspaceScopedFilter", () => {
  it("overrides a caller-supplied workspace ID with trusted context", () => {
    const filter = workspaceScopedFilter(
      { workspaceId: "trusted-workspace" },
      { email: "person@example.com", workspaceId: "attacker-workspace" },
    );

    expect(filter).toEqual({ email: "person@example.com", workspaceId: "trusted-workspace" });
  });

  it("keeps resource filters while adding the trusted workspace scope", () => {
    const filter = workspaceScopedFilter({ workspaceId: "workspace-a" }, { _id: "member-1" });

    expect(filter).toEqual({ _id: "member-1", workspaceId: "workspace-a" });
  });
});
