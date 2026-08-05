"use server";

import { Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAccessContext } from "@/lib/access";
import { requireTeacherToolsAccess } from "@/lib/teacher-access";
import {
  runWithAiUsageContext,
  trackedGenerateText,
} from "@/lib/ai-usage/track";
import {
  isAiAccessDisabledError,
  isAiUsageLimitError,
} from "@/lib/ai-usage/errors";
import { createDeck } from "@/db/queries/decks";
import {
  createMultipleChoiceCard,
  getCardsByDeckUnscoped,
} from "@/db/queries/cards";
import { linkDeckToTeamWorkspace } from "@/db/queries/teams";
import { resolveSavedLessonPlanForViewer } from "@/db/queries/saved-lesson-plans";
import {
  isLessonPlanDayScopeAll,
  type LessonPlanDayScope,
} from "@/lib/lesson-plan-day-scope";
import { buildLessonPlanQuizContext, buildLessonPlanPassageFallbackQuestions } from "@/lib/lesson-plan-quiz-context";
import {
  buildManualLessonPlanContext,
  formatLessonPlanContextForPrompt,
  lessonPlanContextDiagnostics,
  normalizeLessonPlanContext,
  vocabularyTermsFromContext,
} from "@/lib/lesson-plan-context";
import {
  buildSinglePassageReplacementPrompt,
  toDiversityMetadata,
  validatePassageAgainstSet,
  type PassageDiversityInput,
} from "@/lib/passage-diversity";
import { validatePassageGenerationQuality } from "@/lib/passage-quality";
import {
  resolveLessonPlanQuizDeckSaveTarget,
  resolveTeacherQuizSaveTarget,
} from "@/lib/teacher-quiz-deck-save";
import {
  saveTeacherQuizDeckSchema,
  teacherQuizInputSchema,
  teacherQuizResultSchema,
  teacherQuizSinglePassageResultSchema,
  previewTeacherQuizDistractorsSchema,
  expandMultiPassageToQuizCards,
  blockToDiversityInput,
  activePassageQuestionCounts,
  resolveReadingPassageQuestionCounts,
  resolvePassageGenerationToggles,
  sumPassageQuestionCounts,
  type SaveTeacherQuizDeckInput,
  type TeacherQuizActionInput,
  type TeacherQuizPassageBlock,
  type TeacherQuizPassageQuestion,
} from "@/lib/teacher-quiz-ai-schema";
import { formatTeacherQuizGenerationError } from "@/lib/teacher-quiz-generation-errors";
import { buildCurriculumPassagePrompt } from "@/lib/teacher-quiz-reading-passage";
import {
  extractStepFinalAnswer,
  isStepAnswer,
  STUDY_MODE_STEP_ANSWER_PROMPT,
} from "@/lib/parse-step-answer";
import {
  generateTeacherQuiz,
  type TeacherQuizResult,
} from "@/lib/teacher-generators";

function assertValidDayScope(
  dayScope: LessonPlanDayScope | undefined,
  weeklyScheduleLength: number,
) {
  if (!dayScope || isLessonPlanDayScopeAll(dayScope)) return;
  if (dayScope.dayIndex >= weeklyScheduleLength) {
    throw new Error(
      "Selected lesson-plan day is not available on this plan. Choose All Days or another day.",
    );
  }
}


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

  const { output } = await trackedGenerateText({
    model: openai("gpt-4o"),
    output: Output.object({
      schema: z.object({
        distractors: z.array(z.string().min(1)).length(3),
      }),
    }),
    system: `You generate 3 plausible but definitively incorrect wrong answers ("distractors") for a teacher quiz flashcard.

Produce exactly 3 wrong answers that:
- Are clearly incorrect to someone who knows the subject
- Are plausible enough to challenge students
- Are distinct from each other and from the correct answer
- Match the subject, grade level, topic, and difficulty

Rules:
- NEVER use markdown formatting
- Keep each distractor concise — short final-answer style (a number, word, or brief phrase)
- If the correct answer is a step-by-step workout (contains "Step 1:"), each distractor MUST be a short plausible final answer only — NOT a full multi-line solution. Match the length/tone of the value after "Answer:"
- Return exactly 3 distractors`,
    prompt: `Subject: ${input.subject}
Grade level: ${input.gradeLevel}
Topic: ${input.topic}
Difficulty: ${input.difficultyLevel}

Question / Front: ${input.distractorQuestion}
Correct answer / Back: ${input.distractorAnswer}${
      isStepAnswer(input.distractorAnswer)
        ? `\nFinal answer value (distractors must be short alternatives to this): ${
            extractStepFinalAnswer(input.distractorAnswer) ?? input.distractorAnswer
          }`
        : ""
    }

Generate exactly 3 plausible wrong answers.`,
  });

  if (!output?.distractors || output.distractors.length !== 3) {
    throw new Error("Could not generate quiz wrong answers. Try again.");
  }

  return [output.distractors[0]!, output.distractors[1]!, output.distractors[2]!];
}

