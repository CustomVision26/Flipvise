"use server";

import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAccessContext } from "@/lib/access";
import { requireTeacherToolsAccess } from "@/lib/teacher-access";
import { getCardsForDeckViewer } from "@/db/queries/cards";
import { getDeckRowById } from "@/db/queries/decks";
import {
  resolveSavedLessonPlanForViewer,
  getSavedLessonPlansByUser,
  mapSavedLessonPlanRowToPickerItem,
} from "@/db/queries/saved-lesson-plans";
import {
  resolveSavedHomeworkForViewer,
  saveHomeworkAssignment,
  updateSavedHomeworkById,
  type SavedHomeworkPickerItem,
} from "@/db/queries/saved-homework";
import { homeworkMatchesSavedLessonPlan } from "@/lib/homework-lesson-plan-link";
import { resolveDeckViewerAccess } from "@/db/queries/teams";
import { buildDeckHomeworkContext } from "@/lib/homework-source-context";
import { buildLessonPlanQuizContext, getLessonPlanVocabularyTermsForScope } from "@/lib/lesson-plan-quiz-context";
import {
  generateHomeworkPdfBuffer,
  homeworkPdfSafeFileName,
} from "@/lib/homework-pdf-build";
import { uploadHomeworkPdfBufferToS3, deleteFromS3 } from "@/lib/s3";
import { resolveReferenceMaterialsForHomeworkSource } from "@/lib/resolve-saved-resource-references";
import {
  homeworkResultSchema,
  homeworkSourceTypeSchema,
  homeworkNeedsReadingPassage,
  teacherHomeworkInputSchema,
  type HomeworkResult,
  type TeacherHomeworkActionInput,
} from "@/lib/teacher-homework-ai-schema";
import { generateHomework, type HomeworkInput } from "@/lib/teacher-generators";
import { normalizeHomeworkResult } from "@/lib/homework-list-items";
import {
  buildEnglishHomeworkPassageRules,
  buildGeneralHomeworkPassageRules,
} from "@/lib/homework-reading-passage";
import { detectQuizSubjectArea } from "@/lib/teacher-quiz-reading-passage";
import {
  buildGenerationTitleSourceSuffix,
  parseLessonScopeLabelFromDescription,
  shortenTeacherTitleSegment,
  withTitleSourceSuffix,
} from "@/lib/teacher-generation-titles";

async function applyHomeworkSourceTitle(
  input: TeacherHomeworkActionInput,
  result: HomeworkResult,
): Promise<HomeworkResult> {
  let deckName: string | null = null;
  let deckLessonScopeLabel: string | null = null;

  if (input.sourceType === "deck" && input.deckId != null) {
    const deck = await getDeckRowById(input.deckId);
    deckName = deck?.name ?? null;
    deckLessonScopeLabel = parseLessonScopeLabelFromDescription(deck?.description);
  }

  const includeDayScope =
    input.sourceType === "lesson_plan" && input.dayScope != null;

  const suffix = buildGenerationTitleSourceSuffix({
    sourceType: input.sourceType,
    dayScope: includeDayScope ? input.dayScope : null,
    deckName,
    deckLessonScopeLabel,
  });

  return {
    ...result,
    assignmentTitle: withTitleSourceSuffix(
      shortenTeacherTitleSegment(result.assignmentTitle, 72),
      suffix,
    ),
  };
}

function buildHomeworkPrompt(
  input: TeacherHomeworkActionInput,
  sourceContext: string | null,
  vocabularyTerms: string[] = [],
): string {
  const numberOfPassages = input.numberOfPassages ?? 1;
  const questionsPerPassage =
    input.questionsPerPassage ?? input.numberOfQuestions;
  const lines = [
    `Subject: ${input.subject}`,
    `Grade level: ${input.gradeLevel}`,
    `Topic: ${input.topic}`,
    `Number of questions: ${input.numberOfQuestions}`,
    `Difficulty level: ${input.difficultyLevel}`,
    `Source type: ${input.sourceType}`,
  ];

  if (input.numberOfPassages != null && input.questionsPerPassage != null) {
    lines.push(
      `Number of passages: ${numberOfPassages}`,
      `Questions per passage: ${questionsPerPassage}`,
    );
  }

  if (vocabularyTerms.length > 0) {
    lines.push(
      "",
      "Priority vocabulary TERMS (use these in the problems):",
      ...vocabularyTerms.map((term) => `- ${term}`),
    );
  }

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
      "- Prefer concrete practice items students can solve using the listed vocabulary TERMS.",
    );
  }

  if (homeworkNeedsReadingPassage(input.subject, input.topic)) {
    lines.push(
      "",
      "Reading passage requirement:",
      `- Generate exactly ${numberOfPassages} distinct passage${numberOfPassages === 1 ? "" : "s"} with exactly ${questionsPerPassage} question${questionsPerPassage === 1 ? "" : "s"} each.`,
      "- Populate the passages array and passageQuestionCounts; flatten questions/answerKey in passage order.",
    );
  }

  if (sourceContext?.trim()) {
    lines.push("", "Primary source material:", sourceContext.trim());
  }

  return lines.join("\n");
}

