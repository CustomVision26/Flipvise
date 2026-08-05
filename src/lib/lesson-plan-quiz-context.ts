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

/**
 * Curriculum source for reading-passage generation.
 * Lesson plan drives the lesson; vocabulary is supporting information only.
 */
export function buildLessonPlanPassageQuizContext(input: {
  input: LessonPlanInput;
  result: LessonPlanResult;
  dayScope?: LessonPlanDayScope;
}): string {
  const { input: lessonInput, result } = input;
  const dayScope = input.dayScope ?? "all";
  const scopedDayIndex = isLessonPlanDayScopeAll(dayScope) ? null : dayScope.dayIndex;
  const scopedDay =
    scopedDayIndex != null
      ? (result.weeklySchedule?.[scopedDayIndex] ?? null)
      : null;
  const dayLabel =
    scopedDay && scopedDayIndex != null
      ? formatLessonPlanDayScopeLabel(scopedDay, scopedDayIndex)
      : null;
  const vocabEntries = resolvePassageVocabulary(result, dayScope);
  const vocabTerms = formatLessonVocabularyTermsForPassage(vocabEntries);
  const vocabFocusFromDetail =
    scopedDay?.vocabularyDetail?.fiveEBreakdown?.phases
      ?.flatMap((phase) => phase.vocabularyFocus)
      .filter(Boolean) ?? [];
  const uniqueFocus = [...new Set(vocabFocusFromDetail)];

  const lines = [
    "=== CURRICULUM SOURCE (Lesson Plan) ===",
    "This Lesson Plan is the AI's primary curriculum source. Understand the lesson before writing.",
    "",
    `Lesson title: ${result.lessonTitle}`,
    `Subject: ${lessonInput.subject}`,
    `Grade level: ${lessonInput.gradeLevel}`,
    `Topic / description: ${lessonInput.topic}`,
    `Difficulty: ${lessonInput.difficultyLevel}`,
    `Lesson duration: ${lessonInput.lessonDuration}`,
  ];

  if (lessonInput.planPeriodDays && lessonInput.planPeriodDays > 1) {
    lines.push(
      `Plan period: ${lessonInput.planPeriodDays} days (${lessonInput.lessonDuration} per class)`,
    );
  }
  if (dayLabel) {
    lines.push(
      `Generation scope: ${dayLabel} only — ground passages in this day's focus, timeline, and vocabulary; do not pull other days' content.`,
    );
  }
  if (lessonInput.learningStandard?.trim()) {
    lines.push(`Learning standard: ${lessonInput.learningStandard.trim()}`);
  }
  if (lessonInput.classSize?.trim()) {
    lines.push(`Class size: ${lessonInput.classSize.trim()}`);
  }
  if (lessonInput.specialInstructions?.trim()) {
    lines.push(`Accommodations / special instructions: ${lessonInput.specialInstructions.trim()}`);
  }

  lines.push(
    "",
    "=== LEARNING OBJECTIVES (what students should learn / be assessed on) ===",
    ...(result.learningObjectives.length > 0
      ? result.learningObjectives.map((item) => `- ${item}`)
      : ["- (none listed — infer from topic and standards)"]),
  );

  if (scopedDay) {
    lines.push(
      "",
      `=== DAY FOCUS (${dayLabel}) ===`,
      scopedDay.dailyFocus,
      "",
      `=== LESSON ACTIVITIES / TIMELINE (${dayLabel} — concept scope only; do not narrate the class period as the passage plot) ===`,
      ...scopedDay.lessonTimeline.map((item) => `- ${item}`),
    );
  } else {
    lines.push(
      "",
      "=== LESSON ACTIVITIES (use when useful for authentic educational contexts; do not retell as a class diary) ===",
      `Warm-up: ${result.warmUpActivity}`,
      "Main teaching steps:",
      ...result.mainTeachingSteps.map((item) => `- ${item}`),
      `Classroom activity: ${result.classroomActivity}`,
      "Class timeline:",
      ...result.lessonTimeline.map((item) => `- ${item}`),
    );
  }

  lines.push(
    "",
    "=== MATERIALS ===",
    ...(result.materialsNeeded.length > 0
      ? result.materialsNeeded.map((item) => `- ${item}`)
      : ["- (none listed)"]),
    "",
    "=== VOCABULARY (supporting information — NOT the lesson driver) ===",
    "Use several terms naturally inside realistic situations. Do NOT write one passage per vocabulary word.",
    "Teacher-facing definitions may appear below for YOUR understanding — never paste definition lists into student passages.",
    ...(vocabEntries.length > 0
      ? vocabEntries.map((item) => `- ${item}`)
      : [`- ${lessonInput.topic}`]),
  );

  if (vocabTerms.length > 0) {
    lines.push(
      "",
      "Vocabulary TERMS (natural use inside situations):",
      ...vocabTerms.map((term) => `- ${term}`),
    );
  }
  if (uniqueFocus.length > 0) {
    lines.push(
      "",
      "Vocabulary focus (emphasize naturally when relevant):",
      ...uniqueFocus.map((term) => `- ${term}`),
    );
  }
  if (scopedDay?.vocabularyDetail) {
    lines.push(
      "",
      "Vocabulary teaching detail (for curriculum understanding only):",
      ...formatVocabularyDetailForContext(scopedDay.vocabularyDetail),
    );
  }

  lines.push(
    "",
    "=== ASSESSMENT IDEAS FROM LESSON PLAN (adapt only when they fit the passage situation) ===",
    ...(result.assessmentQuestions.length > 0
      ? result.assessmentQuestions.map((item) => `- ${item}`)
      : ["- (none listed)"]),
    "",
    "=== HOMEWORK / FOLLOW-UP (optional authenticity only) ===",
    result.homework || "(none)",
    "",
    "=== TEACHER NOTES (optional curriculum cues — do not copy into student text) ===",
    result.teacherNotes || "(none)",
  );

  appendReferenceMaterials(lines, lessonInput, "quiz");

  lines.push(
    "",
    "=== CURRICULUM-DRIVEN GENERATION RULES ===",
    "1. Understand Learning Standards, Learning Objectives, competencies, and topic BEFORE writing.",
    "2. Decide the best educational context for THIS subject/lesson (shopping, lab investigation, workshop incident, civic issue, diary, troubleshooting, etc.).",
    "3. Create UNIQUE educational situations that teach the lesson — each passage needs a different central event.",
    "4. Vocabulary supports the lesson; never generate one passage per vocabulary word.",
    "5. Each passage must reinforce one or more learning objectives.",
    "6. Write like an experienced educator, not a dictionary or template repeater.",
    "7. Never open by restating Subject/Grade/Topic form fields as a class diary.",
  );

  return lines.join("\n");
}

