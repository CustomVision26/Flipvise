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
import { buildLessonPlanQuizContext, buildLessonPlanPassageQuizContext, buildLessonPlanPassageFallbackQuestions } from "@/lib/lesson-plan-quiz-context";
import {
  resolveLessonPlanQuizDeckSaveTarget,
  resolveTeacherQuizSaveTarget,
} from "@/lib/teacher-quiz-deck-save";
import {
  saveTeacherQuizDeckSchema,
  teacherQuizInputSchema,
  teacherQuizResultSchema,
  teacherQuizMultiPassageResultSchema,
  previewTeacherQuizDistractorsSchema,
  expandMultiPassageToQuizCards,
  activePassageQuestionCounts,
  sumPassageQuestionCounts,
  TEACHER_QUIZ_DEFAULT_QUESTION_TYPE,
  type SaveTeacherQuizDeckInput,
  type TeacherQuizActionInput,
  type TeacherQuizPassageQuestion,
} from "@/lib/teacher-quiz-ai-schema";
import {
  buildTeacherQuizReadingPassagePrompt,
  detectQuizSubjectArea,
} from "@/lib/teacher-quiz-reading-passage";
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

function buildGenericMultiPassageFallback(
  questionCounts: number[],
  input: TeacherQuizActionInput,
): TeacherQuizPassageQuestion[] {
  const topic = input.topic.trim() || "the topic";
  const isMath =
    detectQuizSubjectArea(input.subject, input.topic) === "mathematics";

  if (isMath) {
    const mathPassages: Array<{
      title: string;
      passage: string;
      questions: Array<{
        questionType: string;
        question: string;
        correctAnswer: string;
        wrongAnswers: [string, string, string];
      }>;
    }> = [
      {
        title: "Selling Fruit Juice",
        passage:
          "A Grade 6 class is selling fruit juice to raise money for a school event. Each bottle of juice costs $5. The class already has $20 from donations. The teacher uses the variable j to represent the number of juice bottles sold.",
        questions: [
          {
            questionType: "Variable Meaning",
            question: "What does the variable j represent?",
            correctAnswer: "The number of juice bottles sold",
            wrongAnswers: [
              "The total money collected",
              "The donation amount",
              "The cost of one bottle",
            ],
          },
          {
            questionType: "Expression",
            question: "Which expression represents the total money collected?",
            correctAnswer: "20 + 5j",
            wrongAnswers: ["5 + 20j", "20 − 5j", "25j"],
          },
          {
            questionType: "Evaluate",
            question: "How much money will the class collect after selling 8 bottles?",
            correctAnswer:
              "Step 1: Write the expression\nTotal money = 20 + 5j\nStep 2: Substitute j = 8\n20 + 5(8) = 20 + 40\nAnswer: $60",
            wrongAnswers: ["$45", "$50", "$65"],
          },
        ],
      },
      {
        title: "Buying Movie Tickets",
        passage:
          "A family spends $12 on each movie ticket. They also pay a $6 booking fee. The total amount paid was $54, where t represents the number of movie tickets purchased.",
        questions: [
          {
            questionType: "Variable Meaning",
            question: "What does the variable t represent?",
            correctAnswer: "Number of movie tickets",
            wrongAnswers: ["Total money paid", "Booking fee", "Cost of popcorn"],
          },
          {
            questionType: "Equation",
            question: "Which equation represents the situation?",
            correctAnswer: "12t + 6 = 54",
            wrongAnswers: ["12 + 6t = 54", "54t = 12 + 6", "12t − 6 = 54"],
          },
          {
            questionType: "Solve",
            question: "How many tickets were purchased?",
            correctAnswer:
              "Step 1: Start with the equation\n12t + 6 = 54\nStep 2: Subtract 6 from both sides\n12t = 48\nStep 3: Divide both sides by 12\nt = 4\nAnswer: 4",
            wrongAnswers: ["3", "5", "6"],
          },
        ],
      },
      {
        title: "Emma's Tablet Savings",
        passage:
          "Emma is saving money to buy a tablet. She already has $30. Every week, she saves $12. She uses the variable w to represent the number of weeks she saves money.",
        questions: [
          {
            questionType: "Variable Meaning",
            question: "What does the variable w represent?",
            correctAnswer: "The number of weeks Emma saves money",
            wrongAnswers: [
              "The total money Emma has",
              "The cost of the tablet",
              "The amount she already saved",
            ],
          },
          {
            questionType: "Expression",
            question: "Which expression represents Emma's total savings?",
            correctAnswer: "30 + 12w",
            wrongAnswers: ["12 + 30w", "30 − 12w", "42w"],
          },
          {
            questionType: "Evaluate",
            question: "How much will Emma have after saving for 4 weeks?",
            correctAnswer:
              "Step 1: Write the expression\nTotal = 30 + 12w\nStep 2: Substitute w = 4\n30 + 12(4) = 30 + 48\nAnswer: $78",
            wrongAnswers: ["$42", "$60", "$72"],
          },
        ],
      },
    ];

    return questionCounts.flatMap((count, passageIndex) => {
      const template = mathPassages[passageIndex % mathPassages.length]!;
      return Array.from({ length: count }, (_, questionIndex) => {
        const q = template.questions[questionIndex % template.questions.length]!;
        return {
          passage: template.passage,
          passageTitle: template.title,
          question: q.question,
          correctAnswer: q.correctAnswer,
          wrongAnswers: q.wrongAnswers,
          explanation: `This answer fits the story "${template.title}" about ${topic}.`,
          questionType: q.questionType,
        };
      });
    });
  }

  const isEnglish =
    detectQuizSubjectArea(input.subject, input.topic) === "english";

  if (isEnglish) {
    const englishStories: Array<{
      title: string;
      passage: string;
      questions: Array<{
        questionType: string;
        question: string;
        correctAnswer: string;
        wrongAnswers: [string, string, string];
      }>;
    }> = [
      {
        title: "The Mango Tree",
        passage: `Every afternoon after school, twelve-year-old Asha hurried to the large mango tree behind her grandmother's house. It was her favourite place to read and think. One afternoon, she noticed a small bird struggling with a piece of string tangled around its leg.

Although Asha was afraid the bird might fly away, she slowly moved closer and gently freed it. The bird chirped softly before flying into the branches above. As she watched it disappear into the leaves, Asha smiled, knowing that even a small act of kindness could make a big difference.

When her grandmother heard the story, she said, "Kindness is never wasted. It always finds its way back to the person who gives it."`,
        questions: [
          {
            questionType: "Main Idea",
            question: "What is the main idea of the passage?",
            correctAnswer: "A small act of kindness can make a difference.",
            wrongAnswers: [
              "Asha enjoys climbing trees.",
              "Birds like mango trees.",
              "Grandmothers enjoy telling stories.",
            ],
          },
          {
            questionType: "Detail",
            question: "Why did Asha move slowly toward the bird?",
            correctAnswer: "She did not want to frighten the bird away.",
            wrongAnswers: [
              "She did not like birds.",
              "She wanted to catch the bird.",
              "She was looking for mangoes.",
            ],
          },
          {
            questionType: "Vocabulary in Context",
            question: 'What does the word "struggling" mean as it is used in the passage?',
            correctAnswer: "Having difficulty getting free",
            wrongAnswers: [
              "Sleeping peacefully",
              "Singing loudly",
              "Flying very high",
            ],
          },
          {
            questionType: "Character Trait",
            question: "Which character trait best describes Asha?",
            correctAnswer: "Kind",
            wrongAnswers: ["Careless", "Selfish", "Impatient"],
          },
          {
            questionType: "Theme / Moral",
            question: "What lesson does the story teach?",
            correctAnswer:
              "Kindness often has a positive effect on others and ourselves.",
            wrongAnswers: [
              "Birds should not fly near trees.",
              "Reading is more important than helping others.",
              "Grandmothers always know everything.",
            ],
          },
          {
            questionType: "Textual Evidence",
            question:
              "Which sentence from the passage best supports the idea that Asha is caring?",
            correctAnswer: "She slowly moved closer and gently freed it.",
            wrongAnswers: [
              "It was her favourite place to read.",
              "The bird chirped softly.",
              "Her grandmother heard the story.",
            ],
          },
        ],
      },
      {
        title: "Saturday Market",
        passage: `On Saturday morning, Malik helped his mother at the busy market. He stacked baskets of sweet peppers and greeted each customer with a smile. When an elderly woman dropped her coins, Malik quickly gathered them and placed them gently in her hand.

His mother whispered that courtesy and honesty matter as much as selling well. Malik nodded, proud that a small helpful action could brighten someone's day while he learned words connected to ${topic}.`,
        questions: [
          {
            questionType: "Main Idea",
            question: "What is the main idea of the passage?",
            correctAnswer:
              "Malik shows that helpful, honest actions matter at the market.",
            wrongAnswers: [
              "Markets are only about stacking peppers.",
              "Malik refuses to help customers.",
              "His mother forbids him from speaking.",
            ],
          },
          {
            questionType: "Detail",
            question: "What did Malik do when the elderly woman dropped her coins?",
            correctAnswer:
              "He gathered them and placed them gently in her hand.",
            wrongAnswers: [
              "He ignored the coins and kept stacking baskets.",
              "He asked her to leave the market.",
              "He used the coins to buy peppers.",
            ],
          },
          {
            questionType: "Character Trait",
            question: "Which character trait best describes Malik?",
            correctAnswer: "Helpful",
            wrongAnswers: ["Rude", "Careless", "Dishonest"],
          },
        ],
      },
    ];

    return questionCounts.flatMap((count, passageIndex) => {
      const template = englishStories[passageIndex % englishStories.length]!;
      return Array.from({ length: count }, (_, questionIndex) => {
        const q = template.questions[questionIndex % template.questions.length]!;
        return {
          passage: template.passage,
          passageTitle: template.title,
          question: q.question,
          correctAnswer: q.correctAnswer,
          wrongAnswers: q.wrongAnswers,
          explanation: `This answer fits the story "${template.title}" about ${topic}.`,
          questionType: q.questionType,
        };
      });
    });
  }

  const passageTemplates = [
    `A short informational text explains important ideas related to ${topic}. It introduces key vocabulary through a clear example, then shows how those terms work together when the details change. Readers can infer each term's role from the surrounding sentences instead of from a pasted definition list. By the end, the passage makes the main idea of ${topic} easier to understand from context.`,
    `Another example connected to ${topic} puts the same kind of vocabulary to work in a new situation. Early sentences establish one core term, while later sentences show a related term shaping the outcome. Clues in the text help readers decide which detail best supports the writer's point about ${topic}.`,
    `A third informational paragraph revisits ${topic} with a practical scenario. The writer uses topic vocabulary naturally so meaning comes from use, not from a glossary dump. Readers who attend to those contextual clues can answer questions about the main idea, important details, and word meaning.`,
  ];

  return questionCounts.flatMap((count, passageIndex) => {
    const passage = passageTemplates[passageIndex % passageTemplates.length]!;
    return Array.from({ length: count }, (_, questionIndex) => ({
      passage,
      question:
        questionIndex === 0
          ? `What is the main idea of the passage?`
          : `According to the passage, how can readers learn the vocabulary for ${topic}?`,
      correctAnswer:
        questionIndex === 0
          ? `The passage explains ${topic} by using key vocabulary in a clear example.`
          : `They infer each term's meaning from how it is used in the surrounding sentences.`,
      wrongAnswers: [
        `By ignoring the example and memorizing unrelated words.`,
        `By reading only a glossary list with no context.`,
        `By skipping the passage and guessing at random.`,
      ] as [string, string, string],
      explanation: `This answer best fits reading passage ${passageIndex + 1} at ${input.difficultyLevel} level.`,
      questionType: questionIndex === 0 ? "Main Idea" : "Detail",
    }));
  });
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

  let lessonContext: string | null = null;
  let savedLessonPlan: Awaited<ReturnType<typeof resolveQuizLessonPlan>> = null;

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
    lessonContext = buildLessonPlanPassageQuizContext({
      input: savedLessonPlan.input,
      result: savedLessonPlan.result,
      dayScope: input.dayScope,
    });
  }

  const { system, user } = buildTeacherQuizReadingPassagePrompt({
    subject: input.subject,
    gradeLevel: input.gradeLevel,
    topic: input.topic,
    difficultyLevel: String(input.difficultyLevel),
    questionCounts: activeCounts,
    lessonPlanContext: lessonContext,
  });

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

  if (!process.env.OPENAI_API_KEY?.trim()) {
    return lessonFallback();
  }

  try {
    const { output } = await trackedGenerateText({
      model: openai("gpt-4o"),
      output: Output.object({
        schema: teacherQuizMultiPassageResultSchema,
      }),
      system,
      prompt: user,
    });

    if (!output?.passages?.length) {
      throw new Error("AI quiz generation returned no output.");
    }

    const expanded = expandMultiPassageToQuizCards(output, activeCounts);
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

  const passageQuestionCounts = parsed.data.readingPassageQuestions
    ? (parsed.data.readingPassageQuestionCounts ?? [])
    : [];
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
