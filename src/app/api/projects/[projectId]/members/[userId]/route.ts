import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { canAccessProject } from "@/lib/auth/project-access";
import { hasCompanyRole } from "@/lib/auth/company-role";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { workspaceScopedFilter } from "@/lib/auth/workspace-scope";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Project } from "@/models/Project";
import { ProjectMember } from "@/models/ProjectMember";

type RouteContext = { params: Promise<{ projectId: string; userId: string }> };

function errorResponse(status: number, code: string, message: string): Response {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(_request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const context = await getWorkspaceContext();

    if (!context) {
      return errorResponse(401, "UNAUTHENTICATED", "Sign in to continue.");
    }

    if (!hasCompanyRole(context, "admin", "project_manager")) {
      return errorResponse(403, "FORBIDDEN", "You cannot manage project members.");
    }

    const { projectId, userId } = await params;

    if (!mongoose.isValidObjectId(projectId)) {
      return errorResponse(404, "NOT_FOUND", "Project not found.");
    }

    if (!mongoose.isValidObjectId(userId)) {
      return errorResponse(404, "MEMBER_NOT_FOUND", "Project member not found.");
    }

    await connectToDatabase();
    const project = await Project.findOne(
      workspaceScopedFilter(context, { _id: projectId }),
    ).select("_id workspaceId projectManagerId");

    if (!project || !canAccessProject(context, project)) {
      return errorResponse(404, "NOT_FOUND", "Project not found.");
    }

    const result = await ProjectMember.deleteOne(
      workspaceScopedFilter(context, { projectId: project._id, userId }),
    );

    if (result.deletedCount === 0) {
      return errorResponse(404, "MEMBER_NOT_FOUND", "Project member not found.");
    }

    return NextResponse.json(
      { success: true, data: { removedUserId: userId } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return errorResponse(
      503,
      "SERVICE_UNAVAILABLE",
      "Project members are temporarily unavailable.",
    );
  }
}
