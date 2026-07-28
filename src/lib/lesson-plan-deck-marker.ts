/** Marker written into quiz deck descriptions when saving from a lesson plan. */
export function lessonPlanDeckDescriptionMarker(lessonPlanId: number): string {
  return `Lesson plan #${lessonPlanId}`;
}
