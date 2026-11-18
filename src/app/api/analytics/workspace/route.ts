import { NextResponse } from "next/server";

import { hasCompanyRole } from "@/lib/auth/company-role";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { workspaceScopedFilter } from "@/lib/auth/workspace-scope";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Project } from "@/models/Project";
import { Task } from "@/models/Task";
import { User } from "@/models/User";

export async function GET(): Promise<Response> {
  try {
    const context = await getWorkspaceContext();
    if (!context)
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHENTICATED", message: "Sign in to continue." } },
        { status: 401 },
      );
    if (!hasCompanyRole(context, "admin"))
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Admin access is required." } },
        { status: 403 },
      );
    await connectToDatabase();
    const scope = workspaceScopedFilter(context, {});
    const [membersByRole, projectsByStatus, tasksByStatus, overdueTasks] = await Promise.all([
      User.aggregate([
        { $match: scope },
        { $group: { _id: "$role", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Project.aggregate([
        { $match: scope },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Task.aggregate([
        { $match: scope },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Task.countDocuments({ ...scope, dueDate: { $lt: new Date() }, status: { $ne: "done" } }),
    ]);
    return NextResponse.json(
      {
        success: true,
        data: {
          membersByRole: membersByRole.map((row: { _id: string; count: number }) => ({
            role: row._id,
            count: row.count,
          })),
          projectsByStatus: projectsByStatus.map((row: { _id: string; count: number }) => ({
            status: row._id,
            count: row.count,
          })),
          tasksByStatus: tasksByStatus.map((row: { _id: string; count: number }) => ({
            status: row._id,
            count: row.count,
          })),
          overdueTasks,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Workspace analytics are temporarily unavailable.",
        },
      },
      { status: 503 },
    );
  }
}
