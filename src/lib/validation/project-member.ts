import { z } from "zod";

export const createProjectMemberSchema = z
  .object({
    userId: z.string().regex(/^[a-f\d]{24}$/i, "Select a valid workspace member."),
  })
  .strict();
