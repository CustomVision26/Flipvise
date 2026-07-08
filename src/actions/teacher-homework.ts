"use server";

import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAccessContext } from "@/lib/access";
import { requireTeacherToolsAccess } from "@/lib/teacher-access";
import { getCardsForDeckViewer } from "@/db/queries/cards";
import { getDeckRowById } from "@/db/queries/decks";
import { resolveSavedLessonPlanForViewer } from "@/db/queries/saved-lesson-plans";
import { saveHomeworkAssignment } from "@/db/queries/saved-homework";
import { resolveDeckViewerAccess } from "@/db/queries/teams";
import { buildDeckHomeworkContext } from "@/lib/homework-source-context";
import { buildLessonPlanQuizContext } from "@/lib/lesson-plan-quiz-context";
import {
  generateHomeworkPdfBuffer,
  homeworkPdfSafeFileName,
} from "@/lib/homework-pdf-build";
import { uploadHomeworkPdfBufferToS3 } from "@/lib/s3";
import {
  homeworkResultSchema,
  homeworkSourceTypeSchema,
  teacherHomeworkInputSchema,
  type HomeworkResult,
  type TeacherHomeworkActionInput,
} from "@/lib/teacher-homework-ai-schema";
import { generateHomework, type HomeworkInput } from "@/lib/teacher-generators";
import { normalizeHomeworkResult } from "@/lib/homework-list-items";

function buildHomeworkPrompt(
  input: TeacherHomeworkActionInput,
  sourceContext: string | null,
): string {
  const lines = [
    `Subject: ${input.subject}`,
    `Grade level: ${input.gradeLevel}`,
    `Topic: ${input.topic}`,
    `Number of questions: ${input.numberOfQuestions}`,
    `Difficulty level: ${input.difficultyLevel}`,
    `Source type: ${input.sourceType}`,
  ];

  if (input.sourceType === "deck") {
    lines.push(
      "",
      "Deck source instructions:",
      "- Base every homework question on the sample flashcards in the source material below.",
      "- Treat the sample cards as representative of the full deck — cover the same vocabulary, concepts, and skills.",
      "- Match question depth and complexity to the requested difficulty level above.",
      "- Cover vocabulary, concepts, and skills represented across the cards — not just the deck title.",
    );
  }

  if (input.sourceType === "lesson_plan") {
    lines.push(
      "",
      "Lesson plan source instructions:",
      "- Base homework questions on the lesson objectives, vocabulary, activities, and assessment samples in the source below.",
      "- Use assessment questions and homework from the plan as models for style and rigor.",
      "- Match question depth to the requested difficulty level above.",
    );
  }

  if (sourceContext?.trim()) {
    lines.push("", "Primary source material:", sourceContext.trim());
  }

  return lines.join("\n");
}

function toTemplateInput(input: TeacherHomeworkActionInput): HomeworkInput {
  return {
    subject: input.subject,
    gradeLevel: input.gradeLevel,
    topic: input.topic,
    numberOfQuestions: input.numberOfQuestions,
    difficultyLevel: input.difficultyLevel,
  };
}

async function resolveHomeworkSourceContext(
  input: TeacherHomeworkActionInput,
  userId: string,
): Promise<string | null> {
  if (input.sourceType === "lesson_plan" && input.savedLessonPlanId != null) {
    const saved = await resolveSavedLessonPlanForViewer(
      userId,
      input.savedLessonPlanId,
      input.teamId,
    );
    if (!saved) {
      throw new Error("Saved lesson plan not found.");
    }
    return buildLessonPlanQuizContext({
      input: saved.input,
      result: saved.result,
    });
  }

  if (input.sourceType === "deck" && input.deckId != null) {
    const access = await resolveDeckViewerAccess(input.deckId, userId);
    if (!access) {
      throw new Error("Deck not found or you do not have access to it.");
    }
    const deck = await getDeckRowById(input.deckId);
    if (!deck) {
      throw new Error("Deck not found.");
    }
    const cardRows = await getCardsForDeckViewer(input.deckId, userId);
    if (cardRows.length === 0) {
      throw new Error("The selected deck has no cards. Add cards first or choose another deck.");
    }
    return buildDeckHomeworkContext(deck, cardRows);
  }

  return null;
}

