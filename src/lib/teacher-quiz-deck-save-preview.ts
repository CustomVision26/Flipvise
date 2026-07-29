import { lessonPlanDeckDescriptionMarker } from "@/lib/lesson-plan-deck-marker";
import type { LessonPlanDayScope } from "@/lib/lesson-plan-day-scope";
import {
  buildLessonPlanScopedDeckName,
  buildShortTeacherDeckName,
  formatCompactDayScopeLabel,
  parseLessonScopeLabelFromDeckName,
  parseLessonScopeLabelFromDescription,
  stripLessonPlanScopedDeckSuffix,
} from "@/lib/teacher-generation-titles";

export type TeacherQuizDeckSaveDestinationPreview = {
  mode: "append" | "create";
  deckName: string;
};

type PreviewDeck = {
  id: number;
  name: string;
  description: string | null;
};

function normalizeNameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function deckScopeKey(deck: PreviewDeck): string | null {
  const fromDesc = parseLessonScopeLabelFromDescription(deck.description);
  if (fromDesc) return normalizeNameKey(fromDesc);
  const fromName = parseLessonScopeLabelFromDeckName(deck.name);
  if (fromName) return normalizeNameKey(fromName);
  return null;
}

/**
 * Client-side preview of where quiz cards will be saved — mirrors
 * `resolveLessonPlanQuizDeckSaveTarget` against decks already loaded in the UI.
 */
export function previewTeacherQuizDeckSaveDestination(input: {
  savedLessonPlanId?: number | null;
  dayScope?: LessonPlanDayScope | null;
  subject: string;
  topic: string;
  /** Linked lesson-plan source deck id (excluded from All Days / Day N targets). */
  linkedMainDeckId?: number | null;
  linkedMainDeckName?: string | null;
  sourceDeckName?: string | null;
  decks: PreviewDeck[];
}): TeacherQuizDeckSaveDestinationPreview {
  const shortName = buildShortTeacherDeckName(input.subject, input.topic);

  if (input.savedLessonPlanId == null) {
    return { mode: "create", deckName: shortName };
  }

  const excludeDeckId = input.linkedMainDeckId ?? null;
  const baseName =
    (input.linkedMainDeckName
      ? stripLessonPlanScopedDeckSuffix(input.linkedMainDeckName)
      : "") ||
    input.sourceDeckName?.trim() ||
    shortName;

  const dayScope: LessonPlanDayScope = input.dayScope ?? "all";
  const scopedName = buildLessonPlanScopedDeckName(baseName, dayScope);
  const scopeLabel = formatCompactDayScopeLabel(dayScope);
  const expectedScopeKey = scopeLabel ? normalizeNameKey(scopeLabel) : null;
  const marker = lessonPlanDeckDescriptionMarker(input.savedLessonPlanId);

  const candidates = input.decks.filter((deck) => deck.id !== excludeDeckId);
  const tagged = candidates.filter((deck) =>
    (deck.description ?? "").includes(marker),
  );

  const nameKey = normalizeNameKey(scopedName);
  const byName = tagged.find((deck) => {
    if (normalizeNameKey(deck.name) !== nameKey) return false;
    const scopeKey = deckScopeKey(deck);
    return scopeKey == null || scopeKey === expectedScopeKey;
  });
  if (byName) {
    return { mode: "append", deckName: byName.name };
  }

  if (expectedScopeKey) {
    const byScope = tagged.find(
      (deck) => deckScopeKey(deck) === expectedScopeKey,
    );
    if (byScope) {
      return { mode: "append", deckName: byScope.name };
    }
  }

  const byExactName = candidates.find((deck) => {
    if (normalizeNameKey(deck.name) !== nameKey) return false;
    const scopeKey = deckScopeKey(deck);
    return scopeKey == null || scopeKey === expectedScopeKey;
  });
  if (byExactName) {
    return { mode: "append", deckName: byExactName.name };
  }

  return { mode: "create", deckName: scopedName };
}
