import { z } from "zod";

export const teacherManualGradeTypeSchema = z.enum(["assignment", "quiz"]);

export const createTeacherManualGradeSchema = z.object({
  teamId: z.number().int().positive().optional(),
  gradeType: teacherManualGradeTypeSchema.default("assignment"),
  studentName: z.string().trim().min(1, "Student name is required.").max(255),
  studentEmail: z.string().trim().email("Enter a valid email.").max(255).optional().or(z.literal("")),
  assignmentTitle: z.string().trim().min(1, "Assignment title is required.").max(512),
  grade: z.string().trim().min(1, "Grade is required.").max(32),
  maxGrade: z.string().trim().max(32).optional().or(z.literal("")),
  subject: z.string().trim().max(255).optional().or(z.literal("")),
  academicYear: z.string().trim().min(1, "Academic year is required.").max(64),
  termSemester: z.string().trim().min(1, "Term is required.").max(128),
  period: z.string().trim().max(64).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const updateTeacherManualGradeSchema = createTeacherManualGradeSchema.extend({
  gradeId: z.coerce.number().int().positive("Grade record not found."),
});

export type CreateTeacherManualGradeInput = z.infer<typeof createTeacherManualGradeSchema>;
export type UpdateTeacherManualGradeInput = z.infer<typeof updateTeacherManualGradeSchema>;

export const teacherStudentReportFilterSchema = z.object({
  academicYear: z.string().trim().max(64).optional(),
  termSemester: z.string().trim().max(128).optional(),
  period: z.string().trim().max(64).optional(),
  studentName: z.string().trim().max(255).optional(),
});

export type TeacherStudentReportFilterInput = z.infer<
  typeof teacherStudentReportFilterSchema
>;
