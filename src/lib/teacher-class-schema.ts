import { z } from "zod";

export const TEACHER_CLASS_PERIOD_MAX_LENGTH = 512;

export const createTeacherClassSchema = z.object({
  academicYear: z.string().trim().min(1, "Academic year is required.").max(64),
  termSemester: z.string().trim().min(1, "Term / semester is required.").max(128),
  week: z.string().trim().min(1, "Week is required.").max(64),
  day: z.string().trim().min(1, "Day is required.").max(64),
  period: z
    .string()
    .trim()
    .min(1, "Period is required.")
    .max(TEACHER_CLASS_PERIOD_MAX_LENGTH),
  deckId: z.number().int().positive("Select a deck."),
  teamId: z.number().int().positive().nullable().optional(),
});

export type CreateTeacherClassInput = z.infer<typeof createTeacherClassSchema>;

export const updateTeacherClassSchema = createTeacherClassSchema.extend({
  classId: z.number().int().positive("Class not found."),
});

export type UpdateTeacherClassInput = z.infer<typeof updateTeacherClassSchema>;
