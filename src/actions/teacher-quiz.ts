"use server";

import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAccessContext } from "@/lib/access";
import { requireTeacherToolsAccess } from "@/lib/teacher-access";
import { createDeck } from "@/db/queries/decks";
import { createMultipleChoiceCard } from "@/db/queries/cards";
import { linkDeckToTeamWorkspace } from "@/db/queries/teams";
import { getSavedLessonPlanByIdForUser } from "@/db/queries/saved-lesson-plans";
import { buildLessonPlanQuizContext, buildLessonPlanPassageQuizContext, buildLessonPlanPassageFallbackQuestions } from "@/lib/lesson-plan-quiz-context";
import {
  buildTeacherQuizDeckMetadata,
  resolveTeacherQuizSaveTarget,
} from "@/lib/teacher-quiz-deck-save";
import {
  saveTeacherQuizDeckSchema,
  teacherQuizInputSchema,
  teacherQuizResultSchema,
  teacherQuizPassageResultSchema,
  previewTeacherQuizDistractorsSchema,
  TEACHER_QUIZ_DEFAULT_QUESTION_TYPE,
  type SaveTeacherQuizDeckInput,
  type TeacherQuizActionInput,
  type TeacherQuizPassageQuestion,
} from "@/lib/teacher-quiz-ai-schema";
import { buildTeacherQuizReadingPassagePrompt } from "@/lib/teacher-quiz-reading-passage";
import {
  generateTeacherQuiz,
  type TeacherQuizResult,
} from "@/lib/teacher-generators";


async function generateTeacherQuizDistractors(input: {
  subject: string;
  gradeLevel: string;
  topic: string;
  difficultyLevel: string;
  distractorQuestion: string;
  distractorAnswer: string;
}): Promise<[string, string, string]> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return [
      `Incorrect ${input.topic} option A`,
      `Incorrect ${input.topic} option B`,
      `Incorrect ${input.topic} option C`,
    ];
  }

  const { output } = await generateText({
    model: openai("gpt-4o"),
    output: Output.object({
      schema: z.object({
        distractors: z.array(z.string().min(1)).length(3),
      }),
    }),
    system: `You generate 3 plausible but definitively incorrect wrong answers ("distractors") for a teacher quiz flashcard.

Produce exactly 3 wrong answers that:
- Are clearly incorrect to someone who knows the subject
- Are plausible enough to challenge students (similar length, tone, and format to the correct answer)
- Are distinct from each other and from the correct answer
- Match the subject, grade level, topic, and difficulty

Rules:
- NEVER use markdown formatting
- Keep each distractor concise — same approximate length as the correct answer
- Return exactly 3 distractors`,
    prompt: `Subject: ${input.subject}
Grade level: ${input.gradeLevel}
Topic: ${input.topic}
Difficulty: ${input.difficultyLevel}

Question / Front: ${input.distractorQuestion}
Correct answer / Back: ${input.distractorAnswer}

Generate exactly 3 plausible wrong answers.`,
  });

  if (!output?.distractors || output.distractors.length !== 3) {
    throw new Error("Could not generate quiz wrong answers. Try again.");
  }

  return [output.distractors[0]!, output.distractors[1]!, output.distractors[2]!];
}

