"use server";

import { AuthError } from "next-auth";

import { signIn, signOut } from "../../../../auth";
import { credentialsSchema } from "@/lib/validation/auth";

export type LoginState = {
  error?: string;
};

export async function loginAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid email and password." };
  }

  try {
    await signIn("credentials", {
      ...parsed.data,
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Email or password is incorrect." };
    }

    throw error;
  }

  return {};
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
