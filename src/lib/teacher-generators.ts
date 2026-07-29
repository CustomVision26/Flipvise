import {
  difficultyLabelForContent,
  getDifficultyRigorProfile,
} from "@/lib/lesson-plan-difficulty";
import type { LessonPlanDaySchedule } from "@/lib/lesson-plan-ai-schema";
import {
  buildWeeklyScheduleFromVocabulary,
  clampPlanPeriodDays,
  DEFAULT_PLAN_PERIOD_DAYS,
} from "@/lib/lesson-plan-weekly-schedule";
import { buildTopicVocabularyLines } from "@/lib/lesson-plan-vocabulary-banks";
import type { LessonPlanReferenceMaterial } from "@/lib/lesson-plan-reference-material";
import { PRO_PLUS_CARDS_PER_DECK_LIMIT } from "@/lib/personal-plan-limits";
import type { HomeworkResult } from "@/lib/teacher-homework-ai-schema";

export type { HomeworkResult } from "@/lib/teacher-homework-ai-schema";

export type LessonPlanInput = {
  subject: string;
  gradeLevel: string;
  topic: string;
  lessonDuration: string;
  planPeriodDays?: number;
  difficultyLevel: string;
  learningStandard?: string;
  classSize?: string;
  specialInstructions?: string;
  referenceMaterials?: LessonPlanReferenceMaterial[];
};

export type LessonPlanResult = {
  lessonTitle: string;
  learningObjectives: string[];
  materialsNeeded: string[];
  vocabulary: string[];
  lessonTimeline: string[];
  weeklySchedule?: LessonPlanDaySchedule[];
  warmUpActivity: string;
  mainTeachingSteps: string[];
  classroomActivity: string;
  assessmentQuestions: string[];
  homework: string;
  differentiatedInstruction: string[];
  teacherNotes: string;
  /** True when Learning Standard was confirmed Jamaica-linked at generation. */
  jamaicaNscGuidelinesApplied?: boolean;
};

export type TeacherQuizInput = {
  subject: string;
  gradeLevel: string;
  topic: string;
  numberOfQuestions: number;
  questionTypes: string;
  difficultyLevel: string;
};

export type TeacherQuizQuestion = {
  question: string;
  choices: string[];
  correctAnswer: string;
  explanation: string;
};

export type TeacherQuizResult = {
  questions: TeacherQuizQuestion[];
  answerKey: string[];
};

export type HomeworkInput = {
  subject: string;
  gradeLevel: string;
  topic: string;
  numberOfQuestions: number;
  difficultyLevel: string;
  numberOfPassages?: number;
  questionsPerPassage?: number;
  /** Lesson-plan / deck vocabulary terms to drive concrete practice items. */
  vocabularyTerms?: string[];
};

export type StudyGuideInput = {
  subject: string;
  gradeLevel: string;
  topic: string;
  savedLessonPlanId?: number;
  savedHomeworkId?: number;
  homeworkTitle?: string;
  referenceMaterialCount?: number;
  regenerationSeed?: number;
};

export type StudyGuideResult = {
  summary: string;
  keyVocabulary: string[];
  importantPoints: string[];
  workedExamples: string[];
  sampleProblems: string[];
  practiceQuestions: string[];
  studyTips: string[];
};

export type WorksheetInput = {
  subject: string;
  gradeLevel: string;
  topic: string;
  worksheetType: string;
  difficultyLevel: string;
};

export type WorksheetResult = {
  instructions: string;
  practiceProblems: string[];
  studentWorksheetSection: string;
  teacherAnswerKey: string[];
};

