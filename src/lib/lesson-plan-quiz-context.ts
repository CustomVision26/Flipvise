import type { LessonPlanInput, LessonPlanResult } from "@/lib/teacher-generators";

export function buildLessonPlanQuizContext(input: {
  input: LessonPlanInput;
  result: LessonPlanResult;
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

  return lines.join("\n");
}

/** Passage-quiz context — emphasizes short stories, reading activities, and lesson vocabulary. */
export function buildLessonPlanPassageQuizContext(input: {
  input: LessonPlanInput;
  result: LessonPlanResult;
}): string {
  const { result } = input;
  const base = buildLessonPlanQuizContext(input);

  return `${base}

Passage and reading comprehension source material:
- Warm-up activity: ${result.warmUpActivity}
- Classroom activity (may include sample texts or story prompts): ${result.classroomActivity}
- Homework: ${result.homework}
- Teacher notes: ${result.teacherNotes}

Instructions for passage cards:
- Write original 3–5 sentence short stories or informational reading paragraphs grounded in this lesson
- Use lesson vocabulary words naturally inside each passage
- Align each comprehension question with the lesson objectives and assessment questions listed above
- For reading/language lessons, use narrative mini-stories with characters and settings appropriate for the grade level
- Each passage must stand alone — students answer only from that passage`;
}

export function buildLessonPlanPassageFallbackQuestions(
  count: number,
  meta: {
    subject: string;
    gradeLevel: string;
    topic: string;
    difficultyLevel: string;
  },
  lesson: { input: LessonPlanInput; result: LessonPlanResult },
): Array<{
  passage: string;
  question: string;
  correctAnswer: string;
  wrongAnswers: [string, string, string];
  explanation: string;
}> {
  const { result } = lesson;
  const vocab = result.vocabulary.length > 0 ? result.vocabulary : [meta.topic];
  const assessments =
    result.assessmentQuestions.length > 0
      ? result.assessmentQuestions
      : [`What is the main idea about ${meta.topic}?`];

  return Array.from({ length: count }, (_, index) => {
    const v1 = vocab[index % vocab.length]!;
    const v2 = vocab[(index + 1) % vocab.length]!;
    const v3 = vocab[(index + 2) % vocab.length]!;
    const objective =
      result.learningObjectives[index % result.learningObjectives.length] ??
      `Understand ${meta.topic}`;
    const assessmentQ = assessments[index % assessments.length]!;
    const isReadingLesson = /reading|comprehension|language arts|\bela\b|english|literacy/i.test(
      `${meta.subject} ${meta.topic}`,
    );

    if (isReadingLesson) {
      const studentNames = ["Sarah", "Maya", "Jayden", "Aisha", "Marcus", "Priya"];
      const name = studentNames[index % studentNames.length]!;
      const passage = `${name} enjoys reading after school and often picks books that help with ${meta.topic.toLowerCase()}. Every week, ${name} looks for stories that use words like "${v1}" and "${v2}" in context. While reading, ${name} pauses to ask questions about characters and main ideas, then writes a short summary. ${name} believes this habit makes it easier to understand new texts and explain answers clearly.`;
      const question = assessmentQ.endsWith("?")
        ? assessmentQ
        : `Why does ${name} practice ${meta.topic.toLowerCase()} while reading?`;
      const correctAnswer = `Because it helps ${name} understand texts, notice key details, and use vocabulary such as ${v1} and ${v2}.`;

      return {
        passage,
        question,
        correctAnswer,
        wrongAnswers: [
          `Because ${name} wants to avoid all reading homework entirely.`,
          `Because ${name} only reads to memorize ${v3} without thinking about meaning.`,
          `Because ${name} never writes summaries or discusses texts with anyone.`,
        ],
        explanation: `This answer matches the reading comprehension focus and lesson vocabulary from the saved lesson plan on ${meta.topic}.`,
      };
    }

    const passage = `During ${meta.subject} class, ${meta.gradeLevel} students explored ${meta.topic.toLowerCase()}. The lesson focused on ${v1}, ${v2}, and ${v3}. The teacher guided learners through ${result.classroomActivity.split(".")[0]?.trim() || "a classroom activity"}. Students practiced applying these ideas to make meaning from short texts and discuss what they learned with partners.`;

    const question = assessmentQ.endsWith("?")
      ? assessmentQ
      : `${assessmentQ}?`;

    const correctAnswer = `The passage shows students working toward: ${objective.charAt(0).toLowerCase()}${objective.slice(1).replace(/\.$/, "")}.`;

    return {
      passage,
      question,
      correctAnswer,
      wrongAnswers: [
        `The passage is mainly about unrelated homework from a different subject.`,
        `Students are learning ${v3} only, with no connection to ${meta.topic}.`,
        `The lesson avoids ${v1} and focuses on skills not mentioned in the passage.`,
      ],
      explanation: `This answer reflects the lesson objective and vocabulary (${v1}, ${v2}) from the saved lesson plan on ${meta.topic}.`,
    };
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
