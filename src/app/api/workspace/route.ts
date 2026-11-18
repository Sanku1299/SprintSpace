import { NextResponse } from "next/server";

import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasCompanyRole } from "@/lib/auth/company-role";
import { connectToDatabase } from "@/lib/db/mongoose";
import { workspaceUpdateSchema } from "@/lib/validation/workspace";
import { Workspace } from "@/models/Workspace";

const WORKSPACE_FIELDS = "name slug description logo createdAt updatedAt";

function unauthorizedResponse(): Response {
  return NextResponse.json(
    { success: false, error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } },
    { status: 401 },
  );
}

function forbiddenResponse(): Response {
  return NextResponse.json(
    { success: false, error: { code: "FORBIDDEN", message: "You cannot perform this action." } },
    { status: 403 },
  );
}

function unavailableResponse(): Response {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Workspace service is temporarily unavailable.",
      },
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

function notFoundResponse(): Response {
  return NextResponse.json(
    { success: false, error: { code: "NOT_FOUND", message: "Workspace not found." } },
    { status: 404 },
  );
}

function toWorkspaceData(workspace: {
  _id: { toString(): string };
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: workspace._id.toString(),
    name: workspace.name,
    slug: workspace.slug,
    description: workspace.description ?? "",
    logo: workspace.logo ?? "",
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
}

export async function GET(): Promise<Response> {
  try {
    const context = await getWorkspaceContext();

    if (!context) {
      return unauthorizedResponse();
    }

    if (!hasCompanyRole(context, "admin")) {
      return forbiddenResponse();
    }

    await connectToDatabase();
    const workspace = await Workspace.findById(context.workspaceId).select(WORKSPACE_FIELDS).lean();

    if (!workspace) {
      return notFoundResponse();
    }

    return NextResponse.json(
      { success: true, data: toWorkspaceData(workspace) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return unavailableResponse();
  }
}

export async function PATCH(request: Request): Promise<Response> {
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

  const parsed = workspaceUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Review the workspace fields and try again." },
      },
      { status: 400 },
    );
  }

  try {
    const context = await getWorkspaceContext();

    if (!context) {
      return unauthorizedResponse();
    }

    if (!hasCompanyRole(context, "admin")) {
      return forbiddenResponse();
    }

    await connectToDatabase();
    const workspace = await Workspace.findByIdAndUpdate(
      context.workspaceId,
      { $set: parsed.data },
      { new: true, runValidators: true },
    )
      .select(WORKSPACE_FIELDS)
      .lean();

    if (!workspace) {
      return notFoundResponse();
    }

    return NextResponse.json(
      { success: true, data: toWorkspaceData(workspace) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return unavailableResponse();
  }
}