function toTemplateInput(
  input: TeacherHomeworkActionInput,
  vocabularyTerms?: string[],
): HomeworkInput {
  return {
    subject: input.subject,
    gradeLevel: input.gradeLevel,
    topic: input.topic,
    numberOfQuestions: input.numberOfQuestions,
    difficultyLevel: input.difficultyLevel,
    numberOfPassages: input.numberOfPassages,
    questionsPerPassage: input.questionsPerPassage,
    vocabularyTerms,
  };
}

async function resolveHomeworkSourceContext(
  input: TeacherHomeworkActionInput,
  userId: string,
): Promise<{
  context: string | null;
  vocabularyTerms: string[];
}> {
  if (input.sourceType === "lesson_plan" && input.savedLessonPlanId != null) {
    const saved = await resolveSavedLessonPlanForViewer(
      userId,
      input.savedLessonPlanId,
      input.teamId,
    );
    if (!saved) {
      throw new Error("Saved lesson plan not found.");
    }
    const dayScope = input.dayScope ?? "all";
    if (dayScope !== "all") {
      const scheduleLength = saved.result.weeklySchedule?.length ?? 0;
      if (dayScope.dayIndex >= scheduleLength) {
        throw new Error(
          "Selected lesson-plan day is not available on this plan. Choose All Days or another day.",
        );
      }
    }
    return {
      context: buildLessonPlanQuizContext({
        input: saved.input,
        result: saved.result,
        referencePurpose: "homework",
        dayScope,
      }),
      vocabularyTerms: getLessonPlanVocabularyTermsForScope(saved.result, dayScope),
    };
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
    return {
      context: buildDeckHomeworkContext(deck, cardRows),
      vocabularyTerms: cardRows
        .map((card) => card.front?.trim())
        .filter((front): front is string => Boolean(front))
        .slice(0, 16),
    };
  }

  return { context: null, vocabularyTerms: [] };
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
  const {
    context: sourceContext,
    vocabularyTerms,
  } = await resolveHomeworkSourceContext(input, ctx.userId!);
  const needsPassage = homeworkNeedsReadingPassage(input.subject, input.topic);
  const numberOfPassages = input.numberOfPassages ?? (needsPassage ? 1 : 1);
  const questionsPerPassage =
    input.questionsPerPassage ??
    (needsPassage ? input.numberOfQuestions : input.numberOfQuestions);
  const passageRules = needsPassage
    ? detectQuizSubjectArea(input.subject, input.topic) === "english"
      ? buildEnglishHomeworkPassageRules(
          input.gradeLevel,
          numberOfPassages,
          questionsPerPassage,
        )
      : buildGeneralHomeworkPassageRules(
          input.gradeLevel,
          numberOfPassages,
          questionsPerPassage,
        )
    : `- This is NOT a reading-passage assignment. Set passages, passageQuestionCounts, passageTitle, and passage to null.
- Write concrete solvable practice problems (not placeholders like "Practice problem on…").
- When vocabulary/source material is provided, every question must use those terms or skills.`;

  async function finalizeHomeworkResult(result: HomeworkResult): Promise<HomeworkResult> {
    return applyHomeworkSourceTitle(input, normalizeHomeworkResult(result));
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return finalizeHomeworkResult(
      generateHomework(toTemplateInput(input, vocabularyTerms)),
    );
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
- Questions must be specific, solvable classroom problems for the subject, grade, topic, and difficulty — NEVER generic placeholders such as "Practice problem on…" or "Sample solution for…".
- When source material is provided (lesson plan or deck flashcards), base questions primarily on that content — vocabulary TERMS, concepts, and skills from the source.
- For Mathematics / Algebra: write real expressions, equations, inequalities, or word problems students can solve; include numbers and require shown work where appropriate. Answer key must include the worked solution or final answer.
- When a question asks students to graph on a number line or coordinate plane, ALSO fill answerGraphs[i] with a figure (do not only describe the graph in words):
  - Number line (e.g. x > 6): type "number_line", lineMin/lineMax covering the mark (e.g. 0 and 12), markValue 6, markStyle "open" for < or > and "closed" for ≤ or ≥, shadeDirection "right" or "left".
  - Coordinate plane: type "coordinate_graph" with xMin/xMax/yMin/yMax and points and/or lines.
  - Non-graph answers: type "none" with other graph fields null.
- answerGraphs must be the same length as answerKey (one entry per answer). If no answer needs a graph, set answerGraphs to null.
- For deck sources, derive questions from the listed sample flashcards (front/back content and multiple-choice distractors when present). Calibrate wording and rigor to the requested difficulty level (${input.difficultyLevel}).
- For lesson plan sources, draw from objectives, vocabulary, teaching steps, and assessment sample items in the plan. Calibrate to difficulty level (${input.difficultyLevel}).
- Do NOT prefix questions or answerKey entries with numbers, bullets, or labels — plain text only (numbering is added by the UI).
- instructions must tell students how to complete the assignment clearly.
- assignmentTitle should be concise and classroom-ready.
- answerKey must align one-to-one with questions (same count and order).
- Do not use markdown formatting.
${passageRules}`,
      prompt: buildHomeworkPrompt(input, sourceContext, vocabularyTerms),
    });

    if (!output) {
      throw new Error("AI homework generation returned no output.");
    }

    if (output.questions.length !== output.answerKey.length) {
      throw new Error("Homework generation returned mismatched questions and answers.");
    }

    const normalized = normalizeHomeworkResult(output);
    if (needsPassage && !(normalized.passages?.length || normalized.passage?.trim())) {
      throw new Error(
        "Homework generation omitted the reading passage. Please try Generate again.",
      );
    }
    if (
      needsPassage &&
      input.numberOfPassages != null &&
      (normalized.passages?.length ?? 0) < input.numberOfPassages &&
      !(input.numberOfPassages === 1 && normalized.passage?.trim())
    ) {
      throw new Error(
        `Homework generation returned fewer than ${input.numberOfPassages} passages. Please try Generate again.`,
      );
    }

    const looksLikePlaceholder = normalized.questions.every((question) =>
      /practice problem on|sample solution for/i.test(question),
    );
    if (looksLikePlaceholder) {
      throw new Error("Homework generation returned placeholder questions.");
    }

    return applyHomeworkSourceTitle(input, normalized);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("omitted the reading passage") ||
        error.message.includes("fewer than"))
    ) {
      throw error;
    }
    if (process.env.NODE_ENV !== "production") {
      console.warn("[generateHomeworkAction] AI failed; using template fallback.", error);
    }
    return finalizeHomeworkResult(
      generateHomework(toTemplateInput(input, vocabularyTerms)),
    );
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

const updateHomeworkSchema = saveHomeworkSchema.extend({
  homeworkId: z.number().int().positive(),
});

async function buildHomeworkSavePayload(
  userId: string,
  payload: z.infer<typeof saveHomeworkSchema>,
) {
  let resolvedLessonPlanId =
    payload.savedLessonPlanId ?? payload.input.savedLessonPlanId ?? null;
  let sourceLessonPlanTitle: string | null = null;
  let sourceDeckName: string | null = null;

  if (resolvedLessonPlanId != null) {
    const savedPlan = await resolveSavedLessonPlanForViewer(
      userId,
      resolvedLessonPlanId,
      payload.input.teamId,
    );
    if (!savedPlan) {
      throw new Error("Saved lesson plan not found.");
    }
    sourceLessonPlanTitle = savedPlan.lessonTitle;
  } else if (payload.sourceType === "deck") {
    const homeworkCandidate: SavedHomeworkPickerItem = {
      id: -1,
      label: payload.label,
      assignmentTitle: payload.result.assignmentTitle,
      savedLessonPlanId: null,
      sourceLessonPlanTitle: null,
      sourceType: payload.sourceType,
      inputSavedLessonPlanId: payload.input.savedLessonPlanId ?? null,
      deckId: payload.deckId ?? null,
      sourceDeckName: null,
      inputDeckId: payload.input.deckId ?? null,
      subject: payload.input.subject,
      gradeLevel: payload.input.gradeLevel,
      topic: payload.input.topic,
    };
    const plans = await getSavedLessonPlansByUser(userId);
    const matchedPlan = plans
      .map((row) => mapSavedLessonPlanRowToPickerItem(row))
      .find((plan) => homeworkMatchesSavedLessonPlan(homeworkCandidate, plan));
    if (matchedPlan) {
      resolvedLessonPlanId = matchedPlan.id;
      sourceLessonPlanTitle = matchedPlan.lessonTitle;
    }
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

  const referenceMaterials = await resolveReferenceMaterialsForHomeworkSource(userId, {
    sourceType: payload.sourceType,
    savedLessonPlanId: resolvedLessonPlanId,
    deckId: payload.deckId ?? payload.input.deckId ?? null,
    teamId: payload.input.teamId,
  });

  return {
    resolvedLessonPlanId,
    sourceLessonPlanTitle,
    sourceDeckName,
    referenceMaterials,
    persistedInput: {
      sourceType: payload.input.sourceType,
      savedLessonPlanId: payload.input.savedLessonPlanId,
      deckId: payload.input.deckId,
      subject: payload.input.subject,
      gradeLevel: payload.input.gradeLevel,
      topic: payload.input.topic,
      numberOfQuestions: payload.input.numberOfQuestions,
      numberOfPassages: payload.input.numberOfPassages,
      questionsPerPassage: payload.input.questionsPerPassage,
      difficultyLevel: payload.input.difficultyLevel,
      dayScope: payload.input.dayScope,
      referenceMaterials:
        referenceMaterials.length > 0 ? referenceMaterials : undefined,
    },
  };
}

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
  const savePayload = await buildHomeworkSavePayload(userId, payload);

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
    savedLessonPlanId: savePayload.resolvedLessonPlanId,
    sourceLessonPlanTitle: savePayload.sourceLessonPlanTitle,
    deckId: payload.deckId ?? null,
    sourceDeckName: savePayload.sourceDeckName,
    input: savePayload.persistedInput,
    result: payload.result,
    pdfUrl,
    pdfFileName,
  });

  revalidatePath("/teacher/resources");
  revalidatePath("/teacher/homework");
  revalidatePath("/teacher/study-guides");

  return {
    id: saved.id,
    label: saved.label,
    pdfUrl: saved.pdfUrl,
    sourceLessonPlanTitle: saved.sourceLessonPlanTitle,
    sourceDeckName: saved.sourceDeckName,
  };
}

export async function updateHomeworkAction(data: {
  homeworkId: number;
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

  const parsed = updateHomeworkSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid homework data");
  }

  const existing = await resolveSavedHomeworkForViewer(
    userId,
    parsed.data.homeworkId,
    parsed.data.input.teamId,
  );
  if (!existing) {
    throw new Error("Homework assignment not found.");
  }

  const payload = parsed.data;
  const savePayload = await buildHomeworkSavePayload(userId, payload);

  let pdfUrl: string | null = existing.pdfUrl;
  let pdfFileName: string | null = existing.pdfFileName;

  try {
    const pdfBuffer = await generateHomeworkPdfBuffer(payload.result);
    pdfFileName = `${homeworkPdfSafeFileName(payload.result.assignmentTitle)}.pdf`;
    const uploadedUrl = await uploadHomeworkPdfBufferToS3({
      userId: existing.userId,
      fileName: pdfFileName,
      buffer: pdfBuffer,
    });
    if (uploadedUrl && existing.pdfUrl && existing.pdfUrl !== uploadedUrl) {
      try {
        await deleteFromS3(existing.pdfUrl);
      } catch {
        // proceed even if old PDF removal fails
      }
    }
    pdfUrl = uploadedUrl;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[updateHomeworkAction] PDF upload skipped or failed; keeping prior PDF if any.",
        error,
      );
    }
  }

  const updated = await updateSavedHomeworkById(parsed.data.homeworkId, {
    label: payload.label.trim(),
    assignmentTitle: payload.result.assignmentTitle,
    subject: payload.input.subject,
    gradeLevel: payload.input.gradeLevel,
    topic: payload.input.topic,
    difficultyLevel: payload.input.difficultyLevel,
    sourceType: payload.sourceType,
    savedLessonPlanId: savePayload.resolvedLessonPlanId,
    sourceLessonPlanTitle: savePayload.sourceLessonPlanTitle,
    deckId: payload.deckId ?? existing.deckId,
    sourceDeckName: savePayload.sourceDeckName ?? existing.sourceDeckName,
    input: savePayload.persistedInput,
    result: payload.result,
    pdfUrl,
    pdfFileName,
  });

  if (!updated) {
    throw new Error("Could not update homework assignment.");
  }

  revalidatePath("/teacher/resources");
  revalidatePath("/teacher/homework");
  revalidatePath("/teacher/study-guides");

  return {
    id: updated.id,
    label: updated.label,
    pdfUrl: updated.pdfUrl,
    sourceLessonPlanTitle: updated.sourceLessonPlanTitle,
    sourceDeckName: updated.sourceDeckName,
  };
}
