import { NextResponse } from "next/server";

import { createInvitationToken, INVITATION_TTL_MS } from "@/lib/auth/invitation-token";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { connectToDatabase } from "@/lib/db/mongoose";
import { createInvitationSchema } from "@/lib/validation/invitation";
import { Invitation } from "@/models/Invitation";
import { User } from "@/models/User";

function errorResponse(status: number, code: string, message: string): Response {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = createInvitationSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse(400, "VALIDATION_ERROR", "Review the invitation details and try again.");
  }

  try {
    const context = await getWorkspaceContext();

    if (!context) {
      return errorResponse(401, "UNAUTHENTICATED", "Sign in to continue.");
    }

    if (context.role !== "admin") {
      return errorResponse(403, "FORBIDDEN", "You cannot perform this action.");
    }

    await connectToDatabase();

    const existingUser = await User.findOne({ email: parsed.data.email }).select("_id");
    if (existingUser) {
      return errorResponse(409, "ACCOUNT_ALREADY_EXISTS", "An account already uses this email.");
    }

    const existingInvitation = await Invitation.findOne({
      workspaceId: context.workspaceId,
      email: parsed.data.email,
      status: "pending",
    }).select("_id");

    if (existingInvitation) {
      return errorResponse(
        409,
        "INVITATION_ALREADY_PENDING",
        "A pending invitation already exists.",
      );
    }

    const { token, tokenHash } = createInvitationToken();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    const invitation = await Invitation.create({
      workspaceId: context.workspaceId,
      email: parsed.data.email,
      name: parsed.data.name,
      role: parsed.data.role,
      tokenHash,
      status: "pending",
      expiresAt,
      invitedBy: context.userId,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          invitation: {
            id: invitation._id.toString(),
            email: invitation.email,
            name: invitation.name,
            role: invitation.role,
            status: invitation.status,
            expiresAt: invitation.expiresAt,
          },
          token,
        },
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return errorResponse(
      503,
      "SERVICE_UNAVAILABLE",
      "Invitation service is temporarily unavailable.",
    );
  }
}
