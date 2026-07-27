import type { LessonPlanDaySchedule } from "@/lib/lesson-plan-ai-schema";
import {
  buildFallbackDayTimeline,
  clampPlanPeriodDays,
  DEFAULT_PLAN_PERIOD_DAYS,
  normalizeLessonPlanResultDayLabels,
  reconcileWeeklySchedule,
} from "@/lib/lesson-plan-weekly-schedule";
import type { LessonPlanInput, LessonPlanResult } from "@/lib/teacher-generators";

function display(value: string | undefined | null): string {
  return (value ?? "").trim();
}

function valuesEqual(
  a: string | number | undefined | null,
  b: string | number | undefined | null,
): boolean {
  return display(String(a ?? "")).toLowerCase() === display(String(b ?? "")).toLowerCase();
}

function cloneLessonPlanResult(result: LessonPlanResult): LessonPlanResult {
  return structuredClone(result);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replacePhrase(text: string, from: string, to: string): string {
  const source = display(from);
  const target = display(to);
  if (!source || !target || valuesEqual(source, target)) return text;
  if (source.length < 2) return text;
  try {
    // Single-token phrases use word boundaries so short subjects like "Math"
    // do not corrupt longer words (e.g. "Mathematics").
    const pattern = /\s/.test(source)
      ? escapeRegExp(source)
      : `\\b${escapeRegExp(source)}\\b`;
    return text.replace(new RegExp(pattern, "gi"), target);
  } catch {
    return text;
  }
}

/** Title core before an em/en dash subject suffix, e.g. "Learning Alegbra 1 — MAth". */
function extractTitleCore(lessonTitle: string): string {
  const title = display(lessonTitle);
  if (!title) return "";
  const split = title.split(/\s+[—–-]\s+/);
  return display(split[0] ?? title);
}

/**
 * Conservative Jamaica-link heuristic for deterministic adapt (no AI).
 * Fail closed: only clear Jamaica / PEP cues keep an existing NSC 5E flag.
 */
export function learningStandardLooksJamaicaRelated(
  learningStandard: string | undefined | null,
): boolean {
  const standard = display(learningStandard);
  if (!standard) return false;
  if (/\bjamaica\b/i.test(standard)) return true;
  if (/\bpep\b/i.test(standard)) return true;
  return false;
}

/** Grade strings that may appear in generated materials/objectives. */
export function gradeMentionVariants(gradeLevel: string): string[] {
  const grade = display(gradeLevel);
  if (!grade) return [];

  const withoutPrefix = grade.replace(/^grades?\s+/i, "").trim();
  const variants = new Set<string>();
  variants.add(grade);
  if (withoutPrefix) {
    variants.add(withoutPrefix);
    variants.add(`Grade ${withoutPrefix}`);
    variants.add(`grade ${withoutPrefix}`);
    variants.add(`Grades ${withoutPrefix}`);
    variants.add(`grades ${withoutPrefix}`);
    // Template bug: `grade ${"Grade 6"}` → "grade Grade 6"
    variants.add(`grade Grade ${withoutPrefix}`);
    variants.add(`grade grade ${withoutPrefix}`);
  }

  return [...variants]
    .filter((value) => value.length > 0)
    .sort((a, b) => b.length - a.length);
}

function adaptGradeMentions(
  text: string,
  sourceGrade: string,
  targetGrade: string,
): string {
  const target = display(targetGrade);
  if (!target || !text) return text;

  let next = text;
  for (const variant of gradeMentionVariants(sourceGrade)) {
    next = replacePhrase(next, `(grade ${variant})`, `(grade ${target})`);
    next = replacePhrase(next, variant, target);
  }

  // Collapse doubled "grade grade 7" after mixed-case replacements.
  next = next.replace(/\bgrade\s+grade\s+/gi, "grade ");

  // Clean residual template bug: "(grade Grade 7)" when target already includes Grade.
  if (/^grades?\s+/i.test(target)) {
    const bare = target.replace(/^grades?\s+/i, "").trim();
    if (bare) {
      next = next.replace(
        new RegExp(`\\(\\s*grades?\\s+${escapeRegExp(target)}\\s*\\)`, "gi"),
        `(grade ${bare})`,
      );
    }
  }

  return next;
}

const ALIGN_TO_CUE_RE =
  /Align(?:\s+[A-Za-z]+){0,8}\s+to\s+[^.]*(?=\.|$)/gi;
const ALIGNED_TO_CUE_RE = /Aligned to\s+[^.]*(?=\.|$)/gi;
const LEARNING_STANDARD_CUE_RE =
  /Learning standards?:\s*[^.]*(?=\.|$)/gi;

function adaptLearningStandardCues(
  text: string,
  targetStandard: string,
): string {
  const standard = display(targetStandard);
  let next = text;

  if (!standard) {
    next = next
      .replace(/\s*Align(?:\s+[A-Za-z]+){0,8}\s+to\s+[^.]*\.?/gi, "")
      .replace(/\s*Aligned to\s+[^.]*\.?/gi, "")
      .replace(/\s*Learning standards?:\s*[^.]*\.?/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    return next;
  }

  next = next.replace(ALIGN_TO_CUE_RE, `Align objectives and assessment to ${standard}`);
  next = next.replace(ALIGNED_TO_CUE_RE, `Aligned to ${standard}`);
  next = next.replace(LEARNING_STANDARD_CUE_RE, `Learning standard: ${standard}`);
  return next;
}

function sourceRetargetPhrases(
  sourceResult: LessonPlanResult,
  sourceInput: LessonPlanInput,
): string[] {
  const phrases = [
    display(sourceResult.lessonTitle),
    extractTitleCore(sourceResult.lessonTitle),
    display(sourceInput.topic),
    display(sourceInput.subject),
  ];

  const unique = new Map<string, string>();
  for (const phrase of phrases) {
    if (phrase.length < 3) continue;
    const key = phrase.toLowerCase();
    if (!unique.has(key)) unique.set(key, phrase);
  }

  return [...unique.values()].sort((a, b) => b.length - a.length);
}

function adaptTextField(
  text: string,
  sourceInput: LessonPlanInput,
  targetIntake: LessonPlanInput,
  sourcePhrases: string[],
): string {
  let next = text;
  const targetTopic = display(targetIntake.topic);

  for (const phrase of sourcePhrases) {
    // Prefer topic for title/topic phrases; subject phrases map to subject.
    const replacement =
      valuesEqual(phrase, sourceInput.subject) && display(targetIntake.subject)
        ? display(targetIntake.subject)
        : targetTopic || display(targetIntake.subject);
    if (replacement) {
      next = replacePhrase(next, phrase, replacement);
    }
  }

  next = replacePhrase(next, sourceInput.subject, targetIntake.subject);
  next = replacePhrase(next, sourceInput.topic, targetIntake.topic);
  next = adaptGradeMentions(
    next,
    sourceInput.gradeLevel,
    targetIntake.gradeLevel,
  );
  next = replacePhrase(
    next,
    sourceInput.difficultyLevel,
    targetIntake.difficultyLevel,
  );
  next = replacePhrase(
    next,
    sourceInput.learningStandard ?? "",
    targetIntake.learningStandard ?? "",
  );
  next = adaptLearningStandardCues(next, targetIntake.learningStandard ?? "");
  next = replacePhrase(next, sourceInput.classSize ?? "", targetIntake.classSize ?? "");

  return next;
}

function adaptStringList(
  items: string[],
  sourceInput: LessonPlanInput,
  targetIntake: LessonPlanInput,
  sourcePhrases: string[],
): string[] {
  return items.map((item) =>
    adaptTextField(item, sourceInput, targetIntake, sourcePhrases),
  );
}

function adaptVocabularyLine(
  line: string,
  sourceInput: LessonPlanInput,
  targetIntake: LessonPlanInput,
  sourcePhrases: string[],
): string {
  const adapted = adaptTextField(line, sourceInput, targetIntake, sourcePhrases);
  const topic = display(targetIntake.topic);
  if (!topic) return adapted;

  // Retarget generic "Topic — the main concept…" style lines to the new topic.
  const genericConcept = /^.+?\s+[—–-]\s+the main concept\b.*$/i;
  if (genericConcept.test(adapted)) {
    return `${topic} — the main concept students must understand for this unit`;
  }

  return adapted;
}

function adaptVocabularyList(
  items: string[],
  sourceInput: LessonPlanInput,
  targetIntake: LessonPlanInput,
  sourcePhrases: string[],
): string[] {
  return items.map((item) =>
    adaptVocabularyLine(item, sourceInput, targetIntake, sourcePhrases),
  );
}

function ensureObjectiveLearningStandard(
  objectives: string[],
  targetStandard: string,
): string[] {
  const standard = display(targetStandard);
  if (!standard) {
    return objectives.map((objective) =>
      adaptLearningStandardCues(objective, ""),
    );
  }

  const next = objectives.map((objective) =>
    adaptLearningStandardCues(objective, standard),
  );
  const hasStandard = next.some((objective) =>
    objective.toLowerCase().includes(standard.toLowerCase()),
  );
  if (hasStandard || next.length === 0) return next;

  const note = `Align objectives and assessment to ${standard}.`;
  const lastIndex = next.length - 1;
  const last = next[lastIndex]!;
  next[lastIndex] = /[.!?]\s*$/.test(last) ? `${last} ${note}` : `${last}. ${note}`;
  return next;
}

function ensureTeacherNotesIntake(
  teacherNotes: string,
  sourceInput: LessonPlanInput,
  targetIntake: LessonPlanInput,
  sourcePhrases: string[],
): string {
  let next = adaptTextField(
    teacherNotes,
    sourceInput,
    targetIntake,
    sourcePhrases,
  );

  const classSize = display(targetIntake.classSize);
  if (classSize) {
    if (/Class size:\s*[^.]*/i.test(next)) {
      next = next.replace(/Class size:\s*[^.]*/i, `Class size: ${classSize}`);
    } else {
      next = `${next.replace(/\s+$/, "")}${/[.!?]$/.test(next.trim()) ? "" : "."} Class size: ${classSize}.`;
    }
  }

  const standard = display(targetIntake.learningStandard);
  if (standard) {
    if (/Aligned to\s+[^.]*/i.test(next)) {
      next = next.replace(/Aligned to\s+[^.]*/i, `Aligned to ${standard}`);
    } else if (!next.toLowerCase().includes(standard.toLowerCase())) {
      next = `${next.replace(/\s+$/, "")}${/[.!?]$/.test(next.trim()) ? "" : "."} Aligned to ${standard}.`;
    }
  } else {
    next = adaptLearningStandardCues(next, "");
  }

  const accommodations = display(targetIntake.specialInstructions);
  const sourceAccommodations = display(sourceInput.specialInstructions);
  if (accommodations) {
    if (/Accommodations:\s*[^.]*/i.test(next)) {
      next = next.replace(
        /Accommodations:\s*[^.]*/i,
        `Accommodations: ${accommodations}`,
      );
    } else {
      next = `${next.replace(/\s+$/, "")}${/[.!?]$/.test(next.trim()) ? "" : "."} Accommodations: ${accommodations}.`;
    }
  } else if (sourceAccommodations) {
    next = next
      .replace(/\s*Accommodations:\s*[^.]*\.?/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  return next.replace(/\s{2,}/g, " ").trim();
}

function ensureDifferentiatedAccommodations(
  lines: string[],
  sourceInput: LessonPlanInput,
  targetIntake: LessonPlanInput,
  sourcePhrases: string[],
): string[] {
  const adapted = adaptStringList(lines, sourceInput, targetIntake, sourcePhrases);
  const accommodations = display(targetIntake.specialInstructions);
  const withoutAccommodationLines = adapted.filter(
    (line) => !/^Accommodations:/i.test(line.trim()),
  );

  if (!accommodations) return withoutAccommodationLines;

  return [
    ...withoutAccommodationLines,
    `Accommodations: integrate ${accommodations} across instruction (materials, pacing, and response formats).`,
  ];
}

function buildAdaptedLessonTitle(
  sourceTitle: string,
  sourceInput: LessonPlanInput,
  targetIntake: LessonPlanInput,
): string {
  const topic = display(targetIntake.topic) || display(sourceInput.topic) || "Lesson";
  const subject = display(targetIntake.subject);
  const grade = display(targetIntake.gradeLevel);

  if (subject && grade) return `${topic} — ${subject} (${grade})`;
  if (subject) return `${topic} — ${subject}`;

  const sourceTopic = display(sourceInput.topic);
  if (sourceTopic && display(sourceTitle).toLowerCase().includes(sourceTopic.toLowerCase())) {
    return replacePhrase(display(sourceTitle), sourceTopic, topic);
  }

  return topic;
}

function buildDailyFocusForDay(
  index: number,
  totalDays: number,
  topic: string,
  day: LessonPlanDaySchedule,
): string {
  const termCount = day.vocabulary.length;
  const termPhrase =
    termCount === 1
      ? "1 vocabulary term"
      : `${termCount} vocabulary terms`;

  if (index === 0) {
    return `Launch ${topic}: introduce foundational ideas and ${termPhrase}.`;
  }
  if (index === totalDays - 1) {
    return `Consolidate ${topic}: review, assess, and connect learning across the unit.`;
  }
  if (termCount > 0) {
    return `Develop ${topic} through ${termPhrase} and guided practice.`;
  }
  return `Practice and deepen understanding of ${topic}.`;
}

function refreshDailyFocusIfNeeded(
  schedule: LessonPlanDaySchedule[],
  topic: string,
  topicChanged: boolean,
): LessonPlanDaySchedule[] {
  if (!topicChanged || schedule.length === 0) return schedule;

  const focuses = schedule.map((day) => display(day.dailyFocus).toLowerCase());
  const uniqueFocusCount = new Set(focuses).size;
  const shouldRefresh =
    uniqueFocusCount <= 1 ||
    focuses.some((focus) => !focus.includes(topic.toLowerCase()));

  if (!shouldRefresh) return schedule;

  return schedule.map((day, index) => ({
    ...day,
    dailyFocus: buildDailyFocusForDay(index, schedule.length, topic, day),
  }));
}

function rebuildDayTimeline(
  day: LessonPlanDaySchedule,
  targetIntake: LessonPlanInput,
  useFiveEModel: boolean,
): string[] {
  return buildFallbackDayTimeline(
    display(targetIntake.topic) || "the lesson",
    display(targetIntake.lessonDuration) || "45 minutes",
    day.vocabulary.length,
    display(targetIntake.difficultyLevel) || "Intermediate",
    { useFiveEModel },
  );
}

/**
 * Deterministically adapt a creator's saved lesson-plan result to an assignee's
 * current intake. Does not call AI — reconciles schedule length/duration and
 * retargets topic/subject/grade/difficulty/learning-standard/class-size wording.
 *
 * Used for “create my lesson plan from the linked plan”: content is copied from
 * the creator plan, then restructured to fit the assignee's Input UI fields.
 */
export function adaptLessonPlanResultToIntake(
  sourceResult: LessonPlanResult,
  sourceInput: LessonPlanInput,
  targetIntake: LessonPlanInput,
): LessonPlanResult {
  const planPeriodDays = clampPlanPeriodDays(
    targetIntake.planPeriodDays ?? DEFAULT_PLAN_PERIOD_DAYS,
  );
  const sourceUsedFiveE = Boolean(sourceResult.jamaicaNscGuidelinesApplied);
  const useFiveEModel =
    sourceUsedFiveE &&
    learningStandardLooksJamaicaRelated(targetIntake.learningStandard);

  const durationChanged = !valuesEqual(
    sourceInput.lessonDuration,
    targetIntake.lessonDuration,
  );
  const difficultyChanged = !valuesEqual(
    sourceInput.difficultyLevel,
    targetIntake.difficultyLevel,
  );
  const topicChanged = !valuesEqual(sourceInput.topic, targetIntake.topic);
  const fiveEPolicyChanged = sourceUsedFiveE !== useFiveEModel;
  const shouldRebuildTimelines =
    durationChanged || difficultyChanged || fiveEPolicyChanged;

  const sourcePhrases = sourceRetargetPhrases(sourceResult, sourceInput);
  const adapted = cloneLessonPlanResult(sourceResult);

  adapted.jamaicaNscGuidelinesApplied = useFiveEModel;
  adapted.lessonTitle = buildAdaptedLessonTitle(
    sourceResult.lessonTitle,
    sourceInput,
    targetIntake,
  );

  adapted.learningObjectives = ensureObjectiveLearningStandard(
    adaptStringList(
      adapted.learningObjectives,
      sourceInput,
      targetIntake,
      sourcePhrases,
    ),
    targetIntake.learningStandard ?? "",
  );
  adapted.materialsNeeded = adaptStringList(
    adapted.materialsNeeded,
    sourceInput,
    targetIntake,
    sourcePhrases,
  );
  adapted.vocabulary = adaptVocabularyList(
    adapted.vocabulary,
    sourceInput,
    targetIntake,
    sourcePhrases,
  );
  adapted.warmUpActivity = adaptTextField(
    adapted.warmUpActivity,
    sourceInput,
    targetIntake,
    sourcePhrases,
  );
  adapted.mainTeachingSteps = adaptStringList(
    adapted.mainTeachingSteps,
    sourceInput,
    targetIntake,
    sourcePhrases,
  );
  adapted.classroomActivity = adaptTextField(
    adapted.classroomActivity,
    sourceInput,
    targetIntake,
    sourcePhrases,
  );
  adapted.assessmentQuestions = adaptStringList(
    adapted.assessmentQuestions,
    sourceInput,
    targetIntake,
    sourcePhrases,
  );
  adapted.homework = adaptTextField(
    adapted.homework,
    sourceInput,
    targetIntake,
    sourcePhrases,
  );
  adapted.differentiatedInstruction = ensureDifferentiatedAccommodations(
    adapted.differentiatedInstruction,
    sourceInput,
    targetIntake,
    sourcePhrases,
  );
  adapted.teacherNotes = ensureTeacherNotesIntake(
    adapted.teacherNotes,
    sourceInput,
    targetIntake,
    sourcePhrases,
  );
  adapted.lessonTimeline = adaptStringList(
    adapted.lessonTimeline,
    sourceInput,
    targetIntake,
    sourcePhrases,
  );

  if (adapted.weeklySchedule) {
    adapted.weeklySchedule = adapted.weeklySchedule.map((day) => ({
      ...day,
      dailyFocus: adaptTextField(
        day.dailyFocus,
        sourceInput,
        targetIntake,
        sourcePhrases,
      ),
      vocabulary: adaptVocabularyList(
        day.vocabulary,
        sourceInput,
        targetIntake,
        sourcePhrases,
      ),
      lessonTimeline: adaptStringList(
        day.lessonTimeline,
        sourceInput,
        targetIntake,
        sourcePhrases,
      ),
    }));
  }

  const topic = display(targetIntake.topic) || "the lesson";
  const duration = display(targetIntake.lessonDuration) || "45 minutes";
  const difficulty = display(targetIntake.difficultyLevel) || "Intermediate";

  if (planPeriodDays <= 1) {
    adapted.weeklySchedule = undefined;
    if (shouldRebuildTimelines || adapted.lessonTimeline.length < 3) {
      adapted.lessonTimeline = buildFallbackDayTimeline(
        topic,
        duration,
        adapted.vocabulary.length,
        difficulty,
        { useFiveEModel },
      );
    }
    return normalizeLessonPlanResultDayLabels(adapted);
  }

  const reconciled = reconcileWeeklySchedule({
    vocabulary: adapted.vocabulary,
    weeklySchedule: adapted.weeklySchedule,
    planPeriodDays,
    lessonDuration: duration,
    topic,
    difficulty,
    useFiveEModel,
  });

  const withFocus = refreshDailyFocusIfNeeded(reconciled, topic, topicChanged);

  adapted.weeklySchedule = shouldRebuildTimelines
    ? withFocus.map((day) => ({
        ...day,
        lessonTimeline: rebuildDayTimeline(day, targetIntake, useFiveEModel),
      }))
    : withFocus;

  // Multi-day units keep root timeline as a short unit overview when present.
  if (shouldRebuildTimelines && adapted.lessonTimeline.length > 0) {
    adapted.lessonTimeline = adapted.lessonTimeline.map((line) =>
      adaptTextField(line, sourceInput, targetIntake, sourcePhrases),
    );
  }

  return normalizeLessonPlanResultDayLabels(adapted);
}