async function generateReadingPassageQuizForDeck(
  input: TeacherQuizActionInput,
  userId: string,
): Promise<TeacherQuizPassageQuestion[]> {
  let lessonContext: string | null = null;
  let savedLessonPlan: Awaited<ReturnType<typeof getSavedLessonPlanByIdForUser>> = null;

  if (input.savedLessonPlanId) {
    savedLessonPlan = await getSavedLessonPlanByIdForUser(userId, input.savedLessonPlanId);
    if (!savedLessonPlan) {
      throw new Error("Saved lesson plan not found.");
    }
    lessonContext = buildLessonPlanPassageQuizContext({
      input: savedLessonPlan.input,
      result: savedLessonPlan.result,
    });
  }

  const count = input.readingPassageQuestionCount ?? input.numberOfQuestions;
  const { system, user } = buildTeacherQuizReadingPassagePrompt({
    subject: input.subject,
    gradeLevel: input.gradeLevel,
    topic: input.topic,
    difficultyLevel: String(input.difficultyLevel),
    count,
    lessonPlanContext: lessonContext,
  });

  const lessonFallback = () =>
    savedLessonPlan
      ? buildLessonPlanPassageFallbackQuestions(
          count,
          {
            subject: input.subject,
            gradeLevel: input.gradeLevel,
            topic: input.topic,
            difficultyLevel: String(input.difficultyLevel),
          },
          { input: savedLessonPlan.input, result: savedLessonPlan.result },
        )
      : Array.from({ length: count }, (_, index) => ({
          passage: `Sample passage ${index + 1} about ${input.topic} for ${input.gradeLevel} ${input.subject}.`,
          question: `Sample question ${index + 1} about ${input.topic}?`,
          correctAnswer: `Sample correct answer for ${input.topic}.`,
          wrongAnswers: [
            `Incorrect option A for ${input.topic}`,
            `Incorrect option B for ${input.topic}`,
            `Incorrect option C for ${input.topic}`,
          ] as [string, string, string],
          explanation: `This answer best fits the passage at ${input.difficultyLevel} level.`,
        }));

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return lessonFallback();
  }

  try {
    const { output } = await generateText({
      model: openai("gpt-4o"),
      output: Output.object({
        schema: teacherQuizPassageResultSchema,
      }),
      system,
      prompt: user,
    });

    if (!output?.questions?.length) {
      throw new Error("AI quiz generation returned no output.");
    }

    return output.questions.slice(0, count);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[generateReadingPassageQuizForDeck] AI failed; using template fallback.",
        error,
      );
    }
    return lessonFallback();
  }
}

async function generateQuizForDeck(
  input: TeacherQuizActionInput,
  userId: string,
): Promise<TeacherQuizResult> {
  let lessonContext: string | null = null;

  if (input.savedLessonPlanId) {
    const saved = await getSavedLessonPlanByIdForUser(
      userId,
      input.savedLessonPlanId,
    );
    if (!saved) {
      throw new Error("Saved lesson plan not found.");
    }
    lessonContext = buildLessonPlanQuizContext({
      input: saved.input,
      result: saved.result,
    });
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return generateTeacherQuiz(input);
  }

  try {
    const { output } = await generateText({
      model: openai("gpt-4o"),
      output: Output.object({
        schema: teacherQuizResultSchema,
      }),
      system: `You are an expert K–12 assessment designer. Create quiz questions teachers can use as flashcard deck content.

Requirements:
- Generate exactly ${input.numberOfQuestions} questions.
- Question type requested: ${input.questionTypes}.
- Difficulty calibration: ${input.difficultyLevel}.
- Each question must have exactly 4 answer choices labeled A), B), C), D).
- correctAnswer must exactly match one of the four choices.
- Base every question on the lesson plan source material when provided — especially vocabulary, objectives, and assessment ideas.
- Questions must be specific to the topic, never generic placeholders.
- Explanations must be concise and educational.
- answerKey must list the correctAnswer for each question in order.
- Do not use markdown formatting.`,
      prompt: lessonContext
        ? `Create a quiz for ${input.subject}, ${input.gradeLevel}, topic "${input.topic}".

Use this saved lesson plan as the primary source:
${lessonContext}`
        : `Create a quiz for ${input.subject}, ${input.gradeLevel}, topic "${input.topic}" at ${input.difficultyLevel} difficulty.`,
    });

    if (!output) {
      throw new Error("AI quiz generation returned no output.");
    }

    return output;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[generateQuizForDeck] AI failed; using template fallback.",
        error,
      );
    }
    return generateTeacherQuiz(input);
  }
}

export type GenerateTeacherQuizActionResult = {
  standardQuestions: TeacherQuizResult["questions"];
  passageQuestions: TeacherQuizPassageQuestion[];
};

