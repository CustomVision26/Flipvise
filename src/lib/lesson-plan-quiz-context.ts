import type { LessonPlanDayVocabularyDetail } from "@/lib/lesson-plan-ai-schema";
import {
  formatLessonPlanDayScopeLabel,
  isLessonPlanDayScopeAll,
  type LessonPlanDayScope,
} from "@/lib/lesson-plan-day-scope";
import {
  formatLessonPlanReferencesForGeneratorContext,
  getLessonPlanReferenceMaterials,
} from "@/lib/lesson-plan-reference-material";
import type { LessonPlanInput, LessonPlanResult } from "@/lib/teacher-generators";

function formatVocabularyDetailForContext(
  detail: LessonPlanDayVocabularyDetail,
): string[] {
  const lines: string[] = [detail.contextIntro, "", "Expanded vocabulary:"];

  for (const term of detail.terms) {
    lines.push(`- ${term.term} — ${term.definition}`);
    if (term.example) {
      lines.push(`  Example: ${term.example}`);
    }
  }

  if (detail.fiveEBreakdown) {
    lines.push("", detail.fiveEBreakdown.heading);
    if (detail.fiveEBreakdown.intro) {
      lines.push(detail.fiveEBreakdown.intro);
    }
    for (const phase of detail.fiveEBreakdown.phases) {
      lines.push(
        `${phase.timeRange}: ${phase.phase} — ${phase.activitySummary}`,
        phase.detail,
      );
      if (phase.vocabularyFocus.length > 0) {
        lines.push(`Vocabulary focus: ${phase.vocabularyFocus.join(", ")}`);
      }
    }
  }

  if (detail.mainConcept) {
    lines.push("", detail.mainConcept.heading, detail.mainConcept.body);
  }

  if (detail.process) {
    lines.push("", detail.process.heading);
    for (const step of detail.process.steps) {
      lines.push(`${step.stepNumber}. ${step.title}`);
      for (const bullet of step.bullets) {
        lines.push(`  - ${bullet}`);
      }
    }
  }

  if (detail.learningGoal) {
    lines.push("", detail.learningGoal.heading);
    if (detail.learningGoal.intro) {
      lines.push(detail.learningGoal.intro);
    }
    for (const objective of detail.learningGoal.objectives) {
      lines.push(`- ${objective}`);
    }
  }

  if (detail.additionalVocabulary?.length) {
    lines.push("", "Additional vocabulary:");
    for (const term of detail.additionalVocabulary) {
      lines.push(`- ${term.term} — ${term.definition}`);
      if (term.example) {
        lines.push(`  Example: ${term.example}`);
      }
    }
  }

  return lines;
}

function appendReferenceMaterials(
  lines: string[],
  lessonInput: LessonPlanInput,
  referencePurpose: "quiz" | "homework" | "study guide",
) {
  const references = getLessonPlanReferenceMaterials(lessonInput);
  if (references.length > 0) {
    lines.push(
      "",
      formatLessonPlanReferencesForGeneratorContext(references, referencePurpose),
    );
  }
}

