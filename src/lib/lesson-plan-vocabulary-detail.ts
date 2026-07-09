import type {
  LessonPlanDaySchedule,
  LessonPlanDayVocabularyDetail,
  LessonPlanVocabularyTermDetail,
} from "@/lib/lesson-plan-ai-schema";

/** Split "Term — definition" or "Term - definition" into parts. */
export function parseVocabularyLine(entry: string): {
  term: string;
  shortDefinition: string;
} {
  const trimmed = entry.trim();
  const dashSplit = trimmed.split(/\s[—–-]\s/);
  if (dashSplit.length >= 2) {
    return {
      term: dashSplit[0]!.trim(),
      shortDefinition: dashSplit.slice(1).join(" — ").trim(),
    };
  }
  return { term: trimmed, shortDefinition: trimmed };
}

export function vocabularyLineFromTerm(term: LessonPlanVocabularyTermDetail): string {
  return `${term.term} — ${term.shortDefinition}`;
}

export function buildTemplateDayVocabularyDetail(input: {
  subject: string;
  gradeLevel: string;
  topic: string;
  learningStandard?: string;
  dayLabel: string;
  dailyFocus: string;
  vocabulary: string[];
  lessonTitle: string;
}): LessonPlanDayVocabularyDetail {
  const standard = input.learningStandard?.trim();
  const contextIntro = standard
    ? `For a ${standard} ${input.subject} — ${input.topic} lesson (${input.dayLabel}), these vocabulary descriptions are appropriate:`
    : `For a ${input.gradeLevel} ${input.subject} — ${input.topic} lesson (${input.dayLabel}), these vocabulary descriptions are appropriate:`;

  const terms: LessonPlanVocabularyTermDetail[] = input.vocabulary.map((line) => {
    const { term, shortDefinition } = parseVocabularyLine(line);
    return {
      term,
      shortDefinition,
      definition: `${term} refers to ${shortDefinition.charAt(0).toLowerCase()}${shortDefinition.slice(1)}. Students should use this concept when working on ${input.topic} during ${input.dayLabel.toLowerCase()}.`,
      example: `Example: Students apply ${term.toLowerCase()} while practicing ${input.topic}.`,
    };
  });

  return {
    contextIntro,
    terms,
    mainConcept: {
      heading: "Main Concept",
      body: `${input.dailyFocus} This day's instruction centers on ${terms.map((t) => t.term).join(", ")} within the broader ${input.topic} unit.`,
    },
    process: {
      heading: "Process",
      steps: [
        {
          stepNumber: 1,
          title: "Introduce vocabulary",
          bullets: [
            `Present ${terms[0]?.term ?? "key terms"} with student-friendly definitions.`,
            "Connect each term to prior knowledge and the day's focus.",
          ],
        },
        {
          stepNumber: 2,
          title: "Guided practice",
          bullets: [
            "Model how to use the vocabulary in context.",
            "Students apply terms in pairs or small groups.",
          ],
        },
        {
          stepNumber: 3,
          title: "Check understanding",
          bullets: [
            "Quick formative check using the day's vocabulary.",
            "Clarify misconceptions before moving to the class timeline activities.",
          ],
        },
      ],
    },
    learningGoal: {
      heading: "Learning Goal",
      intro: "By the end of this class period, students should be able to:",
      objectives: [
        `Define and use the day's vocabulary for ${input.topic}.`,
        `Explain how ${terms[0]?.term ?? "key concepts"} connect to ${input.dailyFocus.toLowerCase()}.`,
        "Apply the terms accurately in discussion and written responses.",
      ],
    },
    additionalVocabulary: [
      {
        term: "Evidence",
        shortDefinition: "facts, observations, or data that support claims",
        definition:
          "Information collected through observation, measurement, or research that supports a conclusion about the topic.",
        example: `Example: A chart showing class survey results is evidence for conclusions about ${input.topic}.`,
      },
      {
        term: "Interpret",
        shortDefinition: "to explain what information or data shows",
        definition:
          "To describe the meaning of data, text, or observations in clear, grade-appropriate language.",
        example: "Example: Students interpret a graph by explaining what trend it shows.",
      },
    ],
  };
}

export function attachVocabularyDetailsToSchedule(
  schedule: LessonPlanDaySchedule[],
  details: LessonPlanDayVocabularyDetail[],
): LessonPlanDaySchedule[] {
  return schedule.map((day, index) => ({
    ...day,
    vocabularyDetail: details[index] ?? day.vocabularyDetail,
  }));
}