export async function generateHomeworkAction(
  data: TeacherHomeworkActionInput,
): Promise<HomeworkResult> {
  const ctx = await getAccessContext();
  await requireTeacherToolsAccess(
    ctx,
    "Homework Generator requires an education plan.",
  );

  const parsed = teacherHomeworkInputSchema.safeParse(data);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "Invalid input");
  }

  const input = parsed.data;
  const sourceContext = await resolveHomeworkSourceContext(input, ctx.userId!);

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return normalizeHomeworkResult(generateHomework(toTemplateInput(input)));
  }

  try {
    const { output } = await generateText({
      model: openai("gpt-4o"),
      output: Output.object({
        schema: homeworkResultSchema,
      }),
      system: `You are an expert K–12 teacher creating homework assignments with answer keys.

Requirements:
- Generate exactly ${input.numberOfQuestions} homework questions unless the source material supports fewer focused items — never exceed ${input.numberOfQuestions}.
- Questions must be specific to the subject, grade, topic, and difficulty — never generic placeholders.
- When source material is provided (lesson plan or deck flashcards), base questions primarily on that content — vocabulary, concepts, and skills from the source.
- For deck sources, derive questions from the listed sample flashcards (front/back content and multiple-choice distractors when present). Calibrate wording and rigor to the requested difficulty level (${input.difficultyLevel}).
- For lesson plan sources, draw from objectives, vocabulary, teaching steps, and assessment sample items in the plan. Calibrate to difficulty level (${input.difficultyLevel}).
- Do NOT prefix questions or answerKey entries with numbers, bullets, or labels — plain text only (numbering is added by the UI).
- instructions must tell students how to complete the assignment clearly.
- assignmentTitle should be concise and classroom-ready.
- answerKey must align one-to-one with questions (same count and order).
- Do not use markdown formatting.`,
      prompt: buildHomeworkPrompt(input, sourceContext),
    });

    if (!output) {
      throw new Error("AI homework generation returned no output.");
    }

    if (output.questions.length !== output.answerKey.length) {
      throw new Error("Homework generation returned mismatched questions and answers.");
    }

    return normalizeHomeworkResult(output);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[generateHomeworkAction] AI failed; using template fallback.", error);
    }
    return normalizeHomeworkResult(generateHomework(toTemplateInput(input)));
  }
}

const saveHomeworkSchema = z.object({
  label: z.string().min(1).max(255),
  sourceType: homeworkSourceTypeSchema,
  savedLessonPlanId: z.number().int().positive().optional(),
  deckId: z.number().int().positive().optional(),
  input: teacherHomeworkInputSchema,
  result: homeworkResultSchema,
});

export async function saveHomeworkAction(data: {
  label: string;
  sourceType: TeacherHomeworkActionInput["sourceType"];
  savedLessonPlanId?: number;
  deckId?: number;
  input: TeacherHomeworkActionInput;
  result: HomeworkResult;
}): Promise<{
  id: number;
  label: string;
  pdfUrl: string | null;
  sourceLessonPlanTitle: string | null;
  sourceDeckName: string | null;
}> {
  const ctx = await getAccessContext();
  const { userId } = await requireTeacherToolsAccess(
    ctx,
    "Homework Generator requires an education plan.",
  );

  const parsed = saveHomeworkSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid homework data");
  }

  const payload = parsed.data;
  let sourceLessonPlanTitle: string | null = null;
  let sourceDeckName: string | null = null;

  if (payload.sourceType === "lesson_plan" && payload.savedLessonPlanId != null) {
    const savedPlan = await resolveSavedLessonPlanForViewer(
      userId,
      payload.savedLessonPlanId,
      payload.input.teamId,
    );
    if (!savedPlan) {
      throw new Error("Saved lesson plan not found.");
    }
    sourceLessonPlanTitle = savedPlan.lessonTitle;
  }

  if (payload.sourceType === "deck" && payload.deckId != null) {
    const deck = await getDeckRowById(payload.deckId);
    if (!deck) {
      throw new Error("Deck not found.");
    }
    const access = await resolveDeckViewerAccess(payload.deckId, userId);
    if (!access) {
      throw new Error("You do not have access to that deck.");
    }
    sourceDeckName = deck.name;
  }

  let pdfUrl: string | null = null;
  let pdfFileName: string | null = null;

  try {
    const pdfBuffer = await generateHomeworkPdfBuffer(payload.result);
    pdfFileName = `${homeworkPdfSafeFileName(payload.result.assignmentTitle)}.pdf`;
    pdfUrl = await uploadHomeworkPdfBufferToS3({
      userId,
      fileName: pdfFileName,
      buffer: pdfBuffer,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[saveHomeworkAction] PDF upload skipped or failed; saving homework without PDF.",
        error,
      );
    }
  }

  const saved = await saveHomeworkAssignment({
    userId,
    label: payload.label.trim(),
    assignmentTitle: payload.result.assignmentTitle,
    subject: payload.input.subject,
    gradeLevel: payload.input.gradeLevel,
    topic: payload.input.topic,
    difficultyLevel: payload.input.difficultyLevel,
    sourceType: payload.sourceType,
    savedLessonPlanId: payload.savedLessonPlanId ?? null,
    sourceLessonPlanTitle,
    deckId: payload.deckId ?? null,
    sourceDeckName,
    input: {
      sourceType: payload.input.sourceType,
      savedLessonPlanId: payload.input.savedLessonPlanId,
      deckId: payload.input.deckId,
      subject: payload.input.subject,
      gradeLevel: payload.input.gradeLevel,
      topic: payload.input.topic,
      numberOfQuestions: payload.input.numberOfQuestions,
      difficultyLevel: payload.input.difficultyLevel,
    },
    result: payload.result,
    pdfUrl,
    pdfFileName,
  });

  revalidatePath("/teacher/resources");
  revalidatePath("/teacher/homework");

  return {
    id: saved.id,
    label: saved.label,
    pdfUrl: saved.pdfUrl,
    sourceLessonPlanTitle: saved.sourceLessonPlanTitle,
    sourceDeckName: saved.sourceDeckName,
  };
}