function buildFullLessonPlanQuizContext(input: {
  input: LessonPlanInput;
  result: LessonPlanResult;
  referencePurpose: "quiz" | "homework" | "study guide";
}): string {
  const { input: lessonInput, result } = input;
  const lines = [
    `Lesson title: ${result.lessonTitle}`,
    `Subject: ${lessonInput.subject}`,
    `Grade level: ${lessonInput.gradeLevel}`,
    `Topic: ${lessonInput.topic}`,
    `Difficulty: ${lessonInput.difficultyLevel}`,
    `Lesson duration: ${lessonInput.lessonDuration}`,
  ];

  if (lessonInput.planPeriodDays && lessonInput.planPeriodDays > 1) {
    lines.push(
      `Plan period: ${lessonInput.planPeriodDays} days (${lessonInput.lessonDuration} per class)`,
    );
  }

  if (lessonInput.learningStandard?.trim()) {
    lines.push(`Learning standard: ${lessonInput.learningStandard.trim()}`);
  }
  if (lessonInput.classSize?.trim()) {
    lines.push(`Class size: ${lessonInput.classSize.trim()}`);
  }
  if (lessonInput.specialInstructions?.trim()) {
    lines.push(`Accommodations: ${lessonInput.specialInstructions.trim()}`);
  }

  lines.push(
    "",
    "Learning objectives:",
    ...result.learningObjectives.map((item) => `- ${item}`),
    "",
    "Vocabulary:",
    ...result.vocabulary.map((item) => `- ${item}`),
  );

  if (result.weeklySchedule?.length) {
    lines.push("", "Daily vocabulary pacing:");
    for (const day of result.weeklySchedule) {
      lines.push(
        `${day.dayLabel}: ${day.dailyFocus}`,
        ...day.vocabulary.map((item) => `  - ${item}`),
      );
    }
  }

  lines.push(
    "",
    "Assessment questions from lesson plan:",
    ...result.assessmentQuestions.map((item) => `- ${item}`),
    "",
    "Main teaching steps:",
    ...result.mainTeachingSteps.map((item) => `- ${item}`),
    "",
    "Classroom activity:",
    result.classroomActivity,
    "",
    "Homework:",
    result.homework,
  );

  appendReferenceMaterials(lines, lessonInput, input.referencePurpose);
  return lines.join("\n");
}

function buildDayScopedLessonPlanQuizContext(input: {
  input: LessonPlanInput;
  result: LessonPlanResult;
  referencePurpose: "quiz" | "homework" | "study guide";
  dayIndex: number;
}): string {
  const { input: lessonInput, result, dayIndex } = input;
  const day = result.weeklySchedule?.[dayIndex];
  if (!day) {
    return buildFullLessonPlanQuizContext(input);
  }

  const dayLabel = formatLessonPlanDayScopeLabel(day, dayIndex);
  const lines = [
    `Lesson title: ${result.lessonTitle}`,
    `Subject: ${lessonInput.subject}`,
    `Grade level: ${lessonInput.gradeLevel}`,
    `Topic: ${lessonInput.topic}`,
    `Difficulty: ${lessonInput.difficultyLevel}`,
    `Lesson duration: ${lessonInput.lessonDuration}`,
    `Generation scope: ${dayLabel} only — generate cards ONLY from this day's content. Do not use other days' vocabulary, focus, timeline, or activities.`,
  ];

  if (lessonInput.planPeriodDays && lessonInput.planPeriodDays > 1) {
    lines.push(
      `Plan period: ${lessonInput.planPeriodDays} days (${lessonInput.lessonDuration} per class); scoped to ${dayLabel}`,
    );
  }

  if (lessonInput.learningStandard?.trim()) {
    lines.push(`Learning standard: ${lessonInput.learningStandard.trim()}`);
  }
  if (lessonInput.classSize?.trim()) {
    lines.push(`Class size: ${lessonInput.classSize.trim()}`);
  }
  if (lessonInput.specialInstructions?.trim()) {
    lines.push(`Accommodations: ${lessonInput.specialInstructions.trim()}`);
  }

  lines.push(
    "",
    "Learning objectives (unit framing — prioritize this day's focus below):",
    ...result.learningObjectives.map((item) => `- ${item}`),
    "",
    `${dayLabel} — daily focus:`,
    day.dailyFocus,
    "",
    `Vocabulary (${dayLabel} only):`,
    ...day.vocabulary.map((item) => `- ${item}`),
    "",
    `Class timeline (${dayLabel} only):`,
    ...day.lessonTimeline.map((item) => `- ${item}`),
  );

  if (day.vocabularyDetail) {
    lines.push(
      "",
      `Vocabulary detail (${dayLabel} only):`,
      ...formatVocabularyDetailForContext(day.vocabularyDetail),
    );
  }

  appendReferenceMaterials(lines, lessonInput, input.referencePurpose);
  return lines.join("\n");
}

