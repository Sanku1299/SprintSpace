import { NextResponse } from "next/server";

import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasCompanyRole } from "@/lib/auth/company-role";
import { workspaceScopedFilter } from "@/lib/auth/workspace-scope";
import { connectToDatabase } from "@/lib/db/mongoose";
import { createProjectSchema } from "@/lib/validation/project";
import { Project } from "@/models/Project";
import { User } from "@/models/User";

function errorResponse(status: number, code: string, message: string): Response {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function isDuplicateProjectKeyError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error) || error.code !== 11000) {
    return false;
  }

  if (!("keyPattern" in error) || typeof error.keyPattern !== "object" || !error.keyPattern) {
    return false;
  }

  return "workspaceId" in error.keyPattern && "key" in error.keyPattern;
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = createProjectSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Review the project details and try again.",
          fields: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const context = await getWorkspaceContext();

    if (!context) {
      return errorResponse(401, "UNAUTHENTICATED", "Sign in to continue.");
    }

    if (!hasCompanyRole(context, "admin", "project_manager")) {
      return errorResponse(403, "FORBIDDEN", "You cannot create projects.");
    }

    if (context.role === "project_manager" && parsed.data.projectManagerId !== context.userId) {
      return errorResponse(
        403,
        "FORBIDDEN",
        "Project Managers can create only their own projects.",
      );
    }

    await connectToDatabase();

    const projectManager = await User.findOne(
      workspaceScopedFilter(context, {
        _id: parsed.data.projectManagerId,
        role: "project_manager",
        status: "active",
      }),
    ).select("_id");

    if (!projectManager) {
      return errorResponse(
        400,
        "INVALID_PROJECT_MANAGER",
        "Select an active Project Manager from this workspace.",
      );
    }

    const existingProject = await Project.findOne(
      workspaceScopedFilter(context, { key: parsed.data.key }),
    ).select("_id");

    if (existingProject) {
      return errorResponse(
        409,
        "PROJECT_KEY_ALREADY_EXISTS",
        "This project key is already in use.",
      );
    }

    const project = await Project.create({
      ...parsed.data,
      workspaceId: context.workspaceId,
      createdBy: context.userId,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          project: {
            id: project._id.toString(),
            workspaceId: project.workspaceId.toString(),
            name: project.name,
            key: project.key,
            description: project.description ?? "",
            status: project.status,
            priority: project.priority,
            projectManagerId: project.projectManagerId.toString(),
            startDate: project.startDate?.toISOString() ?? null,
            endDate: project.endDate?.toISOString() ?? null,
            createdBy: project.createdBy.toString(),
            createdAt: project.createdAt.toISOString(),
            updatedAt: project.updatedAt.toISOString(),
          },
        },
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (isDuplicateProjectKeyError(error)) {
      return errorResponse(
        409,
        "PROJECT_KEY_ALREADY_EXISTS",
        "This project key is already in use.",
      );
    }

    return errorResponse(503, "SERVICE_UNAVAILABLE", "Project service is temporarily unavailable.");
  }
}