export function generateLessonPlan(input: LessonPlanInput): LessonPlanResult {
  const topic = input.topic.trim() || "the topic";
  const subject = input.subject.trim() || "the subject";
  const grade = input.gradeLevel.trim() || "students";
  const difficulty = input.difficultyLevel.trim() || "Intermediate";
  const difficultyLabel = difficultyLabelForContent(difficulty);
  const rigor = getDifficultyRigorProfile(difficulty);
  const duration = input.lessonDuration.trim() || "45 minutes";
  const planPeriodDays = clampPlanPeriodDays(
    input.planPeriodDays ?? DEFAULT_PLAN_PERIOD_DAYS,
  );
  const classSize = input.classSize?.trim() || "25";
  const standard = input.learningStandard?.trim();
  const accommodations = input.specialInstructions?.trim();

  const vocabulary = buildTopicVocabularyLines(topic, subject, difficulty);
  const weeklySchedule =
    planPeriodDays > 1
      ? buildWeeklyScheduleFromVocabulary({
          vocabulary,
          planPeriodDays,
          lessonDuration: duration,
          topic,
          difficulty,
        })
      : undefined;
  const differentiatedInstruction = buildDifferentiatedInstruction(
    difficulty,
    topic,
    accommodations,
  );

  return {
    lessonTitle: `${topic} — ${subject} (${grade})`,
    learningObjectives: buildLearningObjectives(
      topic,
      subject,
      difficulty,
      difficultyLabel,
      standard,
    ),
    materialsNeeded: [
      "Interactive whiteboard or projector with lesson slides",
      "Student notebooks",
      `Printed ${topic} reference ${difficulty === "Beginner" ? "picture cards or simplified diagram" : "diagram or reading passage"} (grade ${grade})`,
      difficulty === "Beginner"
        ? "Manipulatives or visual vocabulary cards"
        : "Colored pencils or highlighters for labeling",
      "Index cards or digital flashcards for vocabulary review",
      accommodations?.toLowerCase().includes("large print")
        ? "Large-print handouts and visual vocabulary chart"
        : "Vocabulary word wall or anchor chart",
      `Timer visible to students for ${duration} pacing`,
    ],
    vocabulary,
    lessonTimeline:
      planPeriodDays > 1
        ? buildUnitTimeline(topic, planPeriodDays, duration)
        : buildLessonTimeline(topic, duration, difficulty),
    weeklySchedule,
    warmUpActivity: buildWarmUpActivity(topic, difficulty, rigor.activityGuidance),
    mainTeachingSteps: buildMainTeachingSteps(
      topic,
      difficultyLabel,
      rigor.teachingStepsGuidance,
      classSize,
      accommodations,
    ),
    classroomActivity: buildClassroomActivity(topic, difficulty, rigor.activityGuidance),
    assessmentQuestions: buildAssessmentQuestions(topic, difficulty, standard),
    homework: buildHomework(topic, difficulty, rigor.homeworkGuidance),
    differentiatedInstruction,
    teacherNotes: buildTeacherNotes(
      classSize,
      difficulty,
      rigor.summary,
      standard,
      accommodations,
    ),
  };
}

function buildLearningObjectives(
  topic: string,
  subject: string,
  difficulty: string,
  difficultyLabel: string,
  standard?: string,
): string[] {
  const standardNote = standard
    ? ` Align objectives and assessment to ${standard}.`
    : "";

  switch (difficulty) {
    case "Beginner":
      return [
        `Students will identify and name key ideas related to ${topic} using supported vocabulary.`,
        `Students will describe ${topic} in simple terms with teacher modeling and visual aids.`,
        `Students will complete a guided practice task about ${topic} with partner support.${standardNote}`,
      ];
    case "Advanced":
      return [
        `Students will analyze relationships within ${topic} and explain cause-and-effect chains.`,
        `Students will solve multi-step problems involving ${topic} and justify each step.`,
        `Students will evaluate examples of ${topic} in unfamiliar contexts.${standardNote}`,
      ];
    case "Honors/Gifted":
      return [
        `Students will synthesize advanced concepts in ${topic} and connect them to ${subject} beyond the textbook.`,
        `Students will design an original extension project or investigation based on ${topic}.`,
        `Students will teach a peer group one nuanced aspect of ${topic} using evidence.${standardNote}`,
      ];
    case "All":
      return [
        `Students will demonstrate foundational through advanced understanding of ${topic} at their readiness level.`,
        `Students will use accurate vocabulary to discuss ${topic} in ${subject}.`,
        `Students will apply ${topic} through tiered practice and reflection.${standardNote}`,
      ];
    default:
      return [
        `Students will explain core concepts of ${topic} using grade-appropriate vocabulary.`,
        `Students will apply ${topic} skills through guided and independent practice at a ${difficultyLabel} level.`,
        `Students will demonstrate understanding via formative assessment.${standardNote}`,
      ];
  }
}