export function buildLessonPlanQuizContext(input: {
  input: LessonPlanInput;
  result: LessonPlanResult;
  referencePurpose?: "quiz" | "homework" | "study guide";
  dayScope?: LessonPlanDayScope;
}): string {
  const referencePurpose = input.referencePurpose ?? "quiz";
  const dayScope = input.dayScope ?? "all";

  if (
    !isLessonPlanDayScopeAll(dayScope) &&
    (input.result.weeklySchedule?.length ?? 0) > 0
  ) {
    return buildDayScopedLessonPlanQuizContext({
      input: input.input,
      result: input.result,
      referencePurpose,
      dayIndex: dayScope.dayIndex,
    });
  }

  return buildFullLessonPlanQuizContext({
    input: input.input,
    result: input.result,
    referencePurpose,
  });
}

/** Pulls the vocabulary TERM name when lesson vocab is stored as "Term — definition". */
export function extractLessonVocabularyTerm(entry: string): string {
  const trimmed = entry.trim();
  if (!trimmed) return trimmed;

  const split = trimmed.split(/\s*[—–:]\s+|\s+-\s+/);
  const term = (split[0] ?? trimmed).trim();
  return term || trimmed;
}

export function formatLessonVocabularyTermsForPassage(vocabulary: string[]): string[] {
  return vocabulary
    .map(extractLessonVocabularyTerm)
    .filter((term) => term.length > 0);
}

/** Vocabulary TERMS for homework / quiz generation under a day scope (definitions stripped). */
export function getLessonPlanVocabularyTermsForScope(
  result: LessonPlanResult,
  dayScope?: LessonPlanDayScope,
): string[] {
  return formatLessonVocabularyTermsForPassage(
    resolvePassageVocabulary(result, dayScope ?? "all"),
  );
}

function resolvePassageVocabulary(
  result: LessonPlanResult,
  dayScope?: LessonPlanDayScope,
): string[] {
  if (
    dayScope &&
    !isLessonPlanDayScopeAll(dayScope) &&
    result.weeklySchedule?.[dayScope.dayIndex]
  ) {
    return result.weeklySchedule[dayScope.dayIndex]!.vocabulary;
  }
  return result.vocabulary;
}

/** Passage-quiz context — one shared informational passage + linked comprehension questions. */
export function buildLessonPlanPassageQuizContext(input: {
  input: LessonPlanInput;
  result: LessonPlanResult;
  dayScope?: LessonPlanDayScope;
}): string {
  const { result } = input;
  const base = buildLessonPlanQuizContext(input);
  const dayScope = input.dayScope ?? "all";
  const scopedDayIndex = isLessonPlanDayScopeAll(dayScope) ? null : dayScope.dayIndex;
  const scopedDay =
    scopedDayIndex != null
      ? (result.weeklySchedule?.[scopedDayIndex] ?? null)
      : null;
  const vocabTerms = formatLessonVocabularyTermsForPassage(
    resolvePassageVocabulary(result, dayScope),
  );

  const sourceMaterial = scopedDay
    ? `Vocabulary / concept scope (${formatLessonPlanDayScopeLabel(scopedDay, scopedDayIndex!)} only):
- Daily focus (conceptual theme — do NOT narrate the class period): ${scopedDay.dailyFocus}
- Timeline bullets below are for concept scope only — do NOT turn them into a story about what students did: ${scopedDay.lessonTimeline.join("; ")}
- Use only this day's vocabulary terms below as the passage focus`
    : `Vocabulary / concept scope (full plan):
- Conceptual theme from topic and vocabulary TERMS below — NOT warm-up, classroom activity, homework, or teacher-note scripts
- If the plan mentions sample texts or content examples, you may reuse the CONTENT IDEA only; never summarize the activity itself`;

  return `${base}

${sourceMaterial}

Lesson vocabulary TERMS only (these are the words the passage should teach through use — NEVER paste definitions into the passage):
${vocabTerms.length > 0 ? vocabTerms.map((term) => `- ${term}`).join("\n") : `- ${input.input.topic}`}

Note: The Vocabulary section earlier may include teacher-facing definitions for reference only. Do not copy those definition strings into the student reading passage. Activity sections, timelines, warm-ups, homework, and teacher notes are NOT material to retell.

Instructions for the reading passage set:
- Write one or more short informational reading passages geared toward LEARNING THE VOCABULARY for this scope (PEP Language Arts style) — match the requested per-passage question counts
- Base each passage on the TOPIC OF THE VOCABULARY (terms used correctly in meaningful content), not on summarizing lesson-plan notes or classroom meta-narrative
- Naturally weave the vocabulary TERMS above into each passage so meaning is clear from context; questions can then test Main Idea / Detail / Vocab in Context / Inference / Evidence about those terms
- Never include "Term — definition", "Term: definition", or pasted glossary lines inside any paragraph
- NEVER open with or include boilerplate that restates Subject / Grade / Topic form fields (ban: "In {subject} class, grade {grade} learners explored {topic}…", "A small group in {subject} worked through…", "partners discussed…", "group wrote a takeaway…", "comparing notes…")
- Each comprehension question must link only to its own passage
- Prefer question variety (Main Idea, Detail, Recall, Vocabulary in Context, Inference, Author's Purpose, Evidence) adapted to the subject
- Every question must be answerable only from its own passage
- For reading/language lessons, prefer narrative or informational mini-texts with grade-appropriate characters/settings centered on the vocabulary topic
${
  scopedDay
    ? "- Stay within the selected lesson-plan day scope above; do not introduce vocabulary or concepts from other days"
    : ""
}`;
}

