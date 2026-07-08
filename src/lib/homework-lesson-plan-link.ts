import type { SavedHomeworkPickerItem } from "@/db/queries/saved-homework";
import type { SavedLessonPlanPickerItem } from "@/db/queries/saved-lesson-plans";

function normalizeField(value: string): string {
  return value.trim().toLowerCase();
}

export function resolveHomeworkLessonPlanId(
  homework: Pick<SavedHomeworkPickerItem, "savedLessonPlanId" | "inputSavedLessonPlanId">,
): number | null {
  return homework.savedLessonPlanId ?? homework.inputSavedLessonPlanId ?? null;
}

export function resolveHomeworkDeckId(
  homework: Pick<SavedHomeworkPickerItem, "deckId" | "inputDeckId">,
): number | null {
  return homework.deckId ?? homework.inputDeckId ?? null;
}

function homeworkSharesLessonContext(
  homework: SavedHomeworkPickerItem,
  plan: SavedLessonPlanPickerItem,
): boolean {
  return (
    normalizeField(homework.subject) === normalizeField(plan.subject) &&
    normalizeField(homework.topic) === normalizeField(plan.topic) &&
    normalizeField(homework.gradeLevel) === normalizeField(plan.gradeLevel)
  );
}

export function homeworkMatchesSavedLessonPlan(
  homework: SavedHomeworkPickerItem,
  plan: SavedLessonPlanPickerItem,
): boolean {
  const linkedPlanId = resolveHomeworkLessonPlanId(homework);
  if (linkedPlanId === plan.id) {
    return true;
  }

  const planTitle = plan.lessonTitle.trim();
  const homeworkPlanTitle = homework.sourceLessonPlanTitle?.trim();
  if (planTitle && homeworkPlanTitle && planTitle === homeworkPlanTitle) {
    return true;
  }

  const homeworkDeckId = resolveHomeworkDeckId(homework);
  if (plan.deckId != null && homeworkDeckId != null && plan.deckId === homeworkDeckId) {
    return true;
  }

  const planDeckName = plan.sourceDeckName?.trim();
  const homeworkDeckName = homework.sourceDeckName?.trim();
  if (planDeckName && homeworkDeckName && planDeckName === homeworkDeckName) {
    return true;
  }

  if (homeworkSharesLessonContext(homework, plan)) {
    return true;
  }

  return false;
}

export function filterHomeworkForLessonPlan(
  homeworkItems: SavedHomeworkPickerItem[],
  plan: SavedLessonPlanPickerItem | null,
  lessonPlanId: number | null | undefined,
): SavedHomeworkPickerItem[] {
  if (lessonPlanId == null || !plan) {
    return [];
  }

  return homeworkItems.filter((item) => homeworkMatchesSavedLessonPlan(item, plan));
}