function buildUnitTimeline(
  topic: string,
  planPeriodDays: number,
  lessonDuration: string,
): string[] {
  return [
    `Day 1 — Launch ${topic}: hook, prior knowledge, and first vocabulary set (${lessonDuration})`,
    `Days 2–${Math.max(2, planPeriodDays - 1)} — Build understanding with new terms and guided practice each class (${lessonDuration} per day)`,
    `Day ${planPeriodDays} — Consolidate, assess, and connect ${topic} to upcoming learning (${lessonDuration})`,
    `Vocabulary is distributed across all ${planPeriodDays} days; see the daily schedule for timed segments.`,
  ];
}

function buildLessonTimeline(
  topic: string,
  duration: string,
  difficulty: string,
): string[] {
  if (difficulty === "Beginner") {
    return [
      `0–7 min: Warm-up with visuals — prior knowledge about ${topic}`,
      `7–20 min: Direct instruction with chunked explanations and frequent checks`,
      `20–32 min: Guided practice with teacher modeling`,
      `32–42 min: Supported small-group activity`,
      `42–${duration}: Oral exit ticket and summary`,
    ];
  }

  if (difficulty === "Honors/Gifted" || difficulty === "Advanced") {
    return [
      `0–5 min: Challenge warm-up — prior knowledge and prediction about ${topic}`,
      `5–15 min: Brief direct instruction launching inquiry`,
      `15–30 min: Independent or team application of ${topic}`,
      `30–40 min: Peer presentations or problem defense`,
      `40–${duration}: Reflection and extension preview`,
    ];
  }

  return [
    `0–5 min: Warm-up — activate prior knowledge about ${topic}`,
    `5–15 min: Direct instruction — introduce key concepts and vocabulary`,
    `15–28 min: Guided practice — teacher models, students follow with checkpoints`,
    `28–38 min: Collaborative activity applying ${topic}`,
    `38–${duration}: Exit ticket, summary discussion, and homework preview`,
  ];
}

function buildWarmUpActivity(
  topic: string,
  difficulty: string,
  activityGuidance: string,
): string {
  if (difficulty === "Beginner") {
    return `Show a simple image or diagram of ${topic}. Ask: "What do you notice?" Students turn and talk, then share one idea each. Teacher records responses on a word bank chart. ${activityGuidance}`;
  }

  if (difficulty === "Honors/Gifted") {
    return `Pose an open-ended challenge: "How could ${topic} be applied to solve a real problem in your community?" Students brainstorm independently for 3 minutes, then group ideas by theme. ${activityGuidance}`;
  }

  if (difficulty === "Advanced") {
    return `Present a non-routine scenario involving ${topic}. Students predict an outcome and justify their reasoning in writing before discussion. ${activityGuidance}`;
  }

  return `Display a prompt: "What do you already know about ${topic}?" Students write 2–3 ideas, pair-share, and contribute to a class concept map. ${activityGuidance}`;
}

function buildMainTeachingSteps(
  topic: string,
  difficultyLabel: string,
  teachingGuidance: string,
  classSize: string,
  accommodations?: string,
): string[] {
  return [
    `State the lesson goal and connect ${topic} to a real-world example.`,
    `Introduce vocabulary using a visual organizer; students record definitions.`,
    `Model the central concept of ${topic} at ${difficultyLabel} rigor with targeted checks for understanding.`,
    `Lead guided practice where students complete a partially finished example together.`,
    `Release students to structured group work applying ${topic} with a clear success criteria rubric.`,
    `Facilitate a whole-class debrief highlighting strong responses and clarifying misconceptions.`,
    accommodations
      ? `Apply accommodations throughout: ${accommodations}.`
      : `${teachingGuidance} Monitor pacing for a class of ${classSize} students.`,
  ];
}

