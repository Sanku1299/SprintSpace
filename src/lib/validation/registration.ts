import { z } from "zod";

export const registerCompanySchema = z.object({
  workspaceName: z.string().trim().min(2).max(100),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(128),
});

export type RegisterCompanyInput = z.infer<typeof registerCompanySchema>;
