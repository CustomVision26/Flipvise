import type { HomeworkResult } from "@/lib/teacher-homework-ai-schema";
import {
  buildHomeworkPdfDocument,
  homeworkPdfSafeFileName,
} from "@/lib/homework-pdf-build";

export async function downloadHomeworkPdf(homework: HomeworkResult): Promise<void> {
  const doc = await buildHomeworkPdfDocument(homework);
  doc.save(`${homeworkPdfSafeFileName(homework.assignmentTitle)}.pdf`);
}

export { homeworkPdfSafeFileName };