function buildClassroomActivity(
  topic: string,
  difficulty: string,
  activityGuidance: string,
): string {
  if (difficulty === "Beginner") {
    return `Pairs use picture cards and sentence frames to describe ${topic} in three steps. Groups share one completed example with the class. ${activityGuidance}`;
  }

  if (difficulty === "Honors/Gifted") {
    return `Teams design a mini-lesson or investigation proposal about ${topic}, including a hypothesis, method, and presentation plan. ${activityGuidance}`;
  }

  if (difficulty === "Advanced") {
    return `Small groups analyze a complex scenario involving ${topic}, defend their solution to another group, and revise based on peer feedback. ${activityGuidance}`;
  }

  return `Small groups receive a ${topic} scenario card, create a labeled diagram or short presentation, and peer-review using a 2-star/1-wish protocol. ${activityGuidance}`;
}

function buildAssessmentQuestions(
  topic: string,
  difficulty: string,
  standard: string | undefined,
): string[] {
  const base =
    difficulty === "Beginner"
      ? [
          `Match vocabulary terms for ${topic} to their meanings.`,
          `Label a simple diagram showing one part of ${topic}.`,
          `Tell a partner one fact you learned about ${topic} today.`,
        ]
      : difficulty === "Advanced" || difficulty === "Honors/Gifted"
        ? [
            `Analyze a multi-step problem involving ${topic} and show your reasoning.`,
            `Compare two approaches to ${topic} and evaluate which is more effective.`,
            `Create an original example of ${topic} and explain why it works.`,
          ]
        : [
            `Define three key vocabulary terms from today's ${topic} lesson.`,
            `Explain one major step in ${topic} and why it matters.`,
            `Describe a real-world example connected to ${topic}.`,
          ];

  if (standard) {
    base.push(
      `Which learning expectation from ${standard} did you meet today? Cite evidence.`,
    );
  }

  return base;
}

function buildHomework(
  topic: string,
  difficulty: string,
  homeworkGuidance: string,
): string {
  if (difficulty === "Beginner") {
    return `Draw and label a simple picture about ${topic}. Write 3–5 sentences using at least three vocabulary words. ${homeworkGuidance}`;
  }

  if (difficulty === "Honors/Gifted") {
    return `Research one advanced application of ${topic} and prepare a short presentation or one-page design proposal. ${homeworkGuidance}`;
  }

  if (difficulty === "Advanced") {
    return `Complete a multi-part practice set on ${topic} with written justification for each answer. ${homeworkGuidance}`;
  }

  return `Write a 5–7 sentence reflection summarizing ${topic}, using at least four vocabulary terms correctly. ${homeworkGuidance}`;
}

function buildTeacherNotes(
  classSize: string,
  difficulty: string,
  rigorSummary: string,
  standard?: string,
  accommodations?: string,
): string {
  const rigorNote = `Lesson calibrated for ${difficulty} rigor (${rigorSummary}).`;

  if (accommodations) {
    return `${rigorNote} Class size: ${classSize}. Accommodations: ${accommodations}. Provide alternate response formats where helpful.`;
  }

  if (standard) {
    return `${rigorNote} Class size: ${classSize}. Aligned to ${standard}.`;
  }

  return `${rigorNote} Class size: ${classSize}. Adjust wait time based on student responses.`;
}

function buildDifferentiatedInstruction(
  difficulty: string,
  topic: string,
  accommodations?: string,
): string[] {
  const tiers: Record<string, string> = {
    Beginner: `Beginner: provide sentence frames, visual glossaries, and chunked instructions for ${topic}; allow oral responses and partner reading support`,
    Intermediate: `Intermediate: standard ${topic} practice with guided checkpoints, graphic organizers, and formative checks every 10 minutes`,
    Advanced: `Advanced: multi-step analysis tasks requiring students to justify claims about ${topic} using evidence from diagrams or data`,
    "Honors/Gifted": `Honors/Gifted: independent inquiry extension — students design an investigation or teach a mini-lesson segment on ${topic}`,
  };

  const accommodationLine = accommodations
    ? `Accommodations: integrate ${accommodations} across instruction (materials, pacing, and response formats).`
    : null;

  if (difficulty === "All") {
    return [
      tiers.Beginner,
      tiers.Intermediate,
      tiers.Advanced,
      tiers["Honors/Gifted"],
      ...(accommodationLine ? [accommodationLine] : []),
    ];
  }

  const tierLine =
    tiers[difficulty] ??
    tiers.Intermediate;

  return [...(accommodationLine ? [tierLine, accommodationLine] : [tierLine])];
}

