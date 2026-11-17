import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { verifyPassword } from "@/lib/auth/password";
import { connectToDatabase } from "@/lib/db/mongoose";
import { credentialsSchema } from "@/lib/validation/auth";
import { USER_ROLES, User, type CompanyRole } from "@/models/User";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        await connectToDatabase();
        const user = await User.findOne({ email: parsed.data.email }).select("+passwordHash");

        if (!user || user.status !== "active" || !user.passwordHash) {
          return null;
        }

        const validPassword = await verifyPassword(parsed.data.password, user.passwordHash);

        if (!validPassword) {
          return null;
        }

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          workspaceId: user.workspaceId.toString(),
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.workspaceId = user.workspaceId;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";

        if (typeof token.role === "string" && USER_ROLES.includes(token.role as CompanyRole)) {
          session.user.role = token.role as CompanyRole;
        }

        if (typeof token.workspaceId === "string") {
          session.user.workspaceId = token.workspaceId;
        }
      }

      return session;
    },
  },
});
