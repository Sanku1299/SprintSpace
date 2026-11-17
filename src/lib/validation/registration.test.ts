import { describe, expect, it } from "vitest";

import { registerCompanySchema } from "./registration";

describe("registerCompanySchema", () => {
  it("trims names and normalizes the email", () => {
    const result = registerCompanySchema.safeParse({
      workspaceName: "  Sprint Space  ",
      name: "  Sam User  ",
      email: "  SAM@EXAMPLE.COM  ",
      password: "a-long-password-123",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        workspaceName: "Sprint Space",
        name: "Sam User",
        email: "sam@example.com",
        password: "a-long-password-123",
      });
    }
  });

  it("rejects invalid email and passwords outside the allowed length", () => {
    expect(
      registerCompanySchema.safeParse({
        workspaceName: "Sprint Space",
        name: "Sam User",
        email: "not-an-email",
        password: "short",
      }).success,
    ).toBe(false);
  });
});