export function buildLessonPlanPassageFallbackQuestions(
  questionCounts: number[],
  meta: {
    subject: string;
    gradeLevel: string;
    topic: string;
    difficultyLevel: string;
  },
  lesson: { input: LessonPlanInput; result: LessonPlanResult },
  dayScope?: LessonPlanDayScope,
): Array<{
  passage: string;
  passageTitle?: string;
  question: string;
  correctAnswer: string;
  wrongAnswers: [string, string, string];
  explanation: string;
  questionType?: string;
}> {
  const { result } = lesson;
  const scopedVocab = resolvePassageVocabulary(result, dayScope);
  const vocabEntries = scopedVocab.length > 0 ? scopedVocab : [meta.topic];
  const vocabTerms = formatLessonVocabularyTermsForPassage(vocabEntries);
  const v1 = vocabTerms[0] ?? meta.topic;
  const v2 = vocabTerms[1] ?? vocabTerms[0] ?? meta.topic;
  const v3 = vocabTerms[2] ?? vocabTerms[0] ?? meta.topic;
  const assessments =
    result.assessmentQuestions.length > 0
      ? result.assessmentQuestions
      : [`What is the main idea about ${meta.topic}?`];
  const isReadingLesson = /reading|comprehension|language arts|\bela\b|english|literacy/i.test(
    `${meta.subject} ${meta.topic}`,
  );
  const isMathLesson = /math|algebra|geometry|calculus|arithmetic|equation|expression|variable|inequalit|coefficient|distributive|like terms|order of operations/i.test(
    `${meta.subject} ${meta.topic} ${v1} ${v2}`,
  );

  if (isMathLesson) {
    const mathStories: Array<{
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
        passage: `Emma is saving money connected to ${meta.topic.toLowerCase()}. She already has $30. Every week, she saves $12. She uses the variable w to represent the number of weeks she saves money. Ideas such as ${v1} appear naturally in how she tracks her savings.`,
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

    const activeCounts = questionCounts.filter((count) => count >= 1);
    return activeCounts.flatMap((count, passageIndex) => {
      const story = mathStories[passageIndex % mathStories.length]!;
      return Array.from({ length: count }, (_, questionIndex) => {
        const q = story.questions[questionIndex % story.questions.length]!;
        return {
          passage: story.passage,
          passageTitle: story.title,
          question: q.question,
          correctAnswer: q.correctAnswer,
          wrongAnswers: q.wrongAnswers,
          explanation: `This answer is supported by the story "${story.title}" on ${meta.topic} (${q.questionType}).`,
          questionType: q.questionType,
        };
      });
    });
  }

  if (isReadingLesson) {
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
        passage: `Every afternoon after school, twelve-year-old Asha hurried to the large mango tree behind her grandmother's house. It was her favourite place to read and think about ideas such as ${v1}. One afternoon, she noticed a small bird struggling with a piece of string tangled around its leg.

Although Asha was afraid the bird might fly away, she slowly moved closer and gently freed it. The bird chirped softly before flying into the branches above. As she watched it disappear into the leaves, Asha smiled, knowing that even a small act of kindness—and understanding ${v2}—could make a big difference.

When her grandmother heard the story, she said, "Kindness is never wasted. It always finds its way back to the person who gives it, just as ${v3} can grow when we pay attention."`,
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
            question: `What does the word "struggling" mean as it is used in the passage?`,
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
              "It was her favourite place to read and think.",
              "The bird chirped softly.",
              "Her grandmother heard the story.",
            ],
          },
        ],
      },
      {
        title: "River Saturday",
        passage: `On Saturday, Kai and his cousin walked along the river path. Kai remembered his teacher's lesson about ${v1} and watched how the water changed after the rain. When a younger child slipped near the bank, Kai held out his hand with care and helped the child stand safely.

Later, Kai told his grandmother that ${v2} and ${v3} were not only words in a book—they showed up whenever people chose to help one another. His grandmother smiled and said a thoughtful story always leaves a lesson behind.`,
        questions: [
          {
            questionType: "Main Idea",
            question: "What is the main idea of the passage?",
            correctAnswer:
              "Kai learns that lesson ideas appear when people choose to help others.",
            wrongAnswers: [
              "Kai only wants to play by the river.",
              "Rain makes river paths unsafe forever.",
              "Grandmothers dislike Saturday walks.",
            ],
          },
          {
            questionType: "Detail",
            question: "What did Kai do when the younger child slipped?",
            correctAnswer: "He held out his hand and helped the child stand safely.",
            wrongAnswers: [
              "He laughed and kept walking.",
              "He ran home without looking back.",
              "He asked the child to leave the path.",
            ],
          },
          {
            questionType: "Vocabulary in Context",
            question: `How does the passage help readers understand "${v1}"?`,
            correctAnswer: `It shows "${v1}" through Kai's careful attention and helpful actions by the river.`,
            wrongAnswers: [
              `It prints a glossary definition of "${v1}" in the story.`,
              `It tells readers to ignore "${v1}" completely.`,
              `It replaces "${v1}" with an unrelated math formula.`,
            ],
          },
          {
            questionType: "Character Trait",
            question: "Which character trait best describes Kai?",
            correctAnswer: "Caring",
            wrongAnswers: ["Selfish", "Rude", "Careless"],
          },
          {
            questionType: "Theme / Moral",
            question: "What lesson does the story teach?",
            correctAnswer:
              "Ideas from lessons matter most when we put them into kind actions.",
            wrongAnswers: [
              "Children should never walk near rivers.",
              "Only teachers can use important words.",
              "Helping others is never worthwhile.",
            ],
          },
        ],
      },
    ];

    const activeCounts = questionCounts.filter((count) => count >= 1);
    return activeCounts.flatMap((count, passageIndex) => {
      const story = englishStories[passageIndex % englishStories.length]!;
      return Array.from({ length: count }, (_, questionIndex) => {
        const q = story.questions[questionIndex % story.questions.length]!;
        return {
          passage: story.passage,
          passageTitle: story.title,
          question: q.question,
          correctAnswer: q.correctAnswer,
          wrongAnswers: q.wrongAnswers,
          explanation: `This answer is supported by the story "${story.title}" on ${meta.topic} (${q.questionType}).`,
          questionType: q.questionType,
        };
      });
    });
  }

  const passageTemplates = [
        `In a real-world situation involving ${meta.topic.toLowerCase()}, people often need a clear way to talk about ${v1}. They use ${v1} together with ${v2} so the ideas stay precise when the numbers or details change. Later, ${v3} helps them check whether their explanation still makes sense. Reading how ${v1}, ${v2}, and ${v3} work in the example teaches the vocabulary through use, not through a pasted definition list.`,
        `Consider a practical example connected to ${meta.topic.toLowerCase()}. First, ${v1} names an important idea in the situation. Next, ${v2} shows how that idea relates to other details. Finally, ${v3} helps decide what conclusion fits the facts. The short text uses each term naturally so readers can learn the vocabulary from context.`,
        `A clear informational explanation of ${meta.topic.toLowerCase()} shows ${v1} and ${v2} working side by side. When the details change, ${v3} becomes useful for deciding what still holds true. Because the terms appear in meaningful sentences, readers can answer questions about what ${v1} means in this passage without needing a glossary dump.`,
      ];

  const questionBlueprints: Array<{
    questionType: string;
    question: string;
    correctAnswer: string;
    wrongAnswers: [string, string, string];
  }> = [
    {
      questionType: "Main Idea",
      question: `What is the main idea of the passage?`,
      correctAnswer: `The passage explains ${meta.topic.toLowerCase()} by using key terms such as ${v1} and ${v2} in a meaningful example.`,
      wrongAnswers: [
        `The passage is mainly about skipping the topic entirely.`,
        `The passage only lists dictionary definitions with no example.`,
        `The passage argues that ${v1} and ${v2} should never be used.`,
      ],
    },
    {
      questionType: "Detail",
      question: `Which detail from the passage best involves "${v1}"?`,
      correctAnswer: `The passage shows "${v1}" being used as part of a real-world or content example.`,
      wrongAnswers: [
        `The passage never mentions "${v1}" at all.`,
        `The passage only says to ignore "${v1}" and memorize unrelated words.`,
        `The passage replaces "${v1}" with a completely different subject.`,
      ],
    },
    {
      questionType: "Vocabulary in Context",
      question: `How does the passage help readers understand the idea of "${v1}"?`,
      correctAnswer: `It shows "${v1}" being used correctly in context so readers can infer its meaning from the surrounding sentences.`,
      wrongAnswers: [
        `It prints a full glossary entry for "${v1}" inside the paragraph.`,
        `It tells readers to ignore "${v1}" and memorize unrelated words.`,
        `It replaces "${v1}" with a topic from a different subject.`,
      ],
    },
    {
      questionType: "Inference",
      question: `What can readers infer from the passage?`,
      correctAnswer: `Paying attention to how ${v1} and ${v2} are used in the example helps readers make sense of the vocabulary.`,
      wrongAnswers: [
        `Readers learn best when they skip the passage and copy answers.`,
        `The passage avoids using any of the lesson vocabulary.`,
        `The passage shows that ${meta.topic} has no connection to ${v1}.`,
      ],
    },
    {
      questionType: "Evidence",
      question: assessments[0]!.endsWith("?")
        ? assessments[0]!
        : `Which detail from the passage best supports learning about ${meta.topic}?`,
      correctAnswer: `The example shows ${v1} and ${v2} working together in a situation related to ${meta.topic.toLowerCase()}.`,
      wrongAnswers: [
        `The passage never uses ${v1}, ${v2}, or ${v3}.`,
        `The passage only copies glossary lines with no example.`,
        `The passage claims ${meta.topic} is unrelated to ${v1}.`,
      ],
    },
  ];

  const activeCounts = questionCounts.filter((count) => count >= 1);
  return activeCounts.flatMap((count, passageIndex) => {
    const passage =
      passageTemplates[passageIndex % passageTemplates.length]!;
    return Array.from({ length: count }, (_, questionIndex) => {
      const blueprint =
        questionBlueprints[questionIndex % questionBlueprints.length]!;
      return {
        passage,
        question: blueprint.question,
        correctAnswer: blueprint.correctAnswer,
        wrongAnswers: blueprint.wrongAnswers,
        explanation: `This answer is supported by reading passage ${passageIndex + 1} on ${meta.topic} (${blueprint.questionType}).`,
        questionType: blueprint.questionType,
      };
    });
  });
}

export function lessonPlanInputToQuizDefaults(
  lessonInput: LessonPlanInput,
): {
  subject: string;
  gradeLevel: string;
  topic: string;
  difficultyLevel: string;
} {
  return {
    subject: lessonInput.subject,
    gradeLevel: lessonInput.gradeLevel,
    topic: lessonInput.topic,
    difficultyLevel:
      lessonInput.difficultyLevel === "All"
        ? "Intermediate"
        : lessonInput.difficultyLevel,
  };
}
