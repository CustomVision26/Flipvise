import type { TeacherStudentReportDocument } from "@/lib/teacher-student-report-types";

function filterLine(label: string, value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? `${label}: ${trimmed}` : null;
}

function addWrappedText(
  doc: import("jspdf").jsPDF,
  text: string,
  x: number,
  yRef: { y: number },
  maxWidth: number,
  pageH: number,
  margin: number,
  lineHeight = 13,
) {
  const wrapped = doc.splitTextToSize(text, maxWidth);
  for (const line of wrapped) {
    if (yRef.y + lineHeight > pageH - margin) {
      doc.addPage();
      yRef.y = margin;
    }
    doc.text(line, x, yRef.y);
    yRef.y += lineHeight;
  }
}

export async function buildTeacherStudentReportPdfDocument(
  report: TeacherStudentReportDocument,
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentW = pageW - margin * 2;
  const yRef = { y: margin };

  function ensureSpace(needed: number) {
    if (yRef.y + needed > pageH - margin) {
      doc.addPage();
      yRef.y = margin;
    }
  }

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20);
  doc.text(report.title, margin, yRef.y);
  yRef.y += 22;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90);
  doc.text(`Generated: ${report.generatedAt}`, margin, yRef.y);
  yRef.y += 16;

  const filterLines = [
    filterLine("Academic year", report.filters.academicYear),
    filterLine("Term / semester", report.filters.termSemester),
    filterLine("Week", report.filters.week),
    filterLine("Student", report.filters.student),
  ].filter((line): line is string => line != null);

  if (filterLines.length > 0) {
    ensureSpace(20);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40);
    doc.text("Report filters", margin, yRef.y);
    yRef.y += 14;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(60);
    for (const line of filterLines) {
      addWrappedText(doc, line, margin, yRef, contentW, pageH, margin, 12);
    }
    yRef.y += 4;
  }

  ensureSpace(24);
  doc.setDrawColor(220);
  doc.line(margin, yRef.y, margin + contentW, yRef.y);
  yRef.y += 14;

  const quizCount = report.records.filter((row) => row.source === "Quiz").length;
  const assignmentCount = report.records.filter((row) => row.source === "Assignment").length;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40);
  doc.text("Summary", margin, yRef.y);
  yRef.y += 14;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(60);
  const summaryLines = [
    `Total records: ${report.records.length}`,
    `Quiz results: ${quizCount}`,
    `Manual grades: ${assignmentCount}`,
    `Students: ${report.studentSummaries.length}`,
  ];
  for (const line of summaryLines) {
    addWrappedText(doc, line, margin, yRef, contentW, pageH, margin, 12);
  }
  yRef.y += 6;

  if (report.studentSummaries.length > 0) {
    ensureSpace(24);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40);
    doc.text("Students and classes", margin, yRef.y);
    yRef.y += 14;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(60);
    for (const summary of report.studentSummaries) {
      const line = `${summary.studentLabel} — ${summary.classLabel ?? "No class assigned"}`;
      addWrappedText(doc, line, margin, yRef, contentW, pageH, margin, 12);
    }
    yRef.y += 6;
  }

  if (report.introduction.trim()) {
    ensureSpace(24);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40);
    doc.text("Notes", margin, yRef.y);
    yRef.y += 14;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(60);
    addWrappedText(doc, report.introduction.trim(), margin, yRef, contentW, pageH, margin, 12);
    yRef.y += 8;
  }

  ensureSpace(30);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40);
  doc.text("Records", margin, yRef.y);
  yRef.y += 16;

  const columns = [
    { label: "Student", width: 90 },
    { label: "Class", width: 120 },
    { label: "Source", width: 52 },
    { label: "Title", width: 150 },
    { label: "Result", width: 52 },
    { label: "Term", width: 80 },
    { label: "Year", width: 58 },
    { label: "Recorded", width: 78 },
  ];

  const tableX = margin;
  ensureSpace(18);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(70);

  let x = tableX;
  for (const column of columns) {
    doc.text(column.label, x, yRef.y);
    x += column.width;
  }
  yRef.y += 12;

  doc.setDrawColor(210);
  doc.line(tableX, yRef.y, tableX + contentW, yRef.y);
  yRef.y += 10;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(50);

  for (const record of report.records) {
    const termLabel = record.period ? `${record.term} · ${record.period}` : record.term;
    const rowValues = [
      record.studentLabel,
      record.classLabel ?? "—",
      record.source,
      record.title,
      record.result,
      termLabel,
      record.year,
      record.savedAt,
    ];

    const wrappedCells = rowValues.map((value, index) =>
      doc.splitTextToSize(value, columns[index].width - 4),
    );
    const rowHeight = Math.max(...wrappedCells.map((lines) => lines.length)) * 11 + 6;

    ensureSpace(rowHeight + 4);

    x = tableX;
    for (let i = 0; i < wrappedCells.length; i += 1) {
      doc.text(wrappedCells[i], x, yRef.y);
      x += columns[i].width;
    }
    yRef.y += rowHeight;

    if (record.comment.trim()) {
      ensureSpace(14);
      doc.setFontSize(7.5);
      doc.setTextColor(90);
      addWrappedText(
        doc,
        `Comment: ${record.comment.trim()}`,
        tableX + 8,
        yRef,
        contentW - 16,
        pageH,
        margin,
        10,
      );
      doc.setFontSize(8);
      doc.setTextColor(50);
      yRef.y += 4;
    }
  }

  return doc;
}
