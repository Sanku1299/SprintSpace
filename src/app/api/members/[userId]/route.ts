import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { workspaceScopedFilter } from "@/lib/auth/workspace-scope";
import { getWorkspaceMember } from "@/lib/members/workspace-members";
import { updateMemberRoleSchema } from "@/lib/validation/member";
import { User } from "@/models/User";

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

    const member = await getWorkspaceMember(context, userId);

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

export async function PATCH(request: Request, { params }: RouteContext): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = updateMemberRoleSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse(400, "VALIDATION_ERROR", "Choose a valid company role.");
  }

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

    const memberId = new mongoose.Types.ObjectId(userId).toString();

    if (memberId === context.userId) {
      return errorResponse(409, "SELF_ROLE_CHANGE_NOT_ALLOWED", "You cannot change your own role.");
    }

    const member = await User.findOneAndUpdate(
      workspaceScopedFilter(context, { _id: memberId }),
      { $set: { role: parsed.data.role } },
      { new: true, runValidators: true },
    ).select("_id name email role status avatarUrl createdAt");

    if (!member) {
      return errorResponse(404, "NOT_FOUND", "Employee not found.");
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          member: {
            id: member._id.toString(),
            name: member.name,
            email: member.email,
            role: member.role,
            status: member.status,
            ...(member.avatarUrl ? { avatarUrl: member.avatarUrl } : {}),
            createdAt: member.createdAt.toISOString(),
          },
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return errorResponse(
      503,
      "SERVICE_UNAVAILABLE",
      "Employee role could not be updated right now.",
    );
  }
}
