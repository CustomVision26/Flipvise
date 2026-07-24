import type { LessonPlanResult } from "@/lib/teacher-generators";
import type { LessonPlanDayVocabularyDetail } from "@/lib/lesson-plan-ai-schema";
import { formatUnitPacingLabel } from "@/lib/lesson-plan-weekly-schedule";

export type LessonPlanPdfUnitContext = {
  planPeriodDays: number;
  lessonDuration: string;
};

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

export function vocabularyDetailPdfLines(
  detail: LessonPlanDayVocabularyDetail,
): string[] {
  const lines: string[] = [detail.contextIntro, "", "Vocabulary:"];

  for (const term of detail.terms) {
    lines.push(`• ${term.term} — ${term.definition}`);
    if (term.example) {
      lines.push(`  Example: ${term.example}`);
    }
  }

  if (detail.fiveEBreakdown) {
    lines.push("", detail.fiveEBreakdown.heading);
    if (detail.fiveEBreakdown.intro) {
      lines.push(detail.fiveEBreakdown.intro);
    }
    for (const phase of detail.fiveEBreakdown.phases) {
      lines.push(
        "",
        `${phase.timeRange}: ${phase.phase} — ${phase.activitySummary}`,
        phase.detail,
      );
      if (phase.vocabularyFocus.length > 0) {
        lines.push(`Vocabulary focus: ${phase.vocabularyFocus.join(", ")}`);
      }
      for (const move of phase.teacherMoves) {
        lines.push(`  Teacher: ${move}`);
      }
      for (const move of phase.studentMoves) {
        lines.push(`  Students: ${move}`);
      }
    }
  }

  if (detail.mainConcept) {
    lines.push("", detail.mainConcept.heading, detail.mainConcept.body);
  }

  if (detail.process) {
    lines.push("", detail.process.heading);
    for (const step of detail.process.steps) {
      lines.push(`${step.stepNumber}. ${step.title}`);
      for (const bullet of step.bullets) {
        lines.push(`   • ${bullet}`);
      }
    }
  }

  if (detail.learningGoal) {
    lines.push("", detail.learningGoal.heading);
    if (detail.learningGoal.intro) {
      lines.push(detail.learningGoal.intro);
    }
    for (const objective of detail.learningGoal.objectives) {
      lines.push(`• ${objective}`);
    }
  }

  if (detail.additionalVocabulary?.length) {
    const pepAligned = /pep/i.test(detail.contextIntro);
    lines.push(
      "",
      pepAligned ? "Vocabulary (PEP-Aligned):" : "Additional Vocabulary:",
    );
    for (const term of detail.additionalVocabulary) {
      lines.push(`• ${term.term} — ${term.definition}`);
      if (term.example) {
        lines.push(`  Example: ${term.example}`);
      }
    }
  }

  return lines;
}

export async function buildLessonPlanPdfDocument(
  plan: LessonPlanResult,
  unitContext?: LessonPlanPdfUnitContext,
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
  doc.text("Lesson Plan", margin, yRef.y);
  yRef.y += 24;

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);
  const titleWrapped = doc.splitTextToSize(plan.lessonTitle, contentW);
  doc.text(titleWrapped, margin, yRef.y);
  yRef.y += titleWrapped.length * 15 + 8;

  const unitLabel =
    unitContext && unitContext.planPeriodDays > 1
      ? formatUnitPacingLabel(unitContext.planPeriodDays, unitContext.lessonDuration)
      : null;
  if (unitLabel) {
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(unitLabel, margin, yRef.y);
    yRef.y += 14;
  }

  doc.setFontSize(12);
  doc.setTextColor(40);
  yRef.y += 4;

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

  if (plan.weeklySchedule?.length) {
    for (const day of plan.weeklySchedule) {
      addSection(doc, margin, contentW, yRef, pageH, day.dayLabel, [
        day.dailyFocus,
        "",
        "Vocabulary:",
        ...day.vocabulary.map((item) => `• ${item}`),
        "",
        "Class timeline:",
        ...day.lessonTimeline.map((item) => `• ${item}`),
      ]);

      if (day.vocabularyDetail) {
        addSection(
          doc,
          margin,
          contentW,
          yRef,
          pageH,
          `${day.dayLabel} — Vocabulary detail`,
          vocabularyDetailPdfLines(day.vocabularyDetail),
        );
      }
    }
    addSection(
      doc,
      margin,
      contentW,
      yRef,
      pageH,
      "Vocabulary (full unit)",
      plan.vocabulary.map((item) => `• ${item}`),
    );
    addSection(
      doc,
      margin,
      contentW,
      yRef,
      pageH,
      "Unit Pacing Overview",
      plan.lessonTimeline.map((item) => `• ${item}`),
    );
  } else {
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
  }
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

export function lessonPlanHasVocabularyDetails(plan: LessonPlanResult): boolean {
  return (plan.weeklySchedule ?? []).some((day) => day.vocabularyDetail != null);
}

export function lessonPlanVocabularyDetailPdfSafeFileName(title: string): string {
  return `${lessonPlanPdfSafeFileName(title)}_vocabulary_detail`;
}

export async function buildLessonPlanVocabularyDetailPdfDocument(
  plan: LessonPlanResult,
  unitContext?: LessonPlanPdfUnitContext,
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
  doc.text("Vocabulary Detail", margin, yRef.y);
  yRef.y += 24;

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);
  const titleWrapped = doc.splitTextToSize(plan.lessonTitle, contentW);
  doc.text(titleWrapped, margin, yRef.y);
  yRef.y += titleWrapped.length * 15 + 8;

  const unitLabel =
    unitContext && unitContext.planPeriodDays > 1
      ? formatUnitPacingLabel(unitContext.planPeriodDays, unitContext.lessonDuration)
      : null;
  if (unitLabel) {
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(unitLabel, margin, yRef.y);
    yRef.y += 14;
  }

  doc.setDrawColor(220);
  doc.line(margin, yRef.y, margin + contentW, yRef.y);
  yRef.y += 16;

  const daysWithDetail =
    plan.weeklySchedule?.filter((day) => day.vocabularyDetail != null) ?? [];

  for (const day of daysWithDetail) {
    addSection(
      doc,
      margin,
      contentW,
      yRef,
      pageH,
      `${day.dayLabel} — Vocabulary detail`,
      [day.dailyFocus, "", ...vocabularyDetailPdfLines(day.vocabularyDetail!)],
    );
  }

  return doc;
}

export async function generateLessonPlanVocabularyDetailPdfBuffer(
  plan: LessonPlanResult,
  unitContext?: LessonPlanPdfUnitContext,
): Promise<Buffer | null> {
  if (!lessonPlanHasVocabularyDetails(plan)) {
    return null;
  }
  const doc = await buildLessonPlanVocabularyDetailPdfDocument(plan, unitContext);
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

export async function generateLessonPlanPdfBuffer(
  plan: LessonPlanResult,
  unitContext?: LessonPlanPdfUnitContext,
): Promise<Buffer> {
  const doc = await buildLessonPlanPdfDocument(plan, unitContext);
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
