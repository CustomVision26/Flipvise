import type { StudyGuideResult } from "@/lib/teacher-generators";
import {
  buildStudyGuidePdfDocument,
  studyGuidePdfSafeFileName,
  type StudyGuidePdfMeta,
} from "@/lib/study-guide-pdf-build";

export async function downloadStudyGuidePdf(
  guide: StudyGuideResult,
  meta: StudyGuidePdfMeta,
): Promise<void> {
  const doc = await buildStudyGuidePdfDocument(guide, meta);
  doc.save(`${studyGuidePdfSafeFileName(meta.topic)}_study_guide.pdf`);
}

export { studyGuidePdfSafeFileName };