async function resolveQuizLessonPlan(
  viewerUserId: string,
  planId: number,
  teamId?: number | null,
) {
  return resolveSavedLessonPlanForViewer(viewerUserId, planId, teamId);
}

const GENERIC_FALLBACK_NAMES = [
  "Kai",
  "Marissa",
  "Devon",
  "Aaliyah",
  "Omar",
  "Tiana",
] as const;

const GENERIC_FALLBACK_CONTEXTS = [
  { category: "Practical Decision", event: "must choose between a quick shortcut and the correct method" },
  { category: "Team Observation", event: "notices a peer making an incomplete choice and must respond helpfully" },
  { category: "Inspection Review", event: "reviews work that looks finished but misses a key requirement" },
  { category: "Client Situation", event: "explains a recommendation when someone asks for a faster option" },
  { category: "Planning Meeting", event: "compares two plans and selects the one that meets the learning goal" },
  { category: "Field Observation", event: "collects evidence and revises an early assumption" },
] as const;

function buildGenericMultiPassageFallback(
  questionCounts: number[],
  input: TeacherQuizActionInput,
): TeacherQuizPassageQuestion[] {
  const topic = input.topic.trim() || "the topic";
  const subject = input.subject.trim() || "the subject";
  const grade = input.gradeLevel.trim() || "Grade 10";

  return questionCounts.flatMap((count, passageIndex) => {
    const character =
      GENERIC_FALLBACK_NAMES[passageIndex % GENERIC_FALLBACK_NAMES.length]!;
    const context =
      GENERIC_FALLBACK_CONTEXTS[passageIndex % GENERIC_FALLBACK_CONTEXTS.length]!;
    const title = `${context.category}: ${topic}`;
    const passage = `${character} is a ${grade} student working on ${topic} in ${subject}. In this ${context.category.toLowerCase()}, ${character} ${context.event}.

At first, an incomplete choice looks acceptable. Then new information shows why that choice does not fully meet the lesson goal for ${topic}.

With guidance from a peer or mentor, ${character} revises the approach and can explain which idea from the lesson made the difference.`;

    const questions = [
      {
        questionType: "multiple_choice",
        question: `What challenge does ${character} face in this situation?`,
        correctAnswer: `Choosing an approach that fully meets the lesson goal for ${topic}.`,
        wrongAnswers: [
          "Memorizing a definition with no real situation.",
          "Ignoring feedback because the first idea felt easier.",
          "Leaving the task unfinished without reviewing evidence.",
        ] as [string, string, string],
      },
      {
        questionType: "critical_thinking",
        question: `Why does ${character} need to revise the first choice?`,
        correctAnswer: `New information shows the first choice does not fully meet the ${topic.toLowerCase()} learning goal.`,
        wrongAnswers: [
          "The class period ended before any work began.",
          "A classmate asked for an unrelated homework answer.",
          "The topic was removed from the lesson plan.",
        ] as [string, string, string],
      },
      {
        questionType: "practical_application",
        question: `What should ${character} do next time a similar situation appears?`,
        correctAnswer: `Check the choice against the lesson goal before acting.`,
        wrongAnswers: [
          "Repeat the first incomplete choice automatically.",
          "Avoid using any lesson ideas in the response.",
          "Ask someone else to complete the whole task alone.",
        ] as [string, string, string],
      },
    ];

    return Array.from({ length: count }, (_, questionIndex) => {
      const q = questions[questionIndex % questions.length]!;
      return {
        passage,
        passageTitle: title,
        educationalContext: context.category,
        scenarioCategory: context.category,
        scenarioSummary: `${character} ${context.event} while studying ${topic}.`,
        question: q.question,
        correctAnswer: q.correctAnswer,
        wrongAnswers: q.wrongAnswers,
        explanation: `This answer fits the scenario "${title}" about ${topic}.`,
        questionType: q.questionType,
        sourceLessonPlanId: input.savedLessonPlanId,
        passageGroupId: `fallback-passage-${passageIndex + 1}`,
      };
    });
  });
}