export function generateTeacherQuiz(input: TeacherQuizInput): TeacherQuizResult {
  const count = Math.max(
    1,
    Math.min(input.numberOfQuestions, PRO_PLUS_CARDS_PER_DECK_LIMIT),
  );
  const questions: TeacherQuizQuestion[] = Array.from(
    { length: count },
    (_, i) => ({
      question: `${input.topic} — Question ${i + 1} (${input.questionTypes})`,
      choices: ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
      correctAnswer: "B) Option 2",
      explanation: `This answer best demonstrates understanding of ${input.topic} at ${input.difficultyLevel} level.`,
    }),
  );
  return {
    questions,
    answerKey: questions.map((q) => q.correctAnswer),
  };
}

export function generateHomework(input: HomeworkInput): HomeworkResult {
  const text = `${input.subject} ${input.topic}`.toLowerCase();
  const needsPassage =
    /reading|comprehension|literature|language arts|\bela\b|english|inference|main idea|theme|character/.test(
      text,
    );

  const numberOfPassages = Math.max(
    1,
    Math.min(5, input.numberOfPassages ?? (needsPassage ? 1 : 1)),
  );
  const questionsPerPassage = Math.max(
    1,
    Math.min(
      15,
      input.questionsPerPassage ??
        Math.max(1, Math.ceil(input.numberOfQuestions / numberOfPassages)),
    ),
  );
  const count = needsPassage
    ? numberOfPassages * questionsPerPassage
    : Math.max(1, Math.min(input.numberOfQuestions, 30));

  if (needsPassage) {
    const storyBank = [
      {
        title: "Fixing the Community Center",
        body: [
          "Maya and Jordan stared at the cracked windows of their neighborhood community center. Paint peeled from the doors, and the basketball hoop hung crooked on the wall.",
          '"If we work together, we can fix this," Maya said. She paced back and forth, sighing as she thought about the fundraiser test her class still had to take that week.',
          "Jordan fetched a toolbox while neighbors brought leftover paint. After an afternoon of scrubbing, hammering, and laughing, the center looked brighter. Maya finally stopped pacing and smiled — teamwork had turned worry into pride.",
        ].join("\n\n"),
        prompts: [
          "What is the main idea of the passage? Use evidence from the text to support your answer.",
          "What can you infer about Maya's emotional state, and which clues support that inference?",
          "Identify a cause-and-effect relationship in the passage and explain it.",
          "What theme does the author convey? Justify your choice with details from the text.",
        ],
        answers: [
          "Teamwork helps people solve community problems; Maya and Jordan fix the center with neighbors' help.",
          "Maya feels anxious about an upcoming test — she paces and sighs before the group works together.",
          "Working together (cause) leads to a brighter, repaired community center (effect).",
          "Cooperation turns worry into pride; details include shared tools, neighbors helping, and Maya's smile.",
        ],
      },
      {
        title: "The Mango Tree",
        body: [
          "On the first warm afternoon of the term, Amara climbed the mango tree behind her grandmother's house. The leaves whispered above her as she searched for fruit that was almost ripe.",
          "When her little brother called for help with a stuck kite, Amara hesitated, then climbed down and untangled the string. Together they laughed as the kite rose again over the yard.",
          "Grandmother watched from the porch and said kindness grows like mangoes — slowly, then all at once when you share it.",
        ].join("\n\n"),
        prompts: [
          "What is the main idea of this passage?",
          "What character trait best describes Amara? Cite evidence.",
          "What does the grandmother's comparison suggest about kindness?",
          "Infer why Amara hesitated before helping her brother.",
        ],
        answers: [
          "Helping family and sharing kindness matter more than keeping fruit to yourself.",
          "Amara is caring/responsible — she climbs down to help with the kite.",
          "Kindness develops over time and becomes clear when you share it.",
          "She wanted the mangoes but chose to help anyway.",
        ],
      },
    ];

    const passages = Array.from({ length: numberOfPassages }, (_, index) => {
      const story = storyBank[index % storyBank.length]!;
      return {
        title: numberOfPassages > 1 ? `${story.title}` : story.title,
        body: story.body,
      };
    });

    const questions: string[] = [];
    const answerKey: string[] = [];
    const passageQuestionCounts: number[] = [];

    for (let p = 0; p < numberOfPassages; p++) {
      const story = storyBank[p % storyBank.length]!;
      passageQuestionCounts.push(questionsPerPassage);
      for (let q = 0; q < questionsPerPassage; q++) {
        questions.push(story.prompts[q % story.prompts.length]!);
        answerKey.push(story.answers[q % story.answers.length]!);
      }
    }

    return {
      assignmentTitle: `${input.subject} Homework — ${input.topic}`,
      instructions: multiPassageInstructions(numberOfPassages),
      passages,
      passageQuestionCounts,
      passageTitle: passages[0]?.title ?? null,
      passage: passages[0]?.body ?? null,
      questions,
      answerKey,
      answerGraphs: null,
    };
  }

  const isMath =
    /math|algebra|geometry|equation|variable|expression|inequalit|arithm/.test(
      text,
    );
  if (isMath) {
    return buildMathHomeworkFallback(input, count);
  }

  return {
    assignmentTitle: `${input.subject} Homework — ${input.topic}`,
    instructions: `Complete all questions on ${input.topic}. Show your work where applicable.`,
    passages: null,
    passageQuestionCounts: null,
    passageTitle: null,
    passage: null,
    questions: Array.from(
      { length: count },
      (_, index) =>
        `Explain one key idea from ${input.topic} and give a concrete ${input.gradeLevel} example (item ${index + 1}).`,
    ),
    answerKey: Array.from(
      { length: count },
      (_, index) =>
        `Accept any accurate explanation of ${input.topic} with a grade-appropriate example (item ${index + 1}).`,
    ),
    answerGraphs: null,
  };
}

