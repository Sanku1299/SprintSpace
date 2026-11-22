import { NextResponse } from "next/server";

import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasCompanyRole } from "@/lib/auth/company-role";
import { getAdminDashboardMetrics } from "@/lib/dashboard/admin-metrics";

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
    const data = await getAdminDashboardMetrics(context.workspaceId);
    return NextResponse.json(
      {
        success: true,
        data,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Dashboard metrics are temporarily unavailable.",
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