const MAX_REPLACEMENT_ATTEMPTS_PER_PASSAGE = 2;

type PassageGenerationDiagnostics = {
  requestedPassageCount: number;
  acceptedPassageCount: number;
  replacementAttempts: number;
  scenarioCategories: string[];
  centralEvents: string[];
  duplicateValidationResults: string[];
};

async function generateSingleStructuredPassage(input: {
  system: string;
  prompt: string;
}): Promise<TeacherQuizPassageBlock | null> {
  const { output } = await trackedGenerateText({
    model: openai("gpt-4o"),
    output: Output.object({
      schema: teacherQuizSinglePassageResultSchema,
    }),
    system: input.system,
    prompt: input.prompt,
  });
  return output?.passage ?? null;
}

function validateSinglePassageQuality(
  block: TeacherQuizPassageBlock,
  expectedQuestions: number,
  requireObjectiveAlignment: boolean,
): string[] {
  const quality = validatePassageGenerationQuality(
    { passages: [block] },
    {
      expectedPassageCount: 1,
      questionsPerPassage: [expectedQuestions],
      requestedQuestionTypes: [],
      requireObjectiveAlignment,
    },
  );
  return quality.errors;
}

async function generateReadingPassageQuizForDeck(
  input: TeacherQuizActionInput,
  userId: string,
  questionCounts: number[],
): Promise<TeacherQuizPassageQuestion[]> {
  const activeCounts = activePassageQuestionCounts(questionCounts);
  if (activeCounts.length < 1) {
    return [];
  }

  const toggles = resolvePassageGenerationToggles(input);
  let savedLessonPlan: Awaited<ReturnType<typeof resolveQuizLessonPlan>> = null;
  let normalizedContext = input.savedLessonPlanId
    ? null
    : buildManualLessonPlanContext({
        subject: input.subject,
        gradeLevel: input.gradeLevel,
        topic: input.topic,
        difficultyLevel: String(input.difficultyLevel),
      });

  if (input.savedLessonPlanId) {
    savedLessonPlan = await resolveQuizLessonPlan(
      userId,
      input.savedLessonPlanId,
      input.teamId,
    );
    if (!savedLessonPlan) {
      throw new Error("Saved lesson plan not found.");
    }
    assertValidDayScope(
      input.dayScope,
      savedLessonPlan.result.weeklySchedule?.length ?? 0,
    );
    normalizedContext = normalizeLessonPlanContext({
      lessonPlanId: input.savedLessonPlanId,
      input: savedLessonPlan.input,
      result: savedLessonPlan.result,
      dayScope: input.dayScope,
      overrides: {
        subject: input.subject,
        gradeLevel: input.gradeLevel,
        topic: input.topic,
      },
    });
  }

  const curriculumText = normalizedContext
    ? formatLessonPlanContextForPrompt(normalizedContext)
    : null;
  const vocabularyTerms = normalizedContext
    ? [
        ...vocabularyTermsFromContext(normalizedContext),
        ...normalizedContext.vocabularyFocus,
        normalizedContext.subject,
        normalizedContext.topic,
      ]
    : [input.subject, input.topic];

  if (process.env.NODE_ENV !== "production" && normalizedContext) {
    console.info(
      "[generateReadingPassageQuizForDeck] lessonPlanContext diagnostics",
      lessonPlanContextDiagnostics(normalizedContext),
    );
  }

  const lessonFallback = (): TeacherQuizPassageQuestion[] =>
    savedLessonPlan
      ? buildLessonPlanPassageFallbackQuestions(
          activeCounts,
          {
            subject: input.subject,
            gradeLevel: input.gradeLevel,
            topic: input.topic,
            difficultyLevel: String(input.difficultyLevel),
          },
          { input: savedLessonPlan.input, result: savedLessonPlan.result },
          input.dayScope,
        )
      : buildGenericMultiPassageFallback(activeCounts, input);

  // Offline / missing-key path only. Do not use fill-in-the-blank templates after a
  // failed live AI run — those templates only swap names/vocab and look identical.
  if (!process.env.OPENAI_API_KEY?.trim()) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[generateReadingPassageQuizForDeck] OPENAI_API_KEY missing; using template fallback.",
      );
    }
    return lessonFallback();
  }

  const acceptedPassages: TeacherQuizPassageBlock[] = [];
  const diagnostics: PassageGenerationDiagnostics = {
    requestedPassageCount: activeCounts.length,
    acceptedPassageCount: 0,
    replacementAttempts: 0,
    scenarioCategories: [],
    centralEvents: [],
    duplicateValidationResults: [],
  };

  const seedPrevious = toggles.avoidPreviousPassages
    ? (input.previousPassageSummaries ?? [])
    : [];

  try {
    for (let index = 0; index < activeCounts.length; index += 1) {
      const questionsForThisPassage = activeCounts[index]!;
      const previousMeta = [
        ...seedPrevious,
        ...acceptedPassages.map((block) =>
          toDiversityMetadata(blockToDiversityInput(block)),
        ),
      ];

      const { system, user } = buildCurriculumPassagePrompt({
        lessonPlanContext: normalizedContext,
        lessonPlanContextText: curriculumText,
        subject: input.subject,
        gradeLevel: input.gradeLevel,
        topic: input.topic,
        difficultyLevel: String(input.difficultyLevel),
        questionsForThisPassage,
        passageIndex: index,
        totalPassages: activeCounts.length,
        settings: {
          passageType: input.passageType,
          passageStyle: input.passageStyle,
          readingLevel: input.readingLevel,
          passageQuestionTypes: input.passageQuestionTypes,
          toggles,
        },
        previousPassages: previousMeta,
      });

      let candidate =
        (await generateSingleStructuredPassage({ system, prompt: user })) ??
        (await generateSingleStructuredPassage({
          system,
          prompt: `${user}\n\nPrevious attempt returned no usable passage. Return one valid structured passage object.`,
        }));

      if (!candidate) {
        throw new Error("AI quiz generation returned no output.");
      }

      const qualityErrors = validateSinglePassageQuality(
        candidate,
        questionsForThisPassage,
        Boolean(input.savedLessonPlanId),
      );
      if (qualityErrors.length > 0) {
        candidate =
          (await generateSingleStructuredPassage({
            system,
            prompt: `${user}\n\nPrevious output failed validation:\n${qualityErrors.slice(0, 6).join("\n")}\nReturn one corrected passage.`,
          })) ?? candidate;
      }

      let diversityInput: PassageDiversityInput = blockToDiversityInput(candidate);
      let validation = validatePassageAgainstSet(
        diversityInput,
        acceptedPassages.map(blockToDiversityInput),
        vocabularyTerms,
      );

      let replacementAttempt = 0;
      while (!validation.valid && replacementAttempt < MAX_REPLACEMENT_ATTEMPTS_PER_PASSAGE) {
        replacementAttempt += 1;
        diagnostics.replacementAttempts += 1;
        diagnostics.duplicateValidationResults.push(
          `passage ${index + 1} attempt ${replacementAttempt}: ${validation.reasons.join("; ")}`,
        );

        const replacementPrompt = buildSinglePassageReplacementPrompt({
          rejected: diversityInput,
          reasons: validation.reasons,
          previousPassages: previousMeta,
        });

        const replacement = await generateSingleStructuredPassage({
          system,
          prompt: `${user}\n\n${replacementPrompt}`,
        });

        if (!replacement) break;

        candidate = replacement;
        diversityInput = blockToDiversityInput(candidate);
        validation = validatePassageAgainstSet(
          diversityInput,
          acceptedPassages.map(blockToDiversityInput),
          vocabularyTerms,
        );
      }

      if (!validation.valid) {
        throw new Error(
          `PASSAGE_DIVERSITY_FAILED: Could not produce a sufficiently different passage ${index + 1}. ${validation.reasons[0] ?? "Please try again."}`,
        );
      }

      acceptedPassages.push(candidate);
      diagnostics.scenarioCategories.push(candidate.scenarioCategory);
      diagnostics.centralEvents.push(candidate.centralEvent);
      diagnostics.duplicateValidationResults.push(
        `passage ${index + 1}: accepted`,
      );
    }

    diagnostics.acceptedPassageCount = acceptedPassages.length;

    if (process.env.NODE_ENV !== "production") {
      console.info("[generateReadingPassageQuizForDeck] diagnostics", diagnostics);
    }

    const expanded = expandMultiPassageToQuizCards(
      { passages: acceptedPassages },
      {
        expectedQuestionCounts: activeCounts,
        includeAnswerExplanations: toggles.includeAnswerExplanations,
        includeTeacherNotes: toggles.includeTeacherNotes,
        sourceLessonPlanId: input.savedLessonPlanId,
      },
    );
    const expectedTotal = sumPassageQuestionCounts(activeCounts);
    if (expanded.length < expectedTotal) {
      throw new Error("AI quiz generation returned incomplete passage questions.");
    }

    return expanded;
  } catch (error) {
    if (isAiUsageLimitError(error) || isAiAccessDisabledError(error)) {
      throw new Error(error.message);
    }
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[generateReadingPassageQuizForDeck] AI failed; not using template fallback.",
        error instanceof Error ? error.message : "unknown",
        diagnostics,
      );
    }
    throw new Error(formatTeacherQuizGenerationError(error));
  }
}

