import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { canAccessProject } from "@/lib/auth/project-access";
import { hasCompanyRole } from "@/lib/auth/company-role";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { workspaceScopedFilter } from "@/lib/auth/workspace-scope";
import { connectToDatabase } from "@/lib/db/mongoose";
import { createProjectMemberSchema } from "@/lib/validation/project-member";
import { Project } from "@/models/Project";
import { ProjectMember } from "@/models/ProjectMember";
import { User } from "@/models/User";

type RouteContext = { params: Promise<{ projectId: string }> };

function errorResponse(status: number, code: string, message: string): Response {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function isDuplicateMembershipError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error) || error.code !== 11000) {
    return false;
  }

  return (
    "keyPattern" in error &&
    typeof error.keyPattern === "object" &&
    error.keyPattern !== null &&
    "workspaceId" in error.keyPattern &&
    "projectId" in error.keyPattern &&
    "userId" in error.keyPattern
  );
}

async function getAuthorizedProject(
  context: NonNullable<Awaited<ReturnType<typeof getWorkspaceContext>>>,
  projectId: string,
  includeProjectMember = false,
) {
  const project = await Project.findOne(workspaceScopedFilter(context, { _id: projectId })).select(
    "_id workspaceId projectManagerId",
  );

  if (!project) {
    return null;
  }

  let isProjectMember = false;

  if (includeProjectMember && hasCompanyRole(context, "developer", "designer")) {
    const membership = await ProjectMember.findOne(
      workspaceScopedFilter(context, { projectId: project._id, userId: context.userId }),
    )
      .select("_id")
      .lean();
    isProjectMember = Boolean(membership);
  }

  if (!canAccessProject(context, project, isProjectMember)) {
    return null;
  }

  return project;
}

export async function GET(request: Request, { params }: RouteContext): Promise<Response> {
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
    const project = await getAuthorizedProject(context, projectId, true);

    if (!project) {
      return errorResponse(404, "NOT_FOUND", "Project not found.");
    }

    const memberships = await ProjectMember.find(
      workspaceScopedFilter(context, { projectId: project._id }),
    )
      .select("userId addedBy createdAt")
      .sort({ createdAt: 1, _id: 1 })
      .lean();
    const users = await User.find(
      workspaceScopedFilter(context, { _id: { $in: memberships.map(({ userId }) => userId) } }),
    )
      .select("_id name email role status avatarUrl")
      .lean();
    const usersById = new Map(users.map((user) => [user._id.toString(), user]));
    const members = memberships.flatMap((membership) => {
      const user = usersById.get(membership.userId.toString());

      if (!user) {
        return [];
      }

      return [
        {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          avatarUrl: user.avatarUrl ?? null,
          addedBy: membership.addedBy.toString(),
          addedAt: membership.createdAt.toISOString(),
        },
      ];
    });

    const url = new URL(request.url);
    const includeAvailable = url.searchParams.get("available") === "true";

    if (includeAvailable) {
      if (!hasCompanyRole(context, "admin", "project_manager")) {
        return errorResponse(403, "FORBIDDEN", "You cannot manage project members.");
      }

      const availableUsers = await User.find(
        workspaceScopedFilter(context, {
          role: { $in: ["developer", "designer"] },
          status: "active",
          _id: { $nin: memberships.map(({ userId }) => userId) },
        }),
      )
        .select("_id name email role status avatarUrl")
        .sort({ name: 1, _id: 1 })
        .lean();

      return NextResponse.json(
        {
          success: true,
          data: {
            members,
            availableMembers: availableUsers.map((user) => ({
              id: user._id.toString(),
              name: user.name,
              email: user.email,
              role: user.role,
              status: user.status,
              avatarUrl: user.avatarUrl ?? null,
            })),
          },
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { success: true, data: { members } },
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

export async function POST(request: Request, { params }: RouteContext): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = createProjectMemberSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Select a valid workspace member.",
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
      return errorResponse(403, "FORBIDDEN", "You cannot manage project members.");
    }

    const { projectId } = await params;

    if (!mongoose.isValidObjectId(projectId)) {
      return errorResponse(404, "NOT_FOUND", "Project not found.");
    }

    await connectToDatabase();
    const project = await getAuthorizedProject(context, projectId);

    if (!project) {
      return errorResponse(404, "NOT_FOUND", "Project not found.");
    }

    const user = await User.findOne(
      workspaceScopedFilter(context, {
        _id: parsed.data.userId,
        role: { $in: ["developer", "designer"] },
        status: "active",
      }),
    ).select("_id name email role status avatarUrl");

    if (!user) {
      return errorResponse(
        400,
        "INVALID_PROJECT_MEMBER",
        "Select an active Developer or Designer from this workspace.",
      );
    }

    const membership = await ProjectMember.create({
      workspaceId: context.workspaceId,
      projectId: project._id,
      userId: user._id,
      addedBy: context.userId,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          member: {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            avatarUrl: user.avatarUrl ?? null,
            addedBy: membership.addedBy.toString(),
            addedAt: membership.createdAt.toISOString(),
          },
        },
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (isDuplicateMembershipError(error)) {
      return errorResponse(
        409,
        "PROJECT_MEMBER_ALREADY_EXISTS",
        "This user is already a member of the project.",
      );
    }

    return errorResponse(
      503,
      "SERVICE_UNAVAILABLE",
      "Project members are temporarily unavailable.",
    );
  }
}
