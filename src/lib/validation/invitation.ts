import { z } from "zod";

const invitationRoles = ["admin", "project_manager", "developer", "designer"] as const;

export const createInvitationSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    name: z.string().trim().min(2).max(100).optional(),
    role: z.enum(invitationRoles),
  })
  .strict();

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
