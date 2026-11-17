import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { hashPassword } from "@/lib/auth/password";
import { connectToDatabase } from "@/lib/db/mongoose";
import { registerCompanySchema } from "@/lib/validation/registration";
import { User } from "@/models/User";
import { Workspace } from "@/models/Workspace";

class EmailAlreadyRegisteredError extends Error {}

function createWorkspaceSlug(workspaceName: string): string {
  const base = workspaceName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  return `${base || "workspace"}-${randomBytes(3).toString("hex")}`;
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: "INVALID_JSON", message: "Request body must be valid JSON." },
      },
      { status: 400 },
    );
  }

  const parsed = registerCompanySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Review the registration details and try again.",
          fields: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  const { workspaceName, name, email, password } = parsed.data;
  const passwordHash = await hashPassword(password);
  const userId = new mongoose.Types.ObjectId();
  const workspaceId = new mongoose.Types.ObjectId();
  const session = await (await connectToDatabase()).startSession();

  try {
    await session.withTransaction(async () => {
      const existingUser = await User.findOne({ email }).select("_id").session(session);

      if (existingUser) {
        throw new EmailAlreadyRegisteredError();
      }

      await Workspace.create(
        [
          {
            _id: workspaceId,
            name: workspaceName,
            slug: createWorkspaceSlug(workspaceName),
            createdBy: userId,
          },
        ],
        { session },
      );

      await User.create(
        [
          {
            _id: userId,
            workspaceId,
            name,
            email,
            passwordHash,
            role: "admin",
          },
        ],
        { session },
      );
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          workspace: { id: workspaceId.toString(), name: workspaceName },
          user: { id: userId.toString(), name, email, role: "admin" },
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof EmailAlreadyRegisteredError || isDuplicateEmailError(error)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "EMAIL_ALREADY_REGISTERED",
            message: "An account already uses this email.",
          },
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "REGISTRATION_UNAVAILABLE",
          message: "Company registration is temporarily unavailable.",
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  } finally {
    await session.endSession();
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
