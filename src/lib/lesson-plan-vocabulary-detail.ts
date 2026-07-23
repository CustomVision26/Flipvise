import type {
  LessonPlanDaySchedule,
  LessonPlanDayVocabularyDetail,
  LessonPlanVocabularyTermDetail,
} from "@/lib/lesson-plan-ai-schema";
import {
  isNonConceptVocabularyTerm,
  resolveVocabularyBank,
  type VocabularyBankEntry,
} from "@/lib/lesson-plan-vocabulary-banks";

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

function bankEntryToTermDetail(
  entry: VocabularyBankEntry,
  topic: string,
): LessonPlanVocabularyTermDetail {
  return {
    term: entry.term,
    shortDefinition: entry.shortDefinition,
    definition: `${entry.term} refers to ${entry.shortDefinition}. Students should use this concept when working on ${topic}.`,
    example: `Example: Students use ${entry.term.toLowerCase()} while practicing ${topic}.`,
  };
}

/**
 * Prefer assigned day lines when they are real subject concepts; otherwise
 * substitute curated topic concepts (e.g. Algebra → Variable, Equation).
 */
function resolveDayVocabularyTerms(input: {
  subject: string;
  topic: string;
  lessonTitle: string;
  vocabulary: string[];
}): LessonPlanVocabularyTermDetail[] {
  const bank = resolveVocabularyBank(input.topic, input.subject);
  const assigned = input.vocabulary.map((line) => {
    const { term, shortDefinition } = parseVocabularyLine(line);
    return { term, shortDefinition };
  });

  const usable = assigned.filter(
    (entry) =>
      !isNonConceptVocabularyTerm(entry.term, input.topic, input.lessonTitle),
  );

  if (usable.length > 0) {
    return usable.map((entry) => ({
      term: entry.term,
      shortDefinition: entry.shortDefinition,
      definition: `${entry.term} refers to ${entry.shortDefinition.charAt(0).toLowerCase()}${entry.shortDefinition.slice(1)}. Students should use this concept when working on ${input.topic}.`,
      example: `Example: Students apply ${entry.term.toLowerCase()} while practicing ${input.topic}.`,
    }));
  }

  if (bank && bank.length > 0) {
    const count = Math.min(Math.max(assigned.length, 2), 6, bank.length);
    return bank.slice(0, count).map((entry) => bankEntryToTermDetail(entry, input.topic));
  }

  return assigned.map((entry) => ({
    term: entry.term,
    shortDefinition: entry.shortDefinition,
    definition: `${entry.term} refers to ${entry.shortDefinition.charAt(0).toLowerCase()}${entry.shortDefinition.slice(1)}. Students should use this concept when working on ${input.topic}.`,
    example: `Example: Students apply ${entry.term.toLowerCase()} while practicing ${input.topic}.`,
  }));
}

function buildAdditionalVocabulary(
  subject: string,
  topic: string,
  dayTerms: LessonPlanVocabularyTermDetail[],
  learningStandard?: string,
): LessonPlanVocabularyTermDetail[] {
  const bank = resolveVocabularyBank(topic, subject);
  const dayTermNames = new Set(dayTerms.map((t) => t.term.toLowerCase()));

  if (bank) {
    const extras = bank
      .filter((entry) => !dayTermNames.has(entry.term.toLowerCase()))
      .slice(0, 10)
      .map((entry) => bankEntryToTermDetail(entry, topic));

    if (extras.length > 0) {
      return extras;
    }
  }

  const standard = learningStandard?.trim();
  const pepNote = standard && /pep/i.test(standard) ? " (PEP-aligned)" : "";

  return [
    {
      term: "Evidence",
      shortDefinition: "facts, observations, or data that support claims",
      definition: `Information collected through observation, measurement, or research that supports a conclusion about the topic${pepNote}.`,
      example: `Example: A chart showing class survey results is evidence for conclusions about ${topic}.`,
    },
    {
      term: "Interpret",
      shortDefinition: "to explain what information or data shows",
      definition:
        "To describe the meaning of data, text, or observations in clear, grade-appropriate language.",
      example: "Example: Students interpret a graph by explaining what trend it shows.",
    },
  ];
}

/**
 * Ensure day vocabulary detail uses real subject concepts when AI or assigned
 * lines echoed the topic title / meta-terms.
 */
export function sanitizeDayVocabularyDetail(
  detail: LessonPlanDayVocabularyDetail,
  input: {
    subject: string;
    topic: string;
    lessonTitle: string;
    learningStandard?: string;
    vocabulary: string[];
  },
): LessonPlanDayVocabularyDetail {
  const usableTerms = detail.terms.filter(
    (term) =>
      !isNonConceptVocabularyTerm(term.term, input.topic, input.lessonTitle),
  );

  const terms =
    usableTerms.length > 0
      ? usableTerms
      : resolveDayVocabularyTerms(input);

  const existingAdditional = (detail.additionalVocabulary ?? []).filter(
    (term) =>
      !isNonConceptVocabularyTerm(term.term, input.topic, input.lessonTitle),
  );

  const additionalVocabulary =
    existingAdditional.length >= 4
      ? existingAdditional
      : buildAdditionalVocabulary(
          input.subject,
          input.topic,
          terms,
          input.learningStandard,
        );

  return {
    ...detail,
    terms,
    additionalVocabulary,
  };
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

  const terms = resolveDayVocabularyTerms(input);
  const additionalVocabulary = buildAdditionalVocabulary(
    input.subject,
    input.topic,
    terms,
    input.learningStandard,
  );

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
    additionalVocabulary,
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

export function scheduleDaysEligibleForVocabularyDetail(
  schedule: LessonPlanDaySchedule[],
): LessonPlanDaySchedule[] {
  return schedule.filter(
    (day) => day.dailyFocus.trim().length > 0 && day.vocabulary.length > 0,
  );
}

/** Map AI-generated details onto schedule rows by day label (stable after edits). */
export function mergeVocabularyDetailsByDayLabel(
  schedule: LessonPlanDaySchedule[],
  targetDays: Array<Pick<LessonPlanDaySchedule, "dayLabel">>,
  details: LessonPlanDayVocabularyDetail[],
): LessonPlanDaySchedule[] {
  const detailByLabel = new Map(
    targetDays.map((day, index) => [day.dayLabel, details[index]!]),
  );

  return schedule.map((day) => {
    const refreshed = detailByLabel.get(day.dayLabel);
    if (refreshed) {
      return { ...day, vocabularyDetail: refreshed };
    }
    if (!day.dailyFocus.trim() || day.vocabulary.length === 0) {
      return { ...day, vocabularyDetail: undefined };
    }
    return day;
  });
}
