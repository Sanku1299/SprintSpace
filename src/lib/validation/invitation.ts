import { z } from "zod";

const invitationRoles = ["admin", "project_manager", "developer", "designer"] as const;

export const createInvitationSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    name: z.string().trim().min(2).max(100).optional(),
    role: z.enum(invitationRoles),
  })
  .strict();

export const acceptInvitationSchema = z
  .object({
    token: z.string().min(32).max(128),
    name: z.string().trim().min(2).max(100).optional(),
    password: z.string().min(12).max(128),
  })
  .strict();

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
