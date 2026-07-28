import type { HomeworkResult } from "@/lib/teacher-homework-ai-schema";
import { getHomeworkPassageSections } from "@/lib/homework-list-items";
import {
  drawHomeworkAnswerGraphOnPdf,
  isRenderableHomeworkAnswerGraph,
} from "@/lib/homework-answer-graph";

export function homeworkPdfSafeFileName(title: string): string {
  return (
    title
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 80) || "homework"
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

export async function buildHomeworkPdfDocument(
  homework: HomeworkResult,
  options?: { includeAnswerKey?: boolean },
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const includeAnswerKey = options?.includeAnswerKey ?? true;

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 45;
  const contentW = pageW - margin * 2;
  const yRef = { y: margin };

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20);
  doc.text("Homework Assignment", margin, yRef.y);
  yRef.y += 24;

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);
  const titleWrapped = doc.splitTextToSize(homework.assignmentTitle, contentW);
  doc.text(titleWrapped, margin, yRef.y);
  yRef.y += titleWrapped.length * 15 + 12;

  doc.setDrawColor(220);
  doc.line(margin, yRef.y, margin + contentW, yRef.y);
  yRef.y += 16;

  addSection(doc, margin, contentW, yRef, pageH, "Instructions", [homework.instructions]);

  const sections = getHomeworkPassageSections(homework);
  const hasPassageBodies = sections.some((section) => section.body.trim());

  if (hasPassageBodies) {
    for (const [index, section] of sections.entries()) {
      if (section.body.trim()) {
        const passageHeading = section.title?.trim()
          ? `Reading Passage — ${section.title.trim()}`
          : sections.filter((item) => item.body.trim()).length > 1
            ? `Reading Passage ${index + 1}`
            : "Reading Passage";
        addSection(doc, margin, contentW, yRef, pageH, passageHeading, [section.body]);
      }
      if (section.questions.length > 0) {
        addSection(
          doc,
          margin,
          contentW,
          yRef,
          pageH,
          section.body.trim() ? "Questions" : "Questions (continued)",
          section.questions.map(
            (question, qIndex) =>
              `${section.questionNumbers[qIndex]}. ${question}`,
          ),
        );
      }
    }
  } else {
    addSection(
      doc,
      margin,
      contentW,
      yRef,
      pageH,
      "Questions",
      homework.questions.map((question, index) => `${index + 1}. ${question}`),
    );
  }

  if (includeAnswerKey) {
    doc.addPage();
    yRef.y = margin;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20);
    doc.text("Answer Key", margin, yRef.y);
    yRef.y += 20;

    for (let index = 0; index < homework.answerKey.length; index++) {
      const answer = homework.answerKey[index]!;
      addSection(doc, margin, contentW, yRef, pageH, `Answer ${index + 1}`, [
        answer,
      ]);
      const graph = homework.answerGraphs?.[index];
      if (graph && isRenderableHomeworkAnswerGraph(graph)) {
        drawHomeworkAnswerGraphOnPdf(doc, graph, margin, contentW, yRef, pageH);
      }
    }
  }

  return doc;
}

export async function generateHomeworkPdfBuffer(
  homework: HomeworkResult,
  options?: { includeAnswerKey?: boolean },
): Promise<Buffer> {
  const doc = await buildHomeworkPdfDocument(homework, options);
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
