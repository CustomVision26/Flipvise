import type { StudyGuideResult } from "@/lib/teacher-generators";

export type StudyGuidePdfMeta = {
  subject: string;
  gradeLevel: string;
  topic: string;
};

export function studyGuidePdfSafeFileName(topic: string): string {
  return (
    topic
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 80) || "study_guide"
  );
}

function addSection(
  doc: import("jspdf").jsPDF,
  margin: number,
  contentW: number,
  yRef: { y: number },
  pageH: number,
  title: string,
  lines: string[],
) {
  function checkPage(needed: number) {
    if (yRef.y + needed > pageH - margin) {
      doc.addPage();
      yRef.y = margin;
    }
  }

  checkPage(24);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30);
  doc.text(title, margin, yRef.y);
  yRef.y += 16;

  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(50);

  for (const line of lines) {
    const wrapped = doc.splitTextToSize(line, contentW);
    checkPage(wrapped.length * 13 + 4);
    doc.text(wrapped, margin, yRef.y);
    yRef.y += wrapped.length * 13 + 4;
  }

  yRef.y += 6;
}

export async function buildStudyGuidePdfDocument(
  guide: StudyGuideResult,
  meta: StudyGuidePdfMeta,
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 45;
  const contentW = pageW - margin * 2;
  const yRef = { y: margin };

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20);
  doc.text("Study Guide", margin, yRef.y);
  yRef.y += 24;

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);
  const titleWrapped = doc.splitTextToSize(`${meta.topic} — ${meta.subject}`, contentW);
  doc.text(titleWrapped, margin, yRef.y);
  yRef.y += titleWrapped.length * 15 + 8;

  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(`Grade level: ${meta.gradeLevel}`, margin, yRef.y);
  yRef.y += 16;

  doc.setDrawColor(220);
  doc.line(margin, yRef.y, margin + contentW, yRef.y);
  yRef.y += 16;

  addSection(doc, margin, contentW, yRef, pageH, "Summary", [guide.summary]);
  addSection(doc, margin, contentW, yRef, pageH, "Key Vocabulary", guide.keyVocabulary);
  addSection(doc, margin, contentW, yRef, pageH, "Important Points", guide.importantPoints);
  addSection(doc, margin, contentW, yRef, pageH, "Worked Examples", guide.workedExamples);
  addSection(doc, margin, contentW, yRef, pageH, "Sample Problems", guide.sampleProblems);
  addSection(doc, margin, contentW, yRef, pageH, "Practice Questions", guide.practiceQuestions);
  addSection(doc, margin, contentW, yRef, pageH, "Study Tips", guide.studyTips);

  return doc;
}

export async function generateStudyGuidePdfBuffer(
  guide: StudyGuideResult,
  meta: StudyGuidePdfMeta,
): Promise<Buffer> {
  const doc = await buildStudyGuidePdfDocument(guide, meta);
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
