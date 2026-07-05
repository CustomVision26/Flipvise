import {
  difficultyLabelForContent,
  getDifficultyRigorProfile,
} from "@/lib/lesson-plan-difficulty";
import { PRO_PLUS_CARDS_PER_DECK_LIMIT } from "@/lib/personal-plan-limits";

export type LessonPlanInput = {
  subject: string;
  gradeLevel: string;
  topic: string;
  lessonDuration: string;
  difficultyLevel: string;
  learningStandard?: string;
  classSize?: string;
  specialInstructions?: string;
};

export type LessonPlanResult = {
  lessonTitle: string;
  learningObjectives: string[];
  materialsNeeded: string[];
  vocabulary: string[];
  lessonTimeline: string[];
  warmUpActivity: string;
  mainTeachingSteps: string[];
  classroomActivity: string;
  assessmentQuestions: string[];
  homework: string;
  differentiatedInstruction: string[];
  teacherNotes: string;
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
};

export type HomeworkResult = {
  assignmentTitle: string;
  instructions: string;
  questions: string[];
  answerKey: string[];
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
  const classSize = input.classSize?.trim() || "25";
  const standard = input.learningStandard?.trim();
  const accommodations = input.specialInstructions?.trim();

  const vocabulary = buildTopicVocabulary(topic, subject, difficulty);
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
    lessonTimeline: buildLessonTimeline(topic, duration, difficulty),
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

function buildTopicVocabulary(
  topic: string,
  subject: string,
  difficulty: string,
): string[] {
  const normalized = topic.toLowerCase().replace(/\s+/g, " ").trim();

  const topicBanks: Record<string, string[]> = {
    "water cycle": [
      "Evaporation — liquid water changing into water vapor, often from oceans, lakes, or soil",
      "Condensation — water vapor cooling and forming tiny droplets that create clouds",
      "Precipitation — water falling from clouds as rain, snow, sleet, or hail",
      "Collection — water gathering in rivers, lakes, oceans, and underground aquifers",
      "Transpiration — water vapor released by plants through their leaves",
      "Runoff — water flowing over land into streams and rivers after precipitation",
      "Infiltration — water soaking into the ground to replenish groundwater",
      "Water vapor — water in gas form in the atmosphere",
    ],
    "jamaican independence": [
      "Colony — a territory controlled by another country",
      "Self-government — local leaders making decisions for their own people",
      "Nationalism — pride and political desire for an independent nation",
      "Constitution — a document defining how a country is governed",
      "Sovereignty — full authority of a state to govern itself",
      "Referendum — a public vote on an important political decision",
      "Legacy — long-term impact of historical events on present society",
    ],
  };

  const bank = topicBanks[normalized];
  const terms = bank ?? [
    `${topic} — the main concept studied in this ${subject} lesson`,
    `Process — a series of steps or changes related to ${topic}`,
    `Cause and effect — how one event or action leads to another in ${topic}`,
    `Evidence — facts, observations, or data that support claims about ${topic}`,
    `Model — a simplified representation used to explain ${topic}`,
    `Application — using knowledge of ${topic} in a real-world or new context`,
    `Vocabulary — subject-specific words needed to discuss ${topic} accurately`,
    `Analysis — breaking ${topic} into parts to understand how they work together`,
  ];

  if (difficulty === "Beginner") {
    return terms.slice(0, 5);
  }

  if (difficulty === "Advanced" || difficulty === "Honors/Gifted") {
    return terms;
  }

  return terms.slice(0, Math.min(7, terms.length));
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
  const count = Math.max(1, Math.min(input.numberOfQuestions, 15));
  return {
    assignmentTitle: `${input.subject} Homework — ${input.topic}`,
    instructions: `Complete all questions on ${input.topic}. Show your work where applicable.`,
    questions: Array.from(
      { length: count },
      () => `Practice problem on ${input.topic} (${input.difficultyLevel}).`,
    ),
    answerKey: Array.from(
      { length: count },
      () => `Sample solution for ${input.topic}.`,
    ),
  };
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
