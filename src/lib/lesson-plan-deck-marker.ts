/** Marker written into quiz deck descriptions when saving from a lesson plan. */
export function lessonPlanDeckDescriptionMarker(lessonPlanId: number): string {
  return `Lesson plan #${lessonPlanId}`;
}

export function parseLessonPlanIdFromDeckDescription(
  description: string | null | undefined,
): number | null {
  if (!description?.trim()) return null;
  const match = /Lesson plan #(\d+)/i.exec(description);
  if (!match?.[1]) return null;
  const id = Number.parseInt(match[1], 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}