function buildMathHomeworkFallback(
  input: HomeworkInput,
  count: number,
): HomeworkResult {
  const terms = (input.vocabularyTerms ?? [])
    .map((term) => term.trim())
    .filter(Boolean);
  const topic = input.topic;
  const bank: Array<{
    question: string;
    answer: string;
    graph?: import("@/lib/homework-answer-graph").HomeworkAnswerGraph;
  }> = [
    {
      question:
        "Evaluate the expression 3x + 7 when x = 5. Show each step.",
      answer: "3(5) + 7 = 15 + 7 = 22.",
    },
    {
      question:
        "Write an algebraic expression for: “7 more than twice a number n.”",
      answer: "2n + 7",
    },
    {
      question: "Solve for x: 4x − 9 = 15. Justify each step.",
      answer: "4x − 9 = 15 → 4x = 24 → x = 6.",
    },
    {
      question:
        "Solve the inequality and graph on a number line: 3(x − 2) > 12.",
      answer: "x > 6; open circle at 6 with shading to the right.",
      graph: {
        type: "number_line",
        title: "x > 6",
        lineMin: 0,
        lineMax: 12,
        markValue: 6,
        markStyle: "open",
        shadeDirection: "right",
        xMin: null,
        xMax: null,
        yMin: null,
        yMax: null,
        points: null,
        lines: null,
      },
    },
    {
      question:
        "Simplify the expression 5(2y − 3) − 4y. Identify like terms.",
      answer: "10y − 15 − 4y = 6y − 15.",
    },
    {
      question:
        "A number increased by 12 is 40. Write an equation and solve for the number.",
      answer: "n + 12 = 40 → n = 28.",
    },
    {
      question:
        "Translate and solve: Three times a number decreased by 8 equals 19.",
      answer: "3n − 8 = 19 → 3n = 27 → n = 9.",
    },
    {
      question:
        "Graph the solution set of x ≥ −1 on a number line.",
      answer: "Closed circle at −1 with shading to the right.",
      graph: {
        type: "number_line",
        title: "x ≥ −1",
        lineMin: -5,
        lineMax: 5,
        markValue: -1,
        markStyle: "closed",
        shadeDirection: "right",
        xMin: null,
        xMax: null,
        yMin: null,
        yMax: null,
        points: null,
        lines: null,
      },
    },
  ];

  // Prefer vocabulary-tied stems when lesson terms exist.
  const vocabItems = terms.slice(0, count).map((term, index) => {
    const lower = term.toLowerCase();
    if (/variable|unknown|letter/.test(lower)) {
      return {
        question: `Define the term “${term}” and give one example expression that uses a variable.`,
        answer: `A ${term} is a symbol for an unknown value; e.g. 2x + 1 uses variable x.`,
      };
    }
    if (/expression/.test(lower)) {
      return {
        question: `Write an algebraic expression for “4 less than three times a number,” then evaluate it when the number is 6. (Use the idea of ${term}.)`,
        answer: "3n − 4; when n = 6: 3(6) − 4 = 14.",
      };
    }
    if (/equation/.test(lower)) {
      return {
        question: `Create an ${term.toLowerCase()} that represents “a number plus 9 equals 20,” then solve it.`,
        answer: "n + 9 = 20 → n = 11.",
      };
    }
    if (/inequalit/.test(lower)) {
      return {
        question: `Solve and graph on a number line: a number is at most 12 (write an ${term.toLowerCase()}).`,
        answer: "n ≤ 12; closed circle at 12 with shading to the left.",
        graph: {
          type: "number_line" as const,
          title: "n ≤ 12",
          lineMin: 6,
          lineMax: 16,
          markValue: 12,
          markStyle: "closed" as const,
          shadeDirection: "left" as const,
          xMin: null,
          xMax: null,
          yMin: null,
          yMax: null,
          points: null,
          lines: null,
        },
      };
    }
    if (/coefficient|constant|term/.test(lower)) {
      return {
        question: `In the expression 7x − 3, identify the ${term.toLowerCase()} and explain how you know.`,
        answer:
          /coefficient/.test(lower)
            ? "7 is the coefficient of x."
            : /constant/.test(lower)
              ? "−3 is the constant term."
              : "7x and −3 are the terms.",
      };
    }
    return {
      question: `Use the vocabulary term “${term}” in a short ${input.gradeLevel} practice problem on ${topic}, then solve it.`,
      answer: `Problem should correctly apply “${term}” to ${topic}; accept any mathematically correct solution.`,
    };
  });

  const items =
    vocabItems.length >= count
      ? vocabItems.slice(0, count)
      : [
          ...vocabItems,
          ...Array.from({ length: count - vocabItems.length }, (_, i) => {
            const item = bank[(vocabItems.length + i) % bank.length]!;
            return item;
          }),
        ];

  const answerGraphs = items.map(
    (item) =>
      item.graph ?? {
        type: "none" as const,
        title: null,
        lineMin: null,
        lineMax: null,
        markValue: null,
        markStyle: null,
        shadeDirection: null,
        xMin: null,
        xMax: null,
        yMin: null,
        yMax: null,
        points: null,
        lines: null,
      },
  );
  const hasGraph = answerGraphs.some((graph) => graph.type !== "none");

  return {
    assignmentTitle: `${input.subject} Homework — ${input.topic}`,
    instructions:
      "Solve each problem. Show your work and justify algebraic steps where asked. Graph solutions on a number line when asked.",
    passages: null,
    passageQuestionCounts: null,
    passageTitle: null,
    passage: null,
    questions: items.map((item) => item.question),
    answerKey: items.map((item) => item.answer),
    answerGraphs: hasGraph ? answerGraphs : null,
  };
}

