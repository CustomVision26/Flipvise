import { z } from "zod";

export const createTeacherClassSchema = z.object({
  academicYear: z.string().trim().min(1, "Academic year is required.").max(64),
  termSemester: z.string().trim().min(1, "Term / semester is required.").max(128),
  week: z.string().trim().min(1, "Week is required.").max(64),
  day: z.string().trim().min(1, "Day is required.").max(64),
  period: z.string().trim().min(1, "Period is required.").max(64),
  deckId: z.number().int().positive("Select a deck."),
  teamId: z.number().int().positive().nullable().optional(),
});

export type CreateTeacherClassInput = z.infer<typeof createTeacherClassSchema>;
