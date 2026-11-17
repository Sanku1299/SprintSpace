export function isDuplicatePendingInvitationError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error) || error.code !== 11000) {
    return false;
  }

  if (!("keyPattern" in error) || typeof error.keyPattern !== "object" || !error.keyPattern) {
    return false;
  }

  return "workspaceId" in error.keyPattern && "email" in error.keyPattern;
}
