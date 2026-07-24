import type {
  FiveEPhaseName,
  LessonPlanDaySchedule,
  LessonPlanDayVocabularyDetail,
  LessonPlanFiveEBreakdown,
  LessonPlanFiveEPhase,
  LessonPlanVocabularyTermDetail,
} from "@/lib/lesson-plan-ai-schema";
import { FIVE_E_PHASES } from "@/lib/lesson-plan-ai-schema";
import {
  isNonConceptVocabularyTerm,
  resolveVocabularyBank,
  type VocabularyBankEntry,
} from "@/lib/lesson-plan-vocabulary-banks";

const FIVE_E_DEFAULT_TIME_RANGES = [
  "0-5 min",
  "5-15 min",
  "15-25 min",
  "25-35 min",
  "35-45 min",
] as const;

const FIVE_E_PHASE_HINTS: Record<FiveEPhaseName, string> = {
  Engage: "Activate prior knowledge and curiosity with a quick hook.",
  Explore: "Students investigate sources or materials while the teacher facilitates.",
  Explain: "Students articulate discoveries; teacher formalizes concepts and vocabulary.",
  Elaborate: "Students apply learning to a new authentic context or problem.",
  Evaluate: "Check understanding with a formative or performance task.",
};

function stripTimelinePrefix(line: string): string {
  return line
    .replace(/^\s*\d+\s*(?:-|–|—)\s*\d+\s*mins?\s*:\s*/iu, "")
    .replace(/^\s*\d+\s*mins?\s*(?:-|–|—)\s*/iu, "")
    .replace(
      /^\s*(Engage|Explore|Explain|Elaborate|Evaluate)\s*(?:-|–|—|:)\s*/iu,
      "",
    )
    .replace(
      /^\s*(Warm-?ups?|Instruction|Activity|Closing|Practice|Assessment|Direct instruction|Guided practice|Exit ticket|Reflection)(?:\s*\([^)]*\))?\s*:\s*/iu,
      "",
    )
    .trim();
}

function detectFiveEPhase(line: string): FiveEPhaseName | null {
  const match = line.match(
    /\b(Engage|Explore|Explain|Elaborate|Evaluate)\b/iu,
  );
  if (!match?.[1]) return null;
  const normalized =
    match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
  return FIVE_E_PHASES.find((phase) => phase === normalized) ?? null;
}

function extractTimeRange(line: string, fallback: string): string {
  const rangeMatch = line.match(/(\d+\s*(?:-|–|—)\s*\d+\s*mins?)/iu);
  if (rangeMatch?.[1]) {
    return rangeMatch[1]
      .replace(/\s+/gu, " ")
      .replace(/(?:–|—)/gu, "-")
      .replace(/\bmins\b/iu, "min");
  }
  const parenMatch = line.match(/\((\d+\s*mins?)\)/iu);
  if (parenMatch?.[1]) {
    return parenMatch[1].replace(/\s+/gu, " ").replace(/\bmins\b/iu, "min");
  }
  const singleMatch = line.match(/(\d+\s*mins?)/iu);
  if (singleMatch?.[1]) {
    return singleMatch[1].replace(/\s+/gu, " ").replace(/\bmins\b/iu, "min");
  }
  return fallback;
}

/** Short Class timeline outline lines from an expanded 5E breakdown. */
export function lessonTimelineLinesFromFiveEBreakdown(
  breakdown: LessonPlanFiveEBreakdown,
): string[] {
  return breakdown.phases.map(
    (phase) =>
      `${phase.timeRange}: ${phase.phase} — ${phase.activitySummary}`,
  );
}

export function dayLessonTimelineLooksLikeFiveE(lines: string[] | undefined): boolean {
  const timeline = lines ?? [];
  if (timeline.length < 5) return false;
  return FIVE_E_PHASES.every((phase) =>
    timeline.some((line) => detectFiveEPhase(line) === phase),
  );
}

/** Prefer stored 5E outline; otherwise derive Engage→Evaluate lines from the day timeline. */
export function resolveFiveEClassTimelineOutline(input: {
  dailyFocus: string;
  vocabularyTerms: LessonPlanVocabularyTermDetail[];
  lessonTimeline?: string[];
  fiveEBreakdown?: LessonPlanFiveEBreakdown | null;
}): string[] {
  if (input.fiveEBreakdown?.phases?.length === 5) {
    return lessonTimelineLinesFromFiveEBreakdown(input.fiveEBreakdown);
  }
  if (dayLessonTimelineLooksLikeFiveE(input.lessonTimeline)) {
    return (input.lessonTimeline ?? []).slice(0, 5);
  }
  return lessonTimelineLinesFromFiveEBreakdown(
    buildFiveEBreakdownFromTimeline({
      dailyFocus: input.dailyFocus,
      vocabularyTerms: input.vocabularyTerms,
      lessonTimeline: input.lessonTimeline,
    }),
  );
}

