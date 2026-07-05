import type { LessonPlanResult } from "@/lib/teacher-generators";

export function lessonPlanPdfSafeFileName(title: string): string {
  return (
    title
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 80) || "lesson_plan"
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

export async function buildLessonPlanPdfDocument(plan: LessonPlanResult) {
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
  doc.text("Lesson Plan", margin, yRef.y);
  yRef.y += 24;

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);
  const titleWrapped = doc.splitTextToSize(plan.lessonTitle, contentW);
  doc.text(titleWrapped, margin, yRef.y);
  yRef.y += titleWrapped.length * 15 + 12;

  doc.setDrawColor(220);
  doc.line(margin, yRef.y, margin + contentW, yRef.y);
  yRef.y += 16;

  addSection(
    doc,
    margin,
    contentW,
    yRef,
    pageH,
    "Learning Objectives",
    plan.learningObjectives.map((item, i) => `${i + 1}. ${item}`),
  );
  addSection(
    doc,
    margin,
    contentW,
    yRef,
    pageH,
    "Materials Needed",
    plan.materialsNeeded.map((item) => `• ${item}`),
  );
  addSection(
    doc,
    margin,
    contentW,
    yRef,
    pageH,
    "Vocabulary",
    plan.vocabulary.map((item) => `• ${item}`),
  );
  addSection(
    doc,
    margin,
    contentW,
    yRef,
    pageH,
    "Lesson Timeline",
    plan.lessonTimeline.map((item) => `• ${item}`),
  );
  addSection(doc, margin, contentW, yRef, pageH, "Warm-Up Activity", [plan.warmUpActivity]);
  addSection(
    doc,
    margin,
    contentW,
    yRef,
    pageH,
    "Main Teaching Steps",
    plan.mainTeachingSteps.map((item, i) => `${i + 1}. ${item}`),
  );
  addSection(doc, margin, contentW, yRef, pageH, "Classroom Activity", [
    plan.classroomActivity,
  ]);
  addSection(
    doc,
    margin,
    contentW,
    yRef,
    pageH,
    "Assessment Questions",
    plan.assessmentQuestions.map((item, i) => `${i + 1}. ${item}`),
  );
  addSection(doc, margin, contentW, yRef, pageH, "Homework", [plan.homework]);
  addSection(
    doc,
    margin,
    contentW,
    yRef,
    pageH,
    "Differentiated Instruction",
    plan.differentiatedInstruction.map((item) => `• ${item}`),
  );
  addSection(doc, margin, contentW, yRef, pageH, "Teacher Notes", [plan.teacherNotes]);

  return doc;
}

export async function generateLessonPlanPdfBuffer(
  plan: LessonPlanResult,
): Promise<Buffer> {
  const doc = await buildLessonPlanPdfDocument(plan);
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
