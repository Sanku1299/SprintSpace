import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { getWorkspaceMember } from "@/lib/members/workspace-members";

type RouteContext = { params: Promise<{ userId: string }> };

function errorResponse(status: number, code: string, message: string): Response {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const context = await getWorkspaceContext();

    if (!context) {
      return errorResponse(401, "UNAUTHENTICATED", "Sign in to continue.");
    }

    if (context.role !== "admin") {
      return errorResponse(403, "FORBIDDEN", "You cannot perform this action.");
    }

    const { userId } = await params;

    if (!mongoose.isValidObjectId(userId)) {
      return errorResponse(404, "NOT_FOUND", "Employee not found.");
    }

    const member = await getWorkspaceMember(context.workspaceId, userId);

    if (!member) {
      return errorResponse(404, "NOT_FOUND", "Employee not found.");
    }

    return NextResponse.json(
      { success: true, data: { member } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return errorResponse(
      503,
      "SERVICE_UNAVAILABLE",
      "Employee details are temporarily unavailable.",
    );
  }
}