function pickVocabularyFocus(
  terms: LessonPlanVocabularyTermDetail[],
  phaseIndex: number,
): string[] {
  if (terms.length === 0) return [];
  if (terms.length === 1) return [terms[0]!.term];
  // Spread terms across Explore → Evaluate; Engage stays light.
  if (phaseIndex === 0) return terms.slice(0, 1).map((term) => term.term);
  const start = (phaseIndex - 1) % terms.length;
  const focused = [terms[start]!.term];
  if (terms.length > 2 && phaseIndex >= 3) {
    focused.push(terms[(start + 1) % terms.length]!.term);
  }
  return focused;
}

/** Build a classroom-ready 5E breakdown from the day's timeline + vocabulary. */
export function buildFiveEBreakdownFromTimeline(input: {
  dailyFocus: string;
  vocabularyTerms: LessonPlanVocabularyTermDetail[];
  lessonTimeline?: string[];
}): LessonPlanFiveEBreakdown {
  const timeline = (input.lessonTimeline ?? []).map((line) => line.trim()).filter(Boolean);
  const byPhase = new Map<FiveEPhaseName, string>();

  for (const line of timeline) {
    const phase = detectFiveEPhase(line);
    if (phase && !byPhase.has(phase)) {
      byPhase.set(phase, line);
    }
  }

  const phases: LessonPlanFiveEPhase[] = FIVE_E_PHASES.map((phase, index) => {
    const sourceLine =
      byPhase.get(phase) ??
      timeline[index] ??
      `${FIVE_E_DEFAULT_TIME_RANGES[index]}: ${phase} — ${FIVE_E_PHASE_HINTS[phase]}`;
    const activitySummary =
      stripTimelinePrefix(sourceLine) || FIVE_E_PHASE_HINTS[phase];
    const vocabularyFocus = pickVocabularyFocus(input.vocabularyTerms, index);
    const vocabClause =
      vocabularyFocus.length > 0
        ? ` Emphasize ${vocabularyFocus.join(" and ")}.`
        : "";

    return {
      phase,
      timeRange: extractTimeRange(sourceLine, FIVE_E_DEFAULT_TIME_RANGES[index]!),
      activitySummary,
      detail: `${FIVE_E_PHASE_HINTS[phase]} Connected to today's focus: ${input.dailyFocus}.${vocabClause}`,
      vocabularyFocus,
      teacherMoves: [
        `Facilitate the ${phase.toLowerCase()} segment with clear timing cues.`,
        vocabularyFocus.length > 0
          ? `Prompt students to use ${vocabularyFocus.join(", ")} in discussion.`
          : `Connect the activity back to ${input.dailyFocus}.`,
      ],
      studentMoves: [
        `Complete the ${phase.toLowerCase()} task actively with a partner or group.`,
        vocabularyFocus.length > 0
          ? `Use ${vocabularyFocus.join(" / ")} accurately when speaking or writing.`
          : "Share reasoning and listen to peers.",
      ],
    };
  });

  return {
    heading: "5E Class Timeline Detail",
    intro:
      "Expanded Engage → Evaluate pacing for this class period, with vocabulary woven into each phase.",
    phases,
  };
}

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
    dailyFocus?: string;
    lessonTimeline?: string[];
    useFiveEModel?: boolean;
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

  if (!input.useFiveEModel) {
    const { fiveEBreakdown: _removed, ...withoutFiveE } = detail;
    return {
      ...withoutFiveE,
      terms,
      additionalVocabulary,
    };
  }

  const fiveEBreakdown =
    detail.fiveEBreakdown?.phases?.length === 5
      ? detail.fiveEBreakdown
      : buildFiveEBreakdownFromTimeline({
          dailyFocus: input.dailyFocus?.trim() || input.topic,
          vocabularyTerms: terms,
          lessonTimeline: input.lessonTimeline,
        });

  return {
    ...detail,
    terms,
    fiveEBreakdown,
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
  lessonTimeline?: string[];
  useFiveEModel?: boolean;
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
  const fiveEBreakdown = input.useFiveEModel
    ? buildFiveEBreakdownFromTimeline({
        dailyFocus: input.dailyFocus,
        vocabularyTerms: terms,
        lessonTimeline: input.lessonTimeline,
      })
    : undefined;

  return {
    contextIntro,
    terms,
    ...(fiveEBreakdown ? { fiveEBreakdown } : {}),
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

function withSyncedFiveELessonTimeline(
  day: LessonPlanDaySchedule,
  detail: LessonPlanDayVocabularyDetail | undefined,
): LessonPlanDaySchedule {
  if (!detail?.fiveEBreakdown || detail.fiveEBreakdown.phases.length !== 5) {
    return { ...day, vocabularyDetail: detail };
  }
  return {
    ...day,
    vocabularyDetail: detail,
    lessonTimeline: lessonTimelineLinesFromFiveEBreakdown(detail.fiveEBreakdown),
  };
}

export function attachVocabularyDetailsToSchedule(
  schedule: LessonPlanDaySchedule[],
  details: LessonPlanDayVocabularyDetail[],
): LessonPlanDaySchedule[] {
  return schedule.map((day, index) =>
    withSyncedFiveELessonTimeline(day, details[index] ?? day.vocabularyDetail),
  );
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
      return withSyncedFiveELessonTimeline(day, refreshed);
    }
    if (!day.dailyFocus.trim() || day.vocabulary.length === 0) {
      return { ...day, vocabularyDetail: undefined };
    }
    return day;
  });
}
