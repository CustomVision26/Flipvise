import type { LessonPlanResult } from "@/lib/teacher-generators";
import {
  buildLessonPlanPdfDocument,
  buildLessonPlanVocabularyDetailPdfDocument,
  lessonPlanHasVocabularyDetails,
  lessonPlanPdfSafeFileName,
  lessonPlanVocabularyDetailPdfSafeFileName,
  type LessonPlanPdfUnitContext,
} from "@/lib/lesson-plan-pdf-build";

export async function downloadLessonPlanPdf(
  plan: LessonPlanResult,
  unitContext?: LessonPlanPdfUnitContext,
): Promise<void> {
  const doc = await buildLessonPlanPdfDocument(plan, unitContext);
  doc.save(`${lessonPlanPdfSafeFileName(plan.lessonTitle)}.pdf`);
}

export async function downloadLessonPlanVocabularyDetailPdf(
  plan: LessonPlanResult,
  unitContext?: LessonPlanPdfUnitContext,
): Promise<void> {
  if (!lessonPlanHasVocabularyDetails(plan)) {
    throw new Error(
      "Generate expanded vocabulary for at least one day before downloading the vocabulary detail PDF.",
    );
  }
  const doc = await buildLessonPlanVocabularyDetailPdfDocument(plan, unitContext);
  doc.save(`${lessonPlanVocabularyDetailPdfSafeFileName(plan.lessonTitle)}.pdf`);
}

export {
  lessonPlanHasVocabularyDetails,
  lessonPlanVocabularyDetailPdfSafeFileName,
};
