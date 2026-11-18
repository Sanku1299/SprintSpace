import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { canAccessProject } from "@/lib/auth/project-access";
import { hasCompanyRole } from "@/lib/auth/company-role";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { workspaceScopedFilter } from "@/lib/auth/workspace-scope";
import { connectToDatabase } from "@/lib/db/mongoose";
import { updateProjectSchema } from "@/lib/validation/project";
import { Project } from "@/models/Project";
import { ProjectMember } from "@/models/ProjectMember";
import { User } from "@/models/User";

type RouteContext = { params: Promise<{ projectId: string }> };

const PROJECT_FIELDS =
  "_id workspaceId name key description status priority projectManagerId startDate endDate createdBy createdAt updatedAt";

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

function toProjectDetails(project: {
  _id: { toString(): string };
  workspaceId: { toString(): string };
  name: string;
  key: string;
  description?: string;
  status: string;
  priority: string;
  projectManagerId: { toString(): string };
  startDate?: Date | null;
  endDate?: Date | null;
  createdBy: { toString(): string };
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
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
  };
}

async function canViewProject(
  context: NonNullable<Awaited<ReturnType<typeof getWorkspaceContext>>>,
  project: {
    _id: { toString(): string };
    workspaceId: { toString(): string };
    projectManagerId: { toString(): string };
  },
): Promise<boolean> {
  let isProjectMember = false;

  if (hasCompanyRole(context, "developer", "designer")) {
    const membership = await ProjectMember.findOne(
      workspaceScopedFilter(context, { projectId: project._id, userId: context.userId }),
    )
      .select("_id")
      .lean();
    isProjectMember = Boolean(membership);
  }

  return canAccessProject(context, project, isProjectMember);
}

export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const context = await getWorkspaceContext();

    if (!context) {
      return errorResponse(401, "UNAUTHENTICATED", "Sign in to continue.");
    }

    const { projectId } = await params;

    if (!mongoose.isValidObjectId(projectId)) {
      return errorResponse(404, "NOT_FOUND", "Project not found.");
    }

    await connectToDatabase();
    const project = await Project.findOne(workspaceScopedFilter(context, { _id: projectId }))
      .select(PROJECT_FIELDS)
      .lean();

    if (!project || !(await canViewProject(context, project))) {
      return errorResponse(404, "NOT_FOUND", "Project not found.");
    }

    return NextResponse.json(
      { success: true, data: { project: toProjectDetails(project) } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return errorResponse(503, "SERVICE_UNAVAILABLE", "Project service is temporarily unavailable.");
  }
}

export async function PATCH(request: Request, { params }: RouteContext): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = updateProjectSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Review the project fields and try again.",
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
      return errorResponse(403, "FORBIDDEN", "You cannot update projects.");
    }

    const { projectId } = await params;

    if (!mongoose.isValidObjectId(projectId)) {
      return errorResponse(404, "NOT_FOUND", "Project not found.");
    }

    await connectToDatabase();
    const project = await Project.findOne(
      workspaceScopedFilter(context, { _id: projectId }),
    ).select("_id workspaceId projectManagerId startDate endDate");

    if (!project) {
      return errorResponse(404, "NOT_FOUND", "Project not found.");
    }

    if (!canAccessProject(context, project)) {
      return errorResponse(404, "NOT_FOUND", "Project not found.");
    }

    if (
      context.role === "project_manager" &&
      parsed.data.projectManagerId !== undefined &&
      parsed.data.projectManagerId !== project.projectManagerId.toString()
    ) {
      return errorResponse(403, "FORBIDDEN", "Only an Admin can reassign a project's PM.");
    }

    if (
      context.role === "admin" &&
      parsed.data.projectManagerId !== undefined &&
      parsed.data.projectManagerId !== project.projectManagerId.toString()
    ) {
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
    }

    const startDate =
      parsed.data.startDate === undefined ? project.startDate : parsed.data.startDate;
    const endDate = parsed.data.endDate === undefined ? project.endDate : parsed.data.endDate;

    if (startDate && endDate && endDate < startDate) {
      return errorResponse(
        400,
        "INVALID_DATE_RANGE",
        "End date must be on or after the start date.",
      );
    }

    const updateFilter =
      context.role === "project_manager"
        ? workspaceScopedFilter(context, { _id: projectId, projectManagerId: context.userId })
        : workspaceScopedFilter(context, { _id: projectId });
    const updatedProject = await Project.findOneAndUpdate(
      updateFilter,
      { $set: parsed.data },
      { new: true, runValidators: true },
    ).select(PROJECT_FIELDS);

    if (!updatedProject) {
      return errorResponse(404, "NOT_FOUND", "Project not found.");
    }

    return NextResponse.json(
      { success: true, data: { project: toProjectDetails(updatedProject) } },
      { headers: { "Cache-Control": "no-store" } },
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
