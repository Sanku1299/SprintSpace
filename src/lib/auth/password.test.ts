import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("stores a salted hash and verifies the matching password", async () => {
    const password = "correct horse battery staple";
    const hash = await hashPassword(password);

    expect(hash).toMatch(/^scrypt\$v1\$/);
    expect(hash).not.toContain(password);
    await expect(verifyPassword(password, hash)).resolves.toBe(true);
  });

  it("rejects a wrong password and malformed hashes", async () => {
    const hash = await hashPassword("correct horse battery staple");

    await expect(verifyPassword("incorrect password", hash)).resolves.toBe(false);
    await expect(verifyPassword("anything", "invalid-hash")).resolves.toBe(false);
  });

  it("uses a different salt for each hash", async () => {
    const first = await hashPassword("same password");
    const second = await hashPassword("same password");

    expect(first).not.toBe(second);
  });
});
