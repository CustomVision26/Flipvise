import "server-only";

import {
  getSavedLessonPlanByDeckIdForUser,
  resolveSavedLessonPlanForViewer,
} from "@/db/queries/saved-lesson-plans";
import {
  getLessonPlanReferenceMaterials,
  type LessonPlanReferenceMaterial,
} from "@/lib/lesson-plan-reference-material";
import type { HomeworkSourceType } from "@/lib/teacher-homework-ai-schema";

export async function resolveReferenceMaterialsForHomeworkSource(
  userId: string,
  options: {
    sourceType: HomeworkSourceType;
    savedLessonPlanId?: number | null;
    deckId?: number | null;
    teamId?: number | null;
  },
): Promise<LessonPlanReferenceMaterial[]> {
  if (options.sourceType === "lesson_plan" && options.savedLessonPlanId != null) {
    const plan = await resolveSavedLessonPlanForViewer(
      userId,
      options.savedLessonPlanId,
      options.teamId,
    );
    return getLessonPlanReferenceMaterials(plan?.input);
  }

  if (options.deckId != null) {
    const plan = await getSavedLessonPlanByDeckIdForUser(userId, options.deckId);
    return getLessonPlanReferenceMaterials(plan?.input);
  }

  return [];
}

export async function resolveReferenceMaterialsForWorksheetDeck(
  userId: string,
  deckId: number,
): Promise<LessonPlanReferenceMaterial[]> {
  const plan = await getSavedLessonPlanByDeckIdForUser(userId, deckId);
  return getLessonPlanReferenceMaterials(plan?.input);
}
