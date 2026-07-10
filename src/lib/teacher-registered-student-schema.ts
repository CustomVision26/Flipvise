import { z } from "zod";

export const registerTeacherStudentSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required.").max(255),
  email: z.string().trim().email("Enter a valid email.").max(255),
  telephone: z.string().trim().max(64).optional().or(z.literal("")),
  classId: z.coerce
    .number()
    .int()
    .positive("Select a class for this student.")
    .optional(),
});

export const updateTeacherStudentSchema = registerTeacherStudentSchema.extend({
  studentId: z.coerce.number().int().positive("Student not found."),
});

export const registerWorkspaceInviteeStudentSchema = z.object({
  teamId: z.coerce.number().int().positive("Workspace not found."),
  inviteeKey: z.string().trim().min(1, "Select a workspace student."),
  classId: z.coerce
    .number()
    .int()
    .positive("Select a class for this student.")
    .optional(),
});

export type RegisterTeacherStudentInput = z.infer<typeof registerTeacherStudentSchema>;
export type UpdateTeacherStudentInput = z.infer<typeof updateTeacherStudentSchema>;
export type RegisterWorkspaceInviteeStudentInput = z.infer<
  typeof registerWorkspaceInviteeStudentSchema
>;
