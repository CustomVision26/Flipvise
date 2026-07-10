import type { DeckRow } from "@/db/queries/decks";
import { parseDeckSubjectTopic } from "@/lib/deck-subject-topic";

type LessonPlanDeckMatchFields = {
  subject: string;
  topic: string;
  gradeLevel: string;
};

type DeckMatchFields = Pick<
  DeckRow,
  "name" | "description" | "gradeLevel" | "difficultyLevel"
>;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function lessonPlanMatchesDeck(
  plan: LessonPlanDeckMatchFields,
  deck: DeckMatchFields,
): boolean {
  const { subject, topic } = parseDeckSubjectTopic(deck);
  const gradeLevel = deck.gradeLevel?.trim() ?? "";
  if (!subject && !topic && !gradeLevel) {
    return false;
  }

  const subjectMatch = !subject || normalize(plan.subject) === normalize(subject);
  const topicMatch = !topic || normalize(plan.topic) === normalize(topic);
  const gradeMatch = !gradeLevel || normalize(plan.gradeLevel) === normalize(gradeLevel);
  return subjectMatch && topicMatch && gradeMatch;
}