async function generateQuizForDeck(
  input: TeacherQuizActionInput,
  userId: string,
): Promise<TeacherQuizResult> {
  let lessonContext: string | null = null;

  if (input.savedLessonPlanId) {
    const saved = await resolveQuizLessonPlan(
      userId,
      input.savedLessonPlanId,
      input.teamId,
    );
    if (!saved) {
      throw new Error("Saved lesson plan not found.");
    }
    assertValidDayScope(
      input.dayScope,
      saved.result.weeklySchedule?.length ?? 0,
    );
    lessonContext = buildLessonPlanQuizContext({
      input: saved.input,
      result: saved.result,
      referencePurpose: "quiz",
      dayScope: input.dayScope,
    });
  }

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return generateTeacherQuiz(input);
  }

  try {
    const { output } = await trackedGenerateText({
      model: openai("gpt-4o"),
      output: Output.object({
        schema: teacherQuizResultSchema,
      }),
      system: `You are an expert K–12 assessment designer. Create quiz questions teachers can use as flashcard deck content that also works in Standard Review study mode.

Requirements:
- Generate exactly ${input.numberOfQuestions} questions.
- Question type requested: ${input.questionTypes}.
- Difficulty calibration: ${input.difficultyLevel}.
- Each question must have exactly 4 answer choices labeled A), B), C), D).
- correctAnswer must exactly match one of the four choices (same text).
- Base every question on the lesson plan source material when provided — especially vocabulary, objectives, and assessment ideas.
- When the source material is scoped to a single day, use ONLY that day's focus, vocabulary, timeline, and vocabulary detail — do not invent or pull content from other days.
- Questions must be specific to the topic, never generic placeholders.
- answerKey must list the correctAnswer for each question in order.
- Do not use markdown formatting.

For **problem-solving, mathematical, or computational questions** (algebra, arithmetic, geometry, science calculations, multi-step reasoning):
- Put the full worked solution in correctAnswer AND in the matching choice using this study-mode format:
${STUDY_MODE_STEP_ANSWER_PROMPT}
- The other three choices must be short plausible final-answer values only (NOT full step workouts) — e.g. "1", "2", "4" when Answer: is "3".
- Put the same short final result after "Answer:" that students should select in quiz mode.
- explanation may briefly reinforce the key idea, but the step workout must live in correctAnswer (not only in explanation).

For **non-problem-solving questions** (definitions, vocabulary, facts, reading comprehension without calculation):
- Keep correctAnswer and all four choices concise.
- explanation: concise educational rationale.`,
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
    if (isAiUsageLimitError(error) || isAiAccessDisabledError(error)) {
      throw new Error(error.message);
    }
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

  const passageQuestionCounts = resolveReadingPassageQuestionCounts(parsed.data);
  const passageCount = sumPassageQuestionCounts(
    activePassageQuestionCounts(passageQuestionCounts),
  );
  const standardCount = parsed.data.numberOfQuestions;
  const usageBase = {
    userId,
    teamId: parsed.data.teamId ?? null,
    subscriptionPlan: ctx.effectivePlanSlug,
    isPlatformAdmin: ctx.isAdmin || ctx.isSuperadmin,
  };

  try {
    const [standardQuiz, passageQuestions] = await Promise.all([
      standardCount > 0
        ? runWithAiUsageContext({ ...usageBase, feature: "quiz" }, () =>
            generateQuizForDeck(
              { ...parsed.data, numberOfQuestions: standardCount },
              userId,
            ),
          )
        : Promise.resolve(null),
      passageCount > 0
        ? runWithAiUsageContext({ ...usageBase, feature: "passage" }, () =>
            generateReadingPassageQuizForDeck(
              parsed.data,
              userId,
              passageQuestionCounts,
            ),
          )
        : Promise.resolve([] as TeacherQuizPassageQuestion[]),
    ]);

    return {
      standardQuestions: standardQuiz?.questions ?? [],
      passageQuestions,
    };
  } catch (error) {
    if (isAiUsageLimitError(error) || isAiAccessDisabledError(error)) {
      throw new Error(error.message);
    }
    throw new Error(formatTeacherQuizGenerationError(error));
  }
}

export async function previewTeacherQuizDistractorsAction(
  data: z.infer<typeof previewTeacherQuizDistractorsSchema>,
): Promise<{ distractors: [string, string, string] }> {
  const ctx = await getAccessContext();
  const { userId } = await requireTeacherToolsAccess(
    ctx,
    "Quiz generator requires an education plan.",
  );

  const parsed = previewTeacherQuizDistractorsSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid input");
  }

  const distractors = await runWithAiUsageContext(
    {
      userId,
      feature: "quiz",
      teamId: null,
      subscriptionPlan: ctx.effectivePlanSlug,
      isPlatformAdmin: ctx.isAdmin || ctx.isSuperadmin,
    },
    () => generateTeacherQuizDistractors(parsed.data),
  );
  return { distractors };
}

export async function saveTeacherQuizDeckAction(
  data: SaveTeacherQuizDeckInput,
): Promise<{
  deckId: number;
  deckName: string;
  cardCount: number;
  created: boolean;
}> {
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

  const cards = input.cards;
  if (cards.length > saveTarget.maxCardsPerDeck) {
    throw new Error(
      `Up to ${saveTarget.maxCardsPerDeck} cards per deck on your ${saveTarget.planLabel} plan.`,
    );
  }

  const resolved = await resolveLessonPlanQuizDeckSaveTarget({
    viewerUserId: userId,
    saveTarget,
    savedLessonPlanId: input.savedLessonPlanId,
    dayScope: input.savedLessonPlanId != null ? input.dayScope : undefined,
    subject: input.subject,
    topic: input.topic,
    gradeLevel: input.gradeLevel,
    difficultyLevel: input.difficultyLevel,
    teamId: input.teamId,
  });

  let deckId: number;
  let deckName: string;
  let created = false;

  if (resolved.mode === "append") {
    const existingCards = await getCardsByDeckUnscoped(resolved.deckId);
    if (existingCards.length + cards.length > saveTarget.maxCardsPerDeck) {
      throw new Error(
        `This deck already has ${existingCards.length} card(s). Adding ${cards.length} would exceed the ${saveTarget.maxCardsPerDeck}-card limit on your ${saveTarget.planLabel} plan.`,
      );
    }
    deckId = resolved.deckId;
    deckName = resolved.deckName;
  } else {
    if (saveTarget.maxDecks > 0 && saveTarget.deckCount >= saveTarget.maxDecks) {
      const scopeLabel =
        saveTarget.scope === "workspace" ? "workspace" : "personal";
      throw new Error(
        `Deck limit reached — up to ${saveTarget.maxDecks} ${scopeLabel} deck(s) on your ${saveTarget.planLabel} plan.`,
      );
    }

    deckId = await createDeck(
      saveTarget.deckOwnerUserId,
      resolved.name,
      resolved.description,
      saveTarget.teamId,
      null,
      input.gradeLevel,
      input.difficultyLevel,
      userId,
    );
    deckName = resolved.name;
    created = true;

    if (saveTarget.teamId != null) {
      await linkDeckToTeamWorkspace(saveTarget.teamId, deckId);
    }
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
    created,
  };
}
