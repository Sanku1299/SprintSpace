import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { workspaceScopedFilter } from "@/lib/auth/workspace-scope";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Invitation } from "@/models/Invitation";

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
    ).select("email status");

    if (!invitation) {
      return errorResponse(404, "NOT_FOUND", "Invitation not found.");
    }

    if (invitation.status === "accepted" || invitation.status === "revoked") {
      return errorResponse(
        409,
        "INVITATION_NOT_REVOCABLE",
        "This invitation can no longer be revoked.",
      );
    }

    const revokedInvitation = await Invitation.findOneAndUpdate(
      workspaceScopedFilter(context, { _id: invitationId, status: invitation.status }),
      { $set: { status: "revoked" } },
      { new: true, runValidators: true },
    ).select("email status");

    if (!revokedInvitation) {
      return errorResponse(
        409,
        "INVITATION_CHANGED",
        "The invitation changed. Refresh and try again.",
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        invitation: {
          id: revokedInvitation._id.toString(),
          email: revokedInvitation.email,
          status: revokedInvitation.status,
        },
      },
    });
  } catch {
    return errorResponse(
      503,
      "SERVICE_UNAVAILABLE",
      "Invitation service is temporarily unavailable.",
    );
  }
}
