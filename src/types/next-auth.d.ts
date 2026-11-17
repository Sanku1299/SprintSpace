import type { DefaultSession } from "next-auth";

type CompanyRole = "admin" | "project_manager" | "developer" | "designer";

declare module "next-auth" {
  interface User {
    role: CompanyRole;
    workspaceId: string;
  }

  interface Session {
    user: {
      id: string;
      role: CompanyRole;
      workspaceId: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: CompanyRole;
    workspaceId?: string;
  }
}
