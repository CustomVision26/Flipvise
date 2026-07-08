import { z } from "zod";

export const registerTeacherStudentSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required.").max(255),
  email: z.string().trim().email("Enter a valid email.").max(255),
  telephone: z.string().trim().max(64).optional().or(z.literal("")),
});

export type RegisterTeacherStudentInput = z.infer<typeof registerTeacherStudentSchema>;
