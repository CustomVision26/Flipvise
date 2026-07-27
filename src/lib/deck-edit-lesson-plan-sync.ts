import { resolveDeckSubjectAndTopic } from "@/lib/deck-subject-topic";
import { LESSON_DIFFICULTY_LEVELS } from "@/lib/lesson-plan-difficulty";

export const DECK_EDIT_LESSON_INTAKE_STORAGE_PREFIX =
  "flipvise:deck-edit-lesson-intake:";

export type DeckEditLessonIntakePayload = {
  subject: string;
  topic: string;
  gradeLevel: string;
  difficultyLevel: string;
  deckId: number;
};

export function deckEditLessonIntakeStorageKey(lessonPlanId: number): string {
  return `${DECK_EDIT_LESSON_INTAKE_STORAGE_PREFIX}${lessonPlanId}`;
}

function normalizeDifficultyForLessonPlan(raw: string): string {
  const trimmed = raw.trim();
  if (
    LESSON_DIFFICULTY_LEVELS.includes(
      trimmed as (typeof LESSON_DIFFICULTY_LEVELS)[number],
    ) &&
    trimmed !== "All"
  ) {
    return trimmed;
  }
  if (trimmed === "On-level") return "Intermediate";
  return trimmed || "Intermediate";
}

/** Maps Edit deck fields → Lesson Builder intake (subject/topic/grade/difficulty). */
export function buildLessonIntakeFromDeckFields(fields: {
  name: string;
  description?: string | null;
  gradeLevel?: string | null;
  difficultyLevel?: string | null;
  deckId: number;
}): DeckEditLessonIntakePayload {
  const { subject, topic } = resolveDeckSubjectAndTopic({
    name: fields.name,
    description: fields.description,
  });
  return {
    subject,
    topic,
    gradeLevel: fields.gradeLevel?.trim() || "",
    difficultyLevel: normalizeDifficultyForLessonPlan(
      fields.difficultyLevel ?? "",
    ),
    deckId: fields.deckId,
  };
}

export function writeDeckEditLessonIntake(
  lessonPlanId: number,
  payload: DeckEditLessonIntakePayload,
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      deckEditLessonIntakeStorageKey(lessonPlanId),
      JSON.stringify(payload),
    );
  } catch {
    // Ignore quota / private-mode failures; form still opens with saved plan input.
  }
}

export function readDeckEditLessonIntake(
  lessonPlanId: number,
): DeckEditLessonIntakePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(
      deckEditLessonIntakeStorageKey(lessonPlanId),
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DeckEditLessonIntakePayload>;
    if (
      typeof parsed.subject !== "string" ||
      typeof parsed.topic !== "string" ||
      typeof parsed.gradeLevel !== "string" ||
      typeof parsed.difficultyLevel !== "string" ||
      typeof parsed.deckId !== "number"
    ) {
      return null;
    }
    return {
      subject: parsed.subject,
      topic: parsed.topic,
      gradeLevel: parsed.gradeLevel,
      difficultyLevel: parsed.difficultyLevel,
      deckId: parsed.deckId,
    };
  } catch {
    return null;
  }
}

export function clearDeckEditLessonIntake(lessonPlanId: number): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(deckEditLessonIntakeStorageKey(lessonPlanId));
  } catch {
    // no-op
  }
}
