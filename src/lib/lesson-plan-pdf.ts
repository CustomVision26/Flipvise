import type { LessonPlanResult } from "@/lib/teacher-generators";
import {
  buildLessonPlanPdfDocument,
  lessonPlanPdfSafeFileName,
} from "@/lib/lesson-plan-pdf-build";

export async function downloadLessonPlanPdf(plan: LessonPlanResult): Promise<void> {
  const doc = await buildLessonPlanPdfDocument(plan);
  doc.save(`${lessonPlanPdfSafeFileName(plan.lessonTitle)}.pdf`);
}
