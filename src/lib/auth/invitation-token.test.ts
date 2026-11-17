import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createInvitationToken, INVITATION_TTL_MS } from "./invitation-token";

describe("invitation tokens", () => {
  it("returns a high-entropy token and stores only its SHA-256 hash", () => {
    const { token, tokenHash } = createInvitationToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(tokenHash).not.toBe(token);
  });

  it("uses a seven-day expiration period", () => {
    expect(INVITATION_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
