import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { createInvitationToken, INVITATION_TTL_MS } from "@/lib/auth/invitation-token";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { workspaceScopedFilter } from "@/lib/auth/workspace-scope";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Invitation } from "@/models/Invitation";
import { User } from "@/models/User";

type RouteContext = { params: Promise<{ invitationId: string }> };

function errorResponse(status: number, code: string, message: string): Response {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

export async function POST(_request: Request, { params }: RouteContext): Promise<Response> {
  const { invitationId } = await params;

  if (!mongoose.isValidObjectId(invitationId)) {
    return errorResponse(404, "NOT_FOUND", "Invitation not found.");
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
    const invitation = await Invitation.findOne(
      workspaceScopedFilter(context, { _id: invitationId }),
    ).select("email name role status");

    if (!invitation) {
      return errorResponse(404, "NOT_FOUND", "Invitation not found.");
    }

    if (invitation.status === "accepted" || invitation.status === "revoked") {
      return errorResponse(
        409,
        "INVITATION_NOT_RESENDABLE",
        "This invitation can no longer be resent.",
      );
    }

    const existingUser = await User.findOne({ email: invitation.email }).select("_id");
    if (existingUser) {
      return errorResponse(409, "ACCOUNT_ALREADY_EXISTS", "An account already uses this email.");
    }

    const { token, tokenHash } = createInvitationToken();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
    const updatedInvitation = await Invitation.findOneAndUpdate(
      workspaceScopedFilter(context, { _id: invitationId, status: invitation.status }),
      { $set: { tokenHash, status: "pending", expiresAt } },
      { new: true, runValidators: true },
    ).select("email name role status expiresAt");

    if (!updatedInvitation) {
      return errorResponse(
        409,
        "INVITATION_CHANGED",
        "The invitation changed. Refresh and try again.",
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          invitation: {
            id: updatedInvitation._id.toString(),
            email: updatedInvitation.email,
            name: updatedInvitation.name,
            role: updatedInvitation.role,
            status: updatedInvitation.status,
            expiresAt: updatedInvitation.expiresAt,
          },
          token,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return errorResponse(
      503,
      "SERVICE_UNAVAILABLE",
      "Invitation service is temporarily unavailable.",
    );
  }
}