function multiPassageInstructions(numberOfPassages: number): string {
  if (numberOfPassages <= 1) {
    return "Read the passage carefully and answer the following questions. Use evidence from the text to support your answers when needed.";
  }
  return `Read each passage carefully and answer the questions that follow it. Use evidence from the matching text to support your answers when needed. There are ${numberOfPassages} passages.`;
}

export function generateStudyGuide(input: StudyGuideInput): StudyGuideResult {
  const seed = input.regenerationSeed ?? 0;
  const variantLabel = seed > 0 ? ` (variant ${seed + 1})` : "";
  const referenceNote =
    input.referenceMaterialCount && input.referenceMaterialCount > 0
      ? ` Includes ${input.referenceMaterialCount} reference source${input.referenceMaterialCount === 1 ? "" : "s"}.`
      : "";
  const homeworkNote = input.homeworkTitle
    ? ` Aligned with homework: ${input.homeworkTitle}.`
    : "";

  return {
    summary: `This study guide covers ${input.topic} in ${input.subject} for ${input.gradeLevel} learners.${homeworkNote}${referenceNote}${variantLabel}`,
    keyVocabulary: [
      `${input.topic} — a core idea students must define in their own words`,
      `${input.topic} — a supporting term used in class discussions`,
      `${input.topic} — vocabulary linked to real-world examples`,
      `${input.topic} — a term that often appears on assessments`,
    ],
    importantPoints: [
      `Students should be able to explain what ${input.topic} means in ${input.subject}.`,
      `Recognize how ${input.topic} connects to everyday examples at the ${input.gradeLevel} level.`,
      input.homeworkTitle
        ? `Review concepts from ${input.homeworkTitle} before attempting homework questions.`
        : `Apply ${input.topic} in a short written or spoken example.`,
      `Identify common mistakes students make when first learning ${input.topic}.`,
    ],
    workedExamples: [
      `Example 1 — Modeling ${input.topic}: Step 1: Restate the problem in your own words. Step 2: Identify the key information about ${input.topic}. Step 3: Show the solution with a brief explanation students can follow.`,
      `Example 2 — Applying ${input.topic}: Step 1: Start with a familiar scenario. Step 2: Connect the scenario to ${input.topic}. Step 3: State the final answer and why it makes sense.`,
    ],
    sampleProblems: [
      `Problem: Give one real-world example of ${input.topic}. Solution: Accept any accurate example that shows understanding of the concept.`,
      `Problem: Explain ${input.topic} in one or two sentences. Solution: Look for a clear definition and a supporting detail.`,
      `Problem: What is one mistake to avoid when studying ${input.topic}? Solution: Name a common error and how to fix it.`,
    ],
    practiceQuestions: [
      `Explain ${input.topic} in your own words.`,
      `Give one example of ${input.topic}.`,
      seed > 0
        ? `Compare two ideas related to ${input.topic}.`
        : `What is a common mistake when learning ${input.topic}?`,
      `How would you teach ${input.topic} to a classmate?`,
    ],
    studyTips: [
      "Review vocabulary daily in short sessions.",
      "Teach the concept to a peer to reinforce memory.",
      "Use flashcards for key terms.",
      "Redo sample problems without looking at the solution first.",
    ],
  };
}

export function generateWorksheet(input: WorksheetInput): WorksheetResult {
  return {
    instructions: `Complete this ${input.worksheetType} worksheet on ${input.topic}.`,
    practiceProblems: [
      `Problem 1: Apply ${input.topic} (${input.difficultyLevel}).`,
      `Problem 2: Analyze a scenario involving ${input.topic}.`,
      `Problem 3: Create your own example of ${input.topic}.`,
    ],
    studentWorksheetSection: `Name: __________  Date: __________\n\n${input.topic} — ${input.worksheetType} Practice`,
    teacherAnswerKey: [
      "Problem 1: Sample answer with reasoning.",
      "Problem 2: Sample analysis with supporting evidence.",
      "Problem 3: Accept varied valid student-created examples.",
    ],
  };
}