const FALLBACK_CHARACTER_NAMES = [
  "Kai",
  "Marissa",
  "Devon",
  "Aaliyah",
  "Omar",
  "Tiana",
  "Ricardo",
  "Naomi",
] as const;

const FALLBACK_EDUCATIONAL_CONTEXTS = [
  "Practical Decision",
  "Team Observation",
  "Inspection Review",
  "Client Situation",
  "Emergency Drill Reflection",
  "Planning Meeting",
  "Field Observation",
  "Process Audit",
] as const;

/** Curriculum-driven fallbacks grounded in lesson objectives (not one passage per vocab word). */
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
  educationalContext?: string;
  vocabularyUsed?: string[];
  learningObjectivesCovered?: string[];
  question: string;
  correctAnswer: string;
  wrongAnswers: [string, string, string];
  explanation: string;
  questionType?: string;
}> {
  const { result } = lesson;
  const scopedVocab = resolvePassageVocabulary(result, dayScope);
  const vocabTerms = formatLessonVocabularyTermsForPassage(
    scopedVocab.length > 0 ? scopedVocab : [meta.topic],
  );
  const objectives =
    result.learningObjectives.length > 0
      ? result.learningObjectives
      : [`Understand key ideas about ${meta.topic}`];
  const learningStandard = lesson.input.learningStandard?.trim() || null;
  const activeCounts = questionCounts.filter((count) => count >= 1);

  return activeCounts.flatMap((count, passageIndex) => {
    const objective = objectives[passageIndex % objectives.length]!;
    const termA = vocabTerms[passageIndex % vocabTerms.length] ?? meta.topic;
    const termB =
      vocabTerms[(passageIndex + 1) % vocabTerms.length] ?? termA;
    const character =
      FALLBACK_CHARACTER_NAMES[passageIndex % FALLBACK_CHARACTER_NAMES.length]!;
    const educationalContext =
      FALLBACK_EDUCATIONAL_CONTEXTS[
        passageIndex % FALLBACK_EDUCATIONAL_CONTEXTS.length
      ]!;
    const title = `${educationalContext}: ${meta.topic}`;
    const standardNote = learningStandard
      ? ` This aligns with ${learningStandard} for ${meta.gradeLevel}.`
      : "";
    const passage = `${character} faces a realistic ${meta.subject} situation connected to ${meta.topic.toLowerCase()}. During the ${educationalContext.toLowerCase()}, ${character} must decide how to apply ideas such as ${termA} and ${termB} so the outcome stays responsible and effective.

At a critical moment, an incomplete choice creates a clear problem. A mentor or peer helps ${character} pause, examine the situation, and reconnect the decision to the learning goal: ${objective}.${standardNote}

By the end, ${character} can explain what should have been done and why those lesson ideas matter in a similar future situation.`;

    const questions = [
      {
        questionType: "Multiple Choice",
        question: `What learning challenge does ${character} face in this situation?`,
        correctAnswer: `Applying lesson ideas such as ${termA} correctly when a real decision is required.`,
        wrongAnswers: [
          "Memorizing a dictionary definition with no situation.",
          "Ignoring the problem because nobody was watching.",
          "Skipping the lesson goal to finish faster.",
        ] as [string, string, string],
      },
      {
        questionType: "Critical Thinking",
        question: `Which choice best supports the objective "${objective}"?`,
        correctAnswer: `Pause, examine the situation, and apply ${termA} and ${termB} appropriately.`,
        wrongAnswers: [
          "Repeat the incomplete choice and hope for a better result.",
          "Avoid using any lesson vocabulary in the response.",
          "Blame a classmate without reviewing the decision.",
        ] as [string, string, string],
      },
      {
        questionType: "Practical/Application",
        question: `What should ${character} do next time a similar situation appears?`,
        correctAnswer: `Use the lesson ideas in context before acting, especially ${termA}.`,
        wrongAnswers: [
          "Act first and review the lesson only after a problem appears.",
          "Treat the vocabulary as optional decoration.",
          "Copy someone else's work without understanding the goal.",
        ] as [string, string, string],
      },
    ];

    return Array.from({ length: count }, (_, questionIndex) => {
      const q = questions[questionIndex % questions.length]!;
      return {
        passage,
        passageTitle: title,
        educationalContext,
        scenarioCategory: educationalContext,
        scenarioSummary: `${character} resolves a ${educationalContext.toLowerCase()} involving ${termA}.`,
        vocabularyUsed: [termA, termB].filter(
          (term, index, all) => all.indexOf(term) === index,
        ),
        learningObjectivesCovered: [objective],
        question: q.question,
        correctAnswer: q.correctAnswer,
        wrongAnswers: q.wrongAnswers,
        explanation: [
          `This answer supports "${title}" for objective: ${objective} (${q.questionType}).`,
          `Educational context: ${educationalContext}`,
          `Vocabulary used: ${termA}; ${termB}`,
        ].join("\n\n"),
        questionType: q.questionType,
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
