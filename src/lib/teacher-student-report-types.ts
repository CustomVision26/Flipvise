export type TeacherStudentReportFilters = {
  academicYear: string;
  termSemester: string;
  week: string;
  student: string;
};

export type TeacherStudentReportRecord = {
  key: string;
  studentLabel: string;
  classLabel: string | null;
  source: "Quiz" | "Assignment";
  title: string;
  result: string;
  term: string;
  year: string;
  period: string | null;
  savedAt: string;
  comment: string;
};

export type TeacherStudentReportStudentSummary = {
  studentLabel: string;
  classLabel: string | null;
};

export type TeacherStudentReportDocument = {
  title: string;
  generatedAt: string;
  filters: TeacherStudentReportFilters;
  introduction: string;
  records: TeacherStudentReportRecord[];
  studentSummaries: TeacherStudentReportStudentSummary[];
};

export function teacherStudentReportPdfSafeFileName(title: string): string {
  return (
    title
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 80) || "student_progress_report"
  );
}

export function buildDefaultReportTitle(filters: TeacherStudentReportFilters): string {
  const parts = ["Student Progress Report"];
  if (filters.academicYear.trim()) parts.push(filters.academicYear.trim());
  if (filters.termSemester.trim()) parts.push(filters.termSemester.trim());
  if (filters.week.trim()) parts.push(filters.week.trim());
  return parts.join(" — ");
}

/** Strip teacher-quiz deck metadata noise from report Title cells. */
export function cleanStudentReportRecordTitle(title: string): string {
  let cleaned = title.trim();
  if (!cleaned) return cleaned;

  // Manual grade quiz picker: "{class} Quiz — 29% (Jul 9, 2026)"
  cleaned = cleaned.replace(/\s—\s\d+(?:\.\d+)?%\s*\([^)]+\)\s*$/i, "");
  cleaned = cleaned.replace(/\sQuiz\s*$/i, "");
  // Class-scoped prefix already shown in the Class column, e.g. "Summer · week 1 — Math — Geometry"
  cleaned = cleaned.replace(/^[^·]+ · .+? — /, "");
  cleaned = cleaned.replace(/^[^:]+:\s*.+?-\s+—\s+/, "");

  cleaned = cleaned
    .replace(/\s*[·•]\s*Teacher quiz deck.*$/i, "")
    .replace(/\s*[·•]\s*Teacher lesson plan deck.*$/i, "")
    .replace(/\s*[·•]\s*Lesson plan #\d+.*$/i, "")
    .replace(/\s*[·•]\s*[\w\s/]+ difficulty.*$/i, "")
    .replace(/\bGrade Grade\b/g, "Grade");

  cleaned = cleaned.replace(
    /^(.+?\s[—–-]\s\S+?)\s+(?:Math|Geometry|Science|English|History|Biology|Chemistry|Physics)\b.*$/i,
    "$1",
  );

  return cleaned.trim() || title.trim();
}
