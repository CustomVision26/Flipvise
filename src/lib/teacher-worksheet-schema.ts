import { z } from "zod";

export const teacherWorksheetInputSchema = z.object({
  deckId: z.number().int().positive(),
  subject: z.string().min(1),
  gradeLevel: z.string().min(1),
  topic: z.string().min(1),
  worksheetType: z.string().min(1),
  difficultyLevel: z.string().min(1),
});

export type TeacherWorksheetActionInput = z.infer<typeof teacherWorksheetInputSchema>;

export type WorksheetItem = {
  questionNumber: number;
  prompt: string;
  promptImageUrl: string | null;
  answer: string;
  answerImageUrl: string | null;
  frontImageUrl: string | null;
  backImageUrl: string | null;
};

export type DeckWorksheetResult = {
  worksheetTitle: string;
  deckName: string;
  subject: string;
  gradeLevel: string;
  topic: string;
  worksheetType: string;
  difficultyLevel: string;
  instructions: string;
  studentHeader: string;
  items: WorksheetItem[];
};

const worksheetItemSchema = z.object({
  questionNumber: z.number().int().positive(),
  prompt: z.string().min(1),
  promptImageUrl: z.string().nullable(),
  answer: z.string().min(1),
  answerImageUrl: z.string().nullable(),
  frontImageUrl: z.string().nullable(),
  backImageUrl: z.string().nullable(),
});

/** Relaxed limits for teacher-edited worksheets before save. */
export const savedWorksheetResultSchema = z.object({
  worksheetTitle: z.string().min(1),
  deckName: z.string().min(1),
  subject: z.string().min(1),
  gradeLevel: z.string().min(1),
  topic: z.string().min(1),
  worksheetType: z.string().min(1),
  difficultyLevel: z.string().min(1),
  instructions: z.string().min(1),
  studentHeader: z.string().min(1),
  items: z.array(worksheetItemSchema).min(1),
});