export async function generateTeacherQuizAction(
  data: TeacherQuizActionInput,
): Promise<GenerateTeacherQuizActionResult> {
  const ctx = await getAccessContext();
  const { userId } = await requireTeacherToolsAccess(
    ctx,
    "Quiz generator requires an education plan.",
  );

  const parsed = teacherQuizInputSchema.safeParse(data);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "Invalid input");
  }

  const passageCount = parsed.data.readingPassageQuestions
    ? (parsed.data.readingPassageQuestionCount ?? 0)
    : 0;
  const standardCount = parsed.data.numberOfQuestions;

  const [standardQuiz, passageQuestions] = await Promise.all([
    standardCount > 0
      ? generateQuizForDeck(
          { ...parsed.data, numberOfQuestions: standardCount },
          userId,
        )
      : Promise.resolve(null),
    passageCount > 0
      ? generateReadingPassageQuizForDeck(
          { ...parsed.data, readingPassageQuestionCount: passageCount },
          userId,
        )
      : Promise.resolve([] as TeacherQuizPassageQuestion[]),
  ]);

  return {
    standardQuestions: standardQuiz?.questions ?? [],
    passageQuestions,
  };
}

export async function previewTeacherQuizDistractorsAction(
  data: z.infer<typeof previewTeacherQuizDistractorsSchema>,
): Promise<{ distractors: [string, string, string] }> {
  const ctx = await getAccessContext();
  await requireTeacherToolsAccess(
    ctx,
    "Quiz generator requires an education plan.",
  );

  const parsed = previewTeacherQuizDistractorsSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid input");
  }

  const distractors = await generateTeacherQuizDistractors(parsed.data);
  return { distractors };
}

export async function saveTeacherQuizDeckAction(
  data: SaveTeacherQuizDeckInput,
): Promise<{ deckId: number; deckName: string; cardCount: number }> {
  const ctx = await getAccessContext();
  const { userId } = await requireTeacherToolsAccess(
    ctx,
    "Quiz generator requires an education plan.",
  );

  const parsed = saveTeacherQuizDeckSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid input");
  }

  const input = parsed.data;
  const saveTarget = await resolveTeacherQuizSaveTarget(userId, input.teamId);

  if (saveTarget.needsWorkspace) {
    throw new Error(
      `Create an ${saveTarget.planLabel} workspace in Team Admin before saving quiz decks.`,
    );
  }

  if (saveTarget.maxDecks > 0 && saveTarget.deckCount >= saveTarget.maxDecks) {
    const scopeLabel =
      saveTarget.scope === "workspace" ? "workspace" : "personal";
    throw new Error(
      `Deck limit reached — up to ${saveTarget.maxDecks} ${scopeLabel} deck(s) on your ${saveTarget.planLabel} plan.`,
    );
  }

  const cards = input.cards;
  if (cards.length > saveTarget.maxCardsPerDeck) {
    throw new Error(
      `Up to ${saveTarget.maxCardsPerDeck} cards per deck on your ${saveTarget.planLabel} plan.`,
    );
  }

  const { name: deckName, description: deckDescription } = buildTeacherQuizDeckMetadata(
    {
      subject: input.subject,
      topic: input.topic,
      gradeLevel: input.gradeLevel,
      difficultyLevel: input.difficultyLevel,
      savedLessonPlanId: input.savedLessonPlanId,
    },
  );

  const deckId = await createDeck(
    saveTarget.deckOwnerUserId,
    deckName,
    deckDescription,
    saveTarget.teamId,
    null,
    input.gradeLevel,
    input.difficultyLevel,
    userId,
  );

  if (saveTarget.teamId != null) {
    await linkDeckToTeamWorkspace(saveTarget.teamId, deckId);
  }

  for (const card of cards) {
    const front = card.front.trim();
    const back = card.back.trim();
    const distractors = card.distractors.map((item) => item.trim()) as [
      string,
      string,
      string,
    ];
    const choices = [back, ...distractors];
    await createMultipleChoiceCard(deckId, front, null, choices, 0, true);
  }

  revalidatePath("/teacher/quizzes");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/team-admin", "layout");
  revalidatePath(`/decks/${deckId}`);

  return {
    deckId,
    deckName,
    cardCount: cards.length,
  };
}
