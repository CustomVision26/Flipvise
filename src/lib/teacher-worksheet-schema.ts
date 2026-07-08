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
