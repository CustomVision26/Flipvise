import type { PerCardSnapshot } from "@/db/schema";
import {
  parseCardFront,
  polishCardText,
  type ParsedPassageBody,
} from "@/lib/format-card-content";
import { questionTypeResultLabel, normalizeQuizText, type QuizQuestionType } from "@/lib/quiz-questions";

export type QuizAttemptSheetPdfData = {
  deckName: string;
  memberLabel?: string | null;
  memberEmail?: string | null;
  savedAt: Date | string;
  perCard: PerCardSnapshot[];
  /** MCQ options for the answer key PDF — correct (green) and false (red) distractors. */
  answerKeyOptionsByCardId?: Record<
    number,
    { correctOptions: string[]; falseOptions: string[] }
  >;
  /** @deprecated Use answerKeyOptionsByCardId */
  falseAnswersByCardId?: Record<number, string[]>;
};

type QuizAttemptSheetPdfMode = "question_sheet" | "answer_key";

type PdfTextBlock = {
  label?: string;
  text: string;
  bold?: boolean;
  indent?: boolean;
};

/** jsPDF Helvetica only renders reliably in Latin-1 / ASCII. */
export function sanitizePdfText(text: string): string {
  return polishCardText(
    text
      .replace(/\u00b0/g, " degrees")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/\u00b7/g, " - ")
      .replace(/[^\t\n\r\x20-\x7E]/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}

function formatDate(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function summarizeFormats(perCard: PerCardSnapshot[]): string {
  const counts = { multiple_choice: 0, true_false: 0, fill_in_blank: 0 };
  for (const card of perCard) {
    if (card.questionType) counts[card.questionType]++;
  }
  const parts: string[] = [];
  if (counts.multiple_choice > 0) parts.push(`${counts.multiple_choice} multiple choice`);
  if (counts.true_false > 0) parts.push(`${counts.true_false} true/false`);
  if (counts.fill_in_blank > 0) parts.push(`${counts.fill_in_blank} fill-in-the-blank`);
  return parts.length > 0 ? parts.join(", ") : "";
}

function passageBodyLines(passage: ParsedPassageBody): string[] {
  const lines: string[] = [];
  if (passage.intro) lines.push(passage.intro);
  for (const def of passage.definitions) {
    const definition = def.definition.replace(/\.\s*$/, "").trim();
    lines.push(`${def.term}: ${definition}.`);
  }
  lines.push(...passage.paragraphs);
  return lines.map(sanitizePdfText).filter(Boolean);
}

function buildPdfQuestionBlocks(
  card: PerCardSnapshot,
  mode: QuizAttemptSheetPdfMode,
): PdfTextBlock[] {
  const raw = card.question ?? "";
  const parsed = parseCardFront(raw);

  if (parsed.kind === "reading-passage") {
    if (mode === "question_sheet") {
      const blocks: PdfTextBlock[] = [{ label: "Passage", text: "", bold: true }];
      for (const line of passageBodyLines(parsed.passage)) {
        blocks.push({ text: line, indent: true });
      }
      blocks.push({
        label: "Question",
        text: sanitizePdfText(parsed.question),
        bold: true,
        indent: true,
      });
      return blocks;
    }

    return [{ text: sanitizePdfText(parsed.question) }];
  }

  const text = sanitizePdfText(parsed.kind === "plain" ? parsed.text : raw);
  return text ? [{ text }] : [{ text: "(no question text)" }];
}

export function quizAttemptSheetPdfSafeFileName(
  title: string,
  variant: QuizAttemptSheetPdfMode,
): string {
  const base = title
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 80);
  return variant === "question_sheet"
    ? `${base || "quiz"}_question_sheet`
    : `${base || "quiz"}_answer_key`;
}

export async function generateQuizAttemptSheetPdfBuffer(
  data: QuizAttemptSheetPdfData,
  mode: QuizAttemptSheetPdfMode,
): Promise<Buffer> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 45;
  const contentW = pageW - margin * 2;
  let y = margin;

  function checkPage(needed: number) {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  }

  function writeWrapped(text: string, x: number, maxWidth: number, lineHeight: number) {
    const lines = doc.splitTextToSize(text, maxWidth);
    checkPage(lines.length * lineHeight + 4);
    doc.text(lines, x, y);
    y += lines.length * lineHeight + 4;
  }

  function writeBlock(block: PdfTextBlock) {
    const x = margin + (block.indent ? 14 : 0);
    const width = contentW - (block.indent ? 14 : 0);

    if (block.label) {
      doc.setFontSize(9);
      doc.setFont("helvetica", block.bold ? "bold" : "normal");
      doc.setTextColor(block.bold ? 30 : 100);
      writeWrapped(block.label, x, width, 12);
    }

    if (block.text) {
      doc.setFontSize(10);
      doc.setFont("helvetica", block.bold ? "bold" : "normal");
      doc.setTextColor(20);
      writeWrapped(block.text, x, width, 13);
    }
  }

  doc.setFontSize(mode === "question_sheet" ? 18 : 16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20);
  doc.text(mode === "question_sheet" ? "Quiz Question Sheet" : "Quiz Answer Key", margin, y);
  y += 22;

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);
  doc.text(sanitizePdfText(data.deckName), margin, y);
  y += 16;

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(formatDate(data.savedAt), margin, y);
  y += 14;

  const infoLines: string[] = [];
  if (data.memberLabel || data.memberEmail) {
    infoLines.push(
      `Based on attempt by: ${[data.memberLabel, data.memberEmail].filter(Boolean).join(" - ")}`,
    );
  }
  const formatSummary = summarizeFormats(data.perCard);
  if (formatSummary) {
    infoLines.push(`Formats: ${formatSummary}`);
  }
  infoLines.push(`${data.perCard.length} question${data.perCard.length === 1 ? "" : "s"}`);

  if (infoLines.length > 0) {
    doc.setFillColor(245, 245, 248);
    const blockH = infoLines.length * 14 + 12;
    doc.roundedRect(margin, y, contentW, blockH, 3, 3, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50);
    infoLines.forEach((line, i) => {
      doc.text(sanitizePdfText(line), margin + 10, y + 10 + i * 14);
    });
    y += blockH + 14;
  }

  doc.setDrawColor(220);
  doc.line(margin, y, margin + contentW, y);
  y += 16;

  data.perCard.forEach((card, idx) => {
    checkPage(70);

    const formatSuffix = card.questionType
      ? ` (${questionTypeResultLabel(card.questionType as QuizQuestionType)})`
      : "";

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20);
    writeWrapped(`Q${idx + 1}${formatSuffix}`, margin, contentW, 13);

    for (const block of buildPdfQuestionBlocks(card, mode)) {
      writeBlock(block);
    }

    if (mode === "question_sheet") {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);

      if (card.questionType === "true_false") {
        checkPage(24);
        doc.text("( ) True       ( ) False", margin + 14, y);
        y += 20;
      } else if (card.questionType === "multiple_choice") {
        checkPage(56);
        doc.text("Answer:", margin + 14, y);
        y += 14;
        doc.setDrawColor(210);
        for (let i = 0; i < 2; i++) {
          doc.line(margin + 14, y, margin + contentW * 0.85, y);
          y += 18;
        }
      } else {
        checkPage(56);
        doc.text("Answer:", margin + 14, y);
        y += 14;
        doc.setDrawColor(210);
        for (let i = 0; i < 2; i++) {
          doc.line(margin + 14, y, margin + contentW * 0.85, y);
          y += 18;
        }
      }
    } else {
      const answer = sanitizePdfText(card.correctAnswer || "Not available");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(16, 130, 80);
      writeWrapped(`Ans: ${answer}`, margin + 14, contentW - 20, 12);

      const breakdown =
        data.answerKeyOptionsByCardId?.[card.cardId] ??
        (data.falseAnswersByCardId?.[card.cardId]
          ? { correctOptions: [] as string[], falseOptions: data.falseAnswersByCardId[card.cardId]! }
          : { correctOptions: [], falseOptions: [] });

      const ansNorm = normalizeQuizText(card.correctAnswer || "");

      breakdown.correctOptions.forEach((correctOption, correctIdx) => {
        const text = sanitizePdfText(correctOption);
        if (!text) return;
        if (
          card.questionType !== "true_false" &&
          normalizeQuizText(text) === ansNorm
        ) {
          return;
        }
        doc.setFont("helvetica", "bold");
        doc.setTextColor(16, 130, 80);
        writeWrapped(
          `Correct ans ${correctIdx + 1}: ${text}`,
          margin + 14,
          contentW - 20,
          12,
        );
      });

      breakdown.falseOptions.forEach((falseAnswer, falseIdx) => {
        const text = sanitizePdfText(falseAnswer);
        if (!text) return;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(140, 60, 60);
        writeWrapped(
          `False ans ${falseIdx + 1}: ${text}`,
          margin + 14,
          contentW - 20,
          12,
        );
      });
    }

    y += 12;
  });

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(170);
    doc.text(
      `Flipvise - ${mode === "question_sheet" ? "Quiz Question Sheet" : "Quiz Answer Key"} | Page ${p} of ${pageCount}`,
      pageW / 2,
      pageH - 22,
      { align: "center" },
    );
  }

  return Buffer.from(doc.output("arraybuffer"));
}
