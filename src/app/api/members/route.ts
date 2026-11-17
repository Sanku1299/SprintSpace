import { NextResponse } from "next/server";

import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { listWorkspaceMembers } from "@/lib/members/workspace-members";

function errorResponse(status: number, code: string, message: string): Response {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(): Promise<Response> {
  try {
    const context = await getWorkspaceContext();

    if (!context) {
      return errorResponse(401, "UNAUTHENTICATED", "Sign in to continue.");
    }

    if (context.role !== "admin") {
      return errorResponse(403, "FORBIDDEN", "You cannot perform this action.");
    }

    const members = await listWorkspaceMembers(context);
    return NextResponse.json(
      { success: true, data: { members } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return errorResponse(
      503,
      "SERVICE_UNAVAILABLE",
      "Employee directory is temporarily unavailable.",
    );
  }
}
