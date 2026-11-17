import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
});

export type CredentialsInput = z.infer<typeof credentialsSchema>;
