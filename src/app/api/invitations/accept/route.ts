import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { hashPassword } from "@/lib/auth/password";
import { connectToDatabase } from "@/lib/db/mongoose";
import { acceptInvitationSchema } from "@/lib/validation/invitation";
import { Invitation } from "@/models/Invitation";
import { User } from "@/models/User";

class InvitationUnavailableError extends Error {}
class AccountAlreadyExistsError extends Error {}
class InvalidAcceptanceDetailsError extends Error {}

function errorResponse(status: number, code: string, message: string): Response {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = acceptInvitationSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse(400, "VALIDATION_ERROR", "Review the invitation details and try again.");
  }

  const { token, password } = parsed.data;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  let session: mongoose.ClientSession | undefined;

  try {
    const dbSession = await (await connectToDatabase()).startSession();
    session = dbSession;
    let acceptedUser: { id: string; name: string; email: string; role: string } | undefined;

    await dbSession.withTransaction(async () => {
      const now = new Date();
      const invitation = await Invitation.findOne({
        tokenHash,
        status: "pending",
        expiresAt: { $gt: now },
      }).session(dbSession);

      if (!invitation) {
        throw new InvitationUnavailableError();
      }

      const email = invitation.email.toLowerCase();
      const existingUser = await User.findOne({ email }).select("_id").session(dbSession);

      if (existingUser) {
        throw new AccountAlreadyExistsError();
      }

      const name = parsed.data.name ?? invitation.name;

      if (!name) {
        throw new InvalidAcceptanceDetailsError();
      }

      const passwordHash = await hashPassword(password);
      const claimedInvitation = await Invitation.findOneAndUpdate(
        { _id: invitation._id, status: "pending", expiresAt: { $gt: now } },
        { $set: { status: "accepted", acceptedAt: now } },
        { new: true, session: dbSession },
      );

      if (!claimedInvitation) {
        throw new InvitationUnavailableError();
      }

      const userId = new mongoose.Types.ObjectId();
      await User.create(
        [
          {
            _id: userId,
            workspaceId: invitation.workspaceId,
            name,
            email,
            passwordHash,
            role: invitation.role,
          },
        ],
        { session: dbSession },
      );

      acceptedUser = {
        id: userId.toString(),
        name,
        email,
        role: invitation.role,
      };
    });

    if (!acceptedUser) {
      throw new Error("Invitation acceptance transaction did not create a user.");
    }

    return NextResponse.json(
      { success: true, data: { user: acceptedUser } },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof InvitationUnavailableError) {
      return errorResponse(
        410,
        "INVITATION_UNAVAILABLE",
        "This invitation is invalid, expired, revoked, or already accepted.",
      );
    }

    if (error instanceof AccountAlreadyExistsError || isDuplicateEmailError(error)) {
      return errorResponse(
        409,
        "ACCOUNT_ALREADY_EXISTS",
        "An account already uses this email and cannot join another workspace.",
      );
    }

    if (error instanceof InvalidAcceptanceDetailsError) {
      return errorResponse(400, "NAME_REQUIRED", "Enter your name to accept this invitation.");
    }

    return errorResponse(
      503,
      "SERVICE_UNAVAILABLE",
      "Invitation acceptance is temporarily unavailable.",
    );
  } finally {
    await session?.endSession();
  }
}

function isDuplicateEmailError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000 &&
    "keyPattern" in error &&
    typeof error.keyPattern === "object" &&
    error.keyPattern !== null &&
    "email" in error.keyPattern
  );
}
