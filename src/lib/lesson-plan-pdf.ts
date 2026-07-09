import type { LessonPlanResult } from "@/lib/teacher-generators";
import {
  buildLessonPlanPdfDocument,
  lessonPlanPdfSafeFileName,
  type LessonPlanPdfUnitContext,
} from "@/lib/lesson-plan-pdf-build";

export async function downloadLessonPlanPdf(
  plan: LessonPlanResult,
  unitContext?: LessonPlanPdfUnitContext,
): Promise<void> {
  const doc = await buildLessonPlanPdfDocument(plan, unitContext);
  doc.save(`${lessonPlanPdfSafeFileName(plan.lessonTitle)}.pdf`);
}
