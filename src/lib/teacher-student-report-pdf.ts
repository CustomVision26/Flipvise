import { buildTeacherStudentReportPdfDocument } from "@/lib/teacher-student-report-pdf-build";
import {
  teacherStudentReportPdfSafeFileName,
  type TeacherStudentReportDocument,
} from "@/lib/teacher-student-report-types";

export async function downloadTeacherStudentReportPdf(
  report: TeacherStudentReportDocument,
): Promise<void> {
  const doc = await buildTeacherStudentReportPdfDocument(report);
  doc.save(`${teacherStudentReportPdfSafeFileName(report.title)}.pdf`);
}

export async function saveTeacherStudentReportPdf(
  report: TeacherStudentReportDocument,
): Promise<void> {
  await downloadTeacherStudentReportPdf(report);
}

export { teacherStudentReportPdfSafeFileName };
