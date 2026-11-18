import { describe, expect, it } from "vitest";

import { hasCompanyRole } from "./company-role";

describe("hasCompanyRole", () => {
  it("allows a role listed by the policy", () => {
    expect(hasCompanyRole({ role: "admin" }, "admin")).toBe(true);
    expect(hasCompanyRole({ role: "designer" }, "developer", "designer")).toBe(true);
  });

  it("denies roles outside the policy", () => {
    expect(hasCompanyRole({ role: "developer" }, "admin", "project_manager")).toBe(false);
  });
});
