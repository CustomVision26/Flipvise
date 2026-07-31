import type {
  EssayFeedbackResult,
  EssayGenerationResult,
} from "@/lib/essay-ai-schema";
import {
  formatEssayOutlineDisplay,
  type ModelEssayRoleBadge,
  type ModelEssaySegment,
} from "@/lib/essay-result-normalize";
import {
  defaultDocumentStudioMeta,
  marginInches,
  normalizeDocumentStudioMeta,
  type DocumentStudioMeta,
} from "@/lib/document-generation-studio";
import { buildCitedModelEssayView } from "@/lib/essay-model-citation-demo";
import {
  collectContinuousWrittenEssayParagraphs,
  resolveApaStudentTitlePageLines,
  resolveEssayReferencesForPaper,
} from "@/lib/essay-apa-student-paper";

export type EssayPromptPdfInput = {
  title: string;
  prompt: string;
  result: EssayGenerationResult;
  wordCountTarget?: number;
  /** Include model essay only when the user can already view it. */
  includeModelEssay?: boolean;
  /** Student draft text keyed by section id (shown after the outline). */
  writtenSections?: Record<string, string> | null;
  /** Latest AI feedback for this essay (included after the written essay). */
  feedback?: EssayFeedbackResult | null;
  /** Document Studio formatting / citation metadata (optional for legacy essays). */
  documentStudio?: DocumentStudioMeta | null;
  /**
   * `writtenOnly` — title page + formatted written essay + references only
   * (no prompt/instructions/outline). Used by Citation & Formatting preview.
   */
  pdfMode?: "full" | "writtenOnly";
  /** APA student title-page fields (filled from profile / essay metadata). */
  studentName?: string | null;
  institutionName?: string | null;
  courseName?: string | null;
  instructorName?: string | null;
  assignmentDate?: string | null;
};

function resolveStudio(input: EssayPromptPdfInput): DocumentStudioMeta {
  return normalizeDocumentStudioMeta(
    input.documentStudio ?? defaultDocumentStudioMeta(),
  );
}

function pdfFontFamily(font: string): "helvetica" | "times" {
  if (font === "Times New Roman" || font === "Georgia") return "times";
  return "helvetica";
}

export function essayPromptPdfSafeFileName(title: string): string {
  return (
    title
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 80) || "essay_prompt"
  );
}

function checkPdfPage(
  doc: import("jspdf").jsPDF,
  yRef: { y: number },
  pageH: number,
  margin: number,
  needed: number,
) {
  if (yRef.y + needed > pageH - margin) {
    doc.addPage();
    yRef.y = margin;
  }
}

/** Start a new page only when the current page already has content (avoids blank pages). */
function ensureNewPage(
  doc: import("jspdf").jsPDF,
  yRef: { y: number },
  margin: number,
) {
  if (yRef.y <= margin + 1) return;
  doc.addPage();
  yRef.y = margin;
}

function addSection(
  doc: import("jspdf").jsPDF,
  margin: number,
  contentW: number,
  yRef: { y: number },
  pageH: number,
  title: string,
  lines: string[],
  opts?: {
    fontFamily?: "helvetica" | "times";
    bodySize?: number;
    lineHeight?: number;
    /** Tighter spacing between heading and body / after the block. */
    compact?: boolean;
  },
) {
  if (lines.length === 0) return;
  const fontFamily = opts?.fontFamily ?? "helvetica";
  const bodySize = opts?.bodySize ?? 9.5;
  const compact = opts?.compact === true;
  const metrics = compact
    ? formalBodyMetrics(bodySize, opts?.lineHeight ?? 13)
    : {
        lineHeight: opts?.lineHeight ?? 13,
        paraGap: 4,
        blockGap: 6,
      };
  const lineHeight = metrics.lineHeight;
  const titleGap = compact ? 11 : 16;
  const lineGap = compact ? 1 : 4;
  const afterGap = compact ? 6 : 10;

  checkPdfPage(doc, yRef, pageH, margin, 20);
  doc.setFontSize(compact ? Math.max(10, bodySize) : Math.max(11, bodySize));
  doc.setFont(fontFamily, "bold");
  doc.setTextColor(25);
  doc.text(title, margin, yRef.y);
  yRef.y += titleGap;

  doc.setFontSize(bodySize);
  doc.setFont(fontFamily, "normal");
  doc.setTextColor(45);

  for (const line of lines) {
    const wrapped = doc.splitTextToSize(line, contentW);
    checkPdfPage(doc, yRef, pageH, margin, wrapped.length * lineHeight + lineGap);
    doc.text(wrapped, margin, yRef.y);
    yRef.y += wrapped.length * lineHeight + lineGap;
  }

  yRef.y += afterGap;
}

/**
 * Dark pill badge used for Introduction / Supporting / Conclusion labels.
 * `align: "right"` places the badge against the right content edge.
 */
function drawRoleBadge(
  doc: import("jspdf").jsPDF,
  label: string,
  opts: {
    margin: number;
    contentW: number;
    y: number;
    align?: "left" | "right";
  },
): { width: number; height: number } {
  const text = label.toUpperCase();
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  const labelW = doc.getTextWidth(text) + 10;
  const labelH = 12;
  const x =
    opts.align === "right"
      ? opts.margin + opts.contentW - labelW
      : opts.margin;
  doc.setFillColor(55, 65, 80);
  doc.roundedRect(x, opts.y - 9, labelW, labelH, 3, 3, "F");
  doc.setTextColor(255);
  doc.text(text, x + 5, opts.y);
  return { width: labelW, height: labelH };
}

function formalBodyMetrics(bodySize: number, lineHeight: number) {
  // Prefer neat single-ish spacing for instructional essay pages even when
  // the studio profile uses double spacing for APA drafts.
  const lh = Math.min(lineHeight, Math.max(12, Math.round(bodySize * 1.25)));
  return {
    lineHeight: lh,
    paraGap: Math.max(3, Math.round(lh * 0.28)),
    blockGap: Math.max(6, Math.round(lh * 0.45)),
  };
}

/**
 * Model essay on one dedicated page — compact, formal section flow.
 */
function addModelEssaySection(
  doc: import("jspdf").jsPDF,
  margin: number,
  contentW: number,
  yRef: { y: number },
  pageH: number,
  segments: ModelEssaySegment[],
  fallback: string,
  opts?: { bodySize?: number; lineHeight?: number },
) {
  ensureNewPage(doc, yRef, margin);
  const bodySize = opts?.bodySize ?? 9.5;
  const { lineHeight, paraGap, blockGap } = formalBodyMetrics(
    bodySize,
    opts?.lineHeight ?? 13,
  );

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20);
  doc.text("Model essay", margin, yRef.y);
  yRef.y += lineHeight + 4;

  const parts =
    segments.length > 0
      ? segments
      : [{ badge: "Introduction" as const, text: fallback }];

  parts.forEach((segment) => {
    checkPdfPage(doc, yRef, pageH, margin, 40);
    drawRoleBadge(doc, segment.badge, {
      margin,
      contentW,
      y: yRef.y,
      align: "left",
    });
    yRef.y += 12;

    if (
      segment.title &&
      segment.title.toLowerCase() !== segment.badge.toLowerCase()
    ) {
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      const titleLines = doc.splitTextToSize(segment.title, contentW);
      checkPdfPage(doc, yRef, pageH, margin, titleLines.length * 10 + 2);
      doc.text(titleLines, margin, yRef.y);
      yRef.y += titleLines.length * 10 + 2;
    }

    doc.setFontSize(bodySize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40);
    const wrapped = doc.splitTextToSize(segment.text, contentW);
    checkPdfPage(doc, yRef, pageH, margin, wrapped.length * lineHeight + 4);
    doc.text(wrapped, margin, yRef.y);
    yRef.y += wrapped.length * lineHeight + paraGap;

    if (segment.guidance?.trim()) {
      const tip = segment.guidance
        .replace(/^Construction tip\s*[—–-]\s*[^:]+:\s*/i, "")
        .trim();
      checkPdfPage(doc, yRef, pageH, margin, 28);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(50);
      doc.text("Construction tip", margin, yRef.y);
      yRef.y += 10;
      doc.setFont("helvetica", "italic");
      doc.setTextColor(90);
      const tipLines = doc.splitTextToSize(tip, contentW);
      checkPdfPage(doc, yRef, pageH, margin, tipLines.length * 10 + 2);
      doc.text(tipLines, margin, yRef.y);
      yRef.y += tipLines.length * 10 + blockGap;
    } else {
      yRef.y += blockGap;
    }
  });
}

function roleBadgeForWrittenSection(
  type: string,
  title: string,
  index: number,
  total: number,
): ModelEssayRoleBadge {
  const key = `${type} ${title}`.toLowerCase();
  if (key.includes("intro") || key.includes("hook") || key.includes("opening")) {
    return "Introduction";
  }
  if (
    key.includes("concl") ||
    key.includes("resolut") ||
    key.includes("closing")
  ) {
    return "Conclusion";
  }
  if (index === 0) return "Introduction";
  if (index === total - 1) return "Conclusion";
  return "Supporting";
}

/**
 * User written essay — formal continuous prose with Model-essay role badges
 * aligned to the right of each section.
 */
function writeUserWrittenEssayPage(
  doc: import("jspdf").jsPDF,
  margin: number,
  contentW: number,
  yRef: { y: number },
  pageH: number,
  result: EssayGenerationResult,
  writtenSections: Record<string, string>,
  opts: {
    fontFamily: "helvetica" | "times";
    bodySize: number;
    lineHeight: number;
  },
) {
  const { fontFamily, bodySize } = opts;
  const { lineHeight, paraGap, blockGap } = formalBodyMetrics(
    bodySize,
    opts.lineHeight,
  );
  ensureNewPage(doc, yRef, margin);

  doc.setFont(fontFamily, "bold");
  doc.setFontSize(Math.max(12, bodySize + 1));
  doc.setTextColor(20);
  doc.text("User Written Essay", margin, yRef.y);
  yRef.y += lineHeight + 6;

  const filled = result.sections
    .map((section, index) => {
      const text = (writtenSections[section.id] ?? "").trim();
      if (!text) return null;
      return {
        text,
        badge: roleBadgeForWrittenSection(
          section.type,
          section.title,
          index,
          result.sections.length,
        ),
      };
    })
    .filter(
      (row): row is { text: string; badge: ModelEssayRoleBadge } => row != null,
    );

  if (filled.length === 0) {
    doc.setFont(fontFamily, "normal");
    doc.setFontSize(bodySize);
    doc.setTextColor(80);
    doc.text("No written essay content yet.", margin, yRef.y);
    yRef.y += lineHeight;
    return;
  }

  const badgeCol = 78;
  const textW = Math.max(180, contentW - badgeCol - 6);

  for (const row of filled) {
    checkPdfPage(doc, yRef, pageH, margin, lineHeight * 3);
    drawRoleBadge(doc, row.badge, {
      margin,
      contentW,
      y: yRef.y,
      align: "right",
    });

    doc.setFont(fontFamily, "normal");
    doc.setFontSize(bodySize);
    doc.setTextColor(35);
    const paragraphs = row.text
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
      .filter(Boolean);
    const blocks = paragraphs.length > 0 ? paragraphs : [row.text];
    for (const paragraph of blocks) {
      const wrapped = doc.splitTextToSize(paragraph, textW);
      checkPdfPage(
        doc,
        yRef,
        pageH,
        margin,
        wrapped.length * lineHeight + paraGap,
      );
      doc.text(wrapped, margin, yRef.y);
      yRef.y += wrapped.length * lineHeight + paraGap;
    }
    yRef.y += Math.max(2, blockGap - paraGap);
  }
}

/**
 * AI Feedback on one dedicated page — score + summary lists, tight spacing.
 * Detailed category notes follow compactly on the same page when space allows.
 */
function writeAiFeedbackSection(
  doc: import("jspdf").jsPDF,
  margin: number,
  contentW: number,
  yRef: { y: number },
  pageH: number,
  feedback: EssayFeedbackResult,
  opts: {
    fontFamily: "helvetica" | "times";
    bodySize: number;
    lineHeight: number;
  },
) {
  const { fontFamily, bodySize, lineHeight } = opts;
  const compactLh = Math.max(11, Math.round(lineHeight * 0.85));
  ensureNewPage(doc, yRef, margin);

  const writeHeading = (label: string) => {
    checkPdfPage(doc, yRef, pageH, margin, compactLh + 2);
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(Math.max(10, bodySize));
    doc.setTextColor(30);
    doc.text(label, margin, yRef.y);
    yRef.y += compactLh;
  };

  const writeBodyLines = (lines: string[]) => {
    doc.setFont(fontFamily, "normal");
    doc.setFontSize(Math.max(9, bodySize - 0.5));
    doc.setTextColor(50);
    for (const line of lines) {
      const wrapped = doc.splitTextToSize(line, contentW);
      checkPdfPage(doc, yRef, pageH, margin, wrapped.length * compactLh);
      doc.text(wrapped, margin, yRef.y);
      yRef.y += wrapped.length * compactLh;
    }
    yRef.y += 3;
  };

  writeHeading("AI Feedback");
  writeBodyLines([`Overall score: ${feedback.overallScore}/100`]);

  writeHeading("Strengths");
  writeBodyLines(feedback.strengths.map((item) => `• ${item}`));

  writeHeading("Areas for improvement");
  writeBodyLines(feedback.areasForImprovement.map((item) => `• ${item}`));

  writeHeading("Revision suggestions");
  writeBodyLines(feedback.revisionSuggestions.map((item) => `• ${item}`));
}

function writeContinuousParagraphs(
  doc: import("jspdf").jsPDF,
  margin: number,
  contentW: number,
  yRef: { y: number },
  pageH: number,
  paragraphs: string[],
  opts: {
    fontFamily: "helvetica" | "times";
    bodySize: number;
    lineHeight: number;
    indentFirstLine: boolean;
  },
) {
  const { fontFamily, bodySize, lineHeight, indentFirstLine } = opts;
  doc.setFontSize(bodySize);
  doc.setFont(fontFamily, "normal");
  doc.setTextColor(20);

  for (const paragraph of paragraphs) {
    const indent = indentFirstLine ? Math.round(0.5 * 72) : 0;
    const firstLineW = contentW - indent;
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    let line = "";
    let isFirstLine = true;
    const flush = (text: string, useIndent: boolean) => {
      checkPdfPage(doc, yRef, pageH, margin, lineHeight);
      const x = margin + (useIndent ? indent : 0);
      doc.text(text, x, yRef.y);
      yRef.y += lineHeight;
    };

    for (const word of words) {
      const maxW = isFirstLine ? firstLineW : contentW;
      const next = line ? `${line} ${word}` : word;
      if (doc.getTextWidth(next) > maxW && line) {
        flush(line, isFirstLine && indentFirstLine);
        line = word;
        isFirstLine = false;
      } else {
        line = next;
      }
    }
    if (line) {
      flush(line, isFirstLine && indentFirstLine);
    }
    yRef.y += Math.round(lineHeight * 0.35);
  }
}

function applyPdfRunningChrome(
  doc: import("jspdf").jsPDF,
  title: string,
  formatting: DocumentStudioMeta["essayFormatting"],
  margin: number,
  fontFamily: "helvetica" | "times",
) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    if (formatting.runningHeader && !(formatting.titlePage && i === 1)) {
      doc.setFont(fontFamily, "normal");
      doc.setFontSize(9);
      doc.setTextColor(90);
      doc.text(title.slice(0, 60), margin, margin - 14);
    }
    if (formatting.pageNumbers) {
      doc.setFont(fontFamily, "normal");
      doc.setFontSize(9);
      doc.setTextColor(90);
      doc.text(String(i), pageW / 2, pageH - Math.max(18, margin / 2), {
        align: "center",
      });
    }
  }
}

/** Formatted written essay only (title page + body + references). */
async function buildWrittenEssayOnlyPdfDocument(input: EssayPromptPdfInput) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const { title, result, writtenSections } = input;
  const studio = resolveStudio(input);
  const formatting = studio.essayFormatting;
  const fontFamily = pdfFontFamily(formatting.font);
  const bodySize = formatting.fontSize;
  const lineHeight = Math.round(bodySize * formatting.lineSpacing * 1.15);
  const isApa = formatting.citationStyle === "apa";

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = Math.round(marginInches(formatting.margins) * 72);
  const contentW = pageW - margin * 2;
  const yRef = { y: margin };

  if (formatting.titlePage) {
    const titleLines = isApa
      ? resolveApaStudentTitlePageLines({
          title,
          titlePage: result.titlePage,
          studentName: input.studentName,
          institutionName: input.institutionName,
          courseName: input.courseName,
          instructorName: input.instructorName,
          assignmentDate: input.assignmentDate,
        })
      : (result.titlePage?.trim()
          ? result.titlePage.trim().split(/\n/).map((l) => l.trim()).filter(Boolean)
          : [title]);

    let ty = pageH * 0.28;
    titleLines.forEach((line, index) => {
      const wrapped = doc.splitTextToSize(line || " ", contentW);
      doc.setFont(fontFamily, index === 0 ? "bold" : "normal");
      doc.setFontSize(bodySize);
      doc.setTextColor(20);
      doc.text(wrapped, pageW / 2, ty, { align: "center" });
      ty += wrapped.length * lineHeight + (index === 0 ? 10 : 6);
    });
    doc.addPage();
    yRef.y = margin;
  }

  if (formatting.runningHeader) {
    doc.setFont(fontFamily, "normal");
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(title.slice(0, 60), margin, margin - 14);
  }

  // Body title (APA student papers often repeat the title on page 1 of the body)
  if (isApa) {
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(bodySize);
    doc.setTextColor(20);
    const bodyTitle = doc.splitTextToSize(title, contentW);
    doc.text(bodyTitle, pageW / 2, yRef.y, { align: "center" });
    yRef.y += bodyTitle.length * lineHeight + lineHeight;
  }

  const paragraphs = collectContinuousWrittenEssayParagraphs(
    result,
    writtenSections,
  );
  if (paragraphs.length > 0) {
    writeContinuousParagraphs(doc, margin, contentW, yRef, pageH, paragraphs, {
      fontFamily,
      bodySize,
      lineHeight,
      indentFirstLine: formatting.indentFirstLine,
    });
  } else {
    addSection(
      doc,
      margin,
      contentW,
      yRef,
      pageH,
      "Written essay",
      ["No written essay content is available for this document yet."],
      { fontFamily, bodySize, lineHeight },
    );
  }

  const refPack = resolveEssayReferencesForPaper(result, studio);
  if (formatting.includeReferences && refPack.references.length > 0) {
    doc.addPage();
    yRef.y = margin;
    if (refPack.referencesNote) {
      doc.setFont(fontFamily, "italic");
      doc.setFontSize(9);
      doc.setTextColor(90);
      const noteLines = doc.splitTextToSize(refPack.referencesNote, contentW);
      checkPdfPage(doc, yRef, pageH, margin, noteLines.length * 12 + 8);
      doc.text(noteLines, margin, yRef.y);
      yRef.y += noteLines.length * 12 + 10;
    }
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(bodySize);
    doc.setTextColor(20);
    doc.text(refPack.referencesTitle, pageW / 2, yRef.y, { align: "center" });
    yRef.y += lineHeight + 8;
    doc.setFont(fontFamily, "normal");
    for (const entry of refPack.references) {
      const wrapped = doc.splitTextToSize(entry, contentW - 18);
      checkPdfPage(doc, yRef, pageH, margin, wrapped.length * lineHeight + 6);
      // Hanging indent approximation
      doc.text(wrapped[0] ?? "", margin, yRef.y);
      yRef.y += lineHeight;
      for (let i = 1; i < wrapped.length; i++) {
        checkPdfPage(doc, yRef, pageH, margin, lineHeight);
        doc.text(wrapped[i]!, margin + 18, yRef.y);
        yRef.y += lineHeight;
      }
      yRef.y += Math.round(lineHeight * 0.25);
    }
  }

  applyPdfRunningChrome(doc, title, formatting, margin, fontFamily);
  return doc;
}

export async function buildEssayPromptPdfDocument(input: EssayPromptPdfInput) {
  if (input.pdfMode === "writtenOnly") {
    return buildWrittenEssayOnlyPdfDocument(input);
  }

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const {
    title,
    prompt,
    result,
    wordCountTarget,
    includeModelEssay,
    writtenSections,
  } = input;
  const studio = resolveStudio(input);
  const formatting = studio.essayFormatting;
  const fontFamily = pdfFontFamily(formatting.font);
  const bodySize = formatting.fontSize;
  const lineHeight = Math.round(bodySize * formatting.lineSpacing * 1.15);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = Math.round(marginInches(formatting.margins) * 72);
  const contentW = pageW - margin * 2;
  const yRef = { y: margin };

  if (formatting.titlePage) {
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(bodySize);
    doc.setTextColor(20);
    const aiTitlePage = result.titlePage?.trim();
    if (aiTitlePage) {
      const pageLines = aiTitlePage.split(/\n/);
      let ty = pageH * 0.28;
      pageLines.forEach((line, index) => {
        const wrapped = doc.splitTextToSize(line || " ", contentW);
        doc.setFont(fontFamily, index === 0 ? "bold" : "normal");
        doc.text(wrapped, pageW / 2, ty, { align: "center" });
        ty += wrapped.length * lineHeight + 6;
      });
    } else {
      doc.setFontSize(18);
      const titleLines = doc.splitTextToSize(title, contentW);
      doc.text(titleLines, pageW / 2, pageH * 0.35, { align: "center" });
      doc.setFont(fontFamily, "normal");
      doc.setFontSize(12);
      doc.text("Essay Prompt & Instructions", pageW / 2, pageH * 0.35 + 36, {
        align: "center",
      });
      if (formatting.citationStyle !== "none") {
        doc.text(
          `Citation style: ${formatting.citationStyle.toUpperCase()}`,
          pageW / 2,
          pageH * 0.35 + 56,
          { align: "center" },
        );
      }
    }
    doc.addPage();
    yRef.y = margin;
  }

  if (formatting.runningHeader) {
    doc.setFont(fontFamily, "normal");
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(title.slice(0, 60), margin, margin - 14);
  }

  doc.setFontSize(16);
  doc.setFont(fontFamily, "bold");
  doc.setTextColor(20);
  doc.text("Essay Prompt & Instructions", margin, yRef.y);
  yRef.y += 18;

  doc.setFontSize(12);
  doc.setFont(fontFamily, "bold");
  doc.setTextColor(30);
  const titleMetrics = formalBodyMetrics(12, 15);
  const titleWrapped = doc.splitTextToSize(title, contentW);
  doc.text(titleWrapped, margin, yRef.y);
  yRef.y += titleWrapped.length * titleMetrics.lineHeight + 4;

  if (wordCountTarget != null && wordCountTarget > 0) {
    doc.setFontSize(9);
    doc.setFont(fontFamily, "normal");
    doc.setTextColor(80);
    doc.text(`Target length: ~${wordCountTarget} words`, margin, yRef.y);
    yRef.y += 12;
  }

  doc.setDrawColor(220);
  doc.line(margin, yRef.y, margin + contentW, yRef.y);
  yRef.y += 12;

  const sectionOpts = { fontFamily, bodySize, lineHeight };
  const writeSection = (sectionTitle: string, lines: string[]) =>
    addSection(
      doc,
      margin,
      contentW,
      yRef,
      pageH,
      sectionTitle,
      lines,
      sectionOpts,
    );
  const writeCompactSection = (sectionTitle: string, lines: string[]) =>
    addSection(doc, margin, contentW, yRef, pageH, sectionTitle, lines, {
      ...sectionOpts,
      compact: true,
    });

  // Keep Learning objectives → Essay prompt → Thesis tight (minimal gaps).
  if (result.learningObjectives.length > 0) {
    writeCompactSection(
      "Learning objectives",
      result.learningObjectives.map((o, i) => `${i + 1}. ${o}`),
    );
  }

  writeCompactSection("Essay prompt", [prompt]);

  if (result.thesis?.trim()) {
    writeCompactSection("Thesis", [result.thesis]);
  }

  if (result.outline && result.outline.length > 0) {
    writeCompactSection(
      "Essay sections (outline)",
      result.outline.map((item, i) => formatEssayOutlineDisplay(item, i)),
    );
  } else if (result.sections.length > 0) {
    writeCompactSection(
      "Essay sections",
      result.sections.map((section, i) =>
        formatEssayOutlineDisplay(
          {
            title: section.title,
            purpose: section.instructions,
            estimatedWords: section.estimatedWords,
          },
          i,
        ),
      ),
    );
  }

  if (result.vocabulary && result.vocabulary.length > 0) {
    writeCompactSection(
      "Vocabulary",
      result.vocabulary.map((v) => `• ${v.term} — ${v.definition}`),
    );
  }

  if (result.planningGuide && result.planningGuide.length > 0) {
    writeCompactSection(
      "Planning guide",
      result.planningGuide.map((step, i) => `${i + 1}. ${step}`),
    );
  }

  if (result.successChecklist.length > 0) {
    writeCompactSection(
      "Success checklist",
      result.successChecklist.map((item) => `• ${item}`),
    );
  }

  if (result.rubric && result.rubric.length > 0) {
    writeCompactSection(
      "Rubric",
      result.rubric.map(
        (r) => `• ${r.name} (${r.maxPoints} pts) — ${r.description}`,
      ),
    );
  }

  const citedModel =
    includeModelEssay && result.modelEssay?.trim()
      ? buildCitedModelEssayView(result, studio)
      : null;

  if (citedModel) {
    addModelEssaySection(
      doc,
      margin,
      contentW,
      yRef,
      pageH,
      citedModel.segments,
      result.modelEssay!,
      { bodySize, lineHeight },
    );
  }

  const referenceLines =
    citedModel?.showCitations && citedModel.references.length > 0
      ? citedModel.references
      : formatting.includeReferences && result.references?.length
        ? result.references
        : [];
  if (referenceLines.length > 0) {
    if (formatting.citationStyle !== "none") {
      ensureNewPage(doc, yRef, margin);
    }
    const refTitle =
      citedModel?.showCitations
        ? citedModel.referencesTitle
        : formatting.citationStyle === "mla"
          ? "Works Cited"
          : formatting.citationStyle === "chicago"
            ? "Bibliography"
            : "References";
    writeSection(
      refTitle,
      referenceLines.map((ref) => `${ref}`),
    );
  }

  // Always include student writing when present — never replace/skip with model essay.
  if (writtenSections) {
    const hasWritten = result.sections.some(
      (section) => (writtenSections[section.id] ?? "").trim().length > 0,
    );
    if (hasWritten) {
      writeUserWrittenEssayPage(
        doc,
        margin,
        contentW,
        yRef,
        pageH,
        result,
        writtenSections,
        { fontFamily, bodySize, lineHeight },
      );
    }
  }

  if (input.feedback) {
    writeAiFeedbackSection(doc, margin, contentW, yRef, pageH, input.feedback, {
      fontFamily,
      bodySize,
      lineHeight,
    });
  }

  applyPdfRunningChrome(doc, title, formatting, margin, fontFamily);
  return doc;
}

async function openAndSavePdf(
  doc: Awaited<ReturnType<typeof buildEssayPromptPdfDocument>>,
  fileName: string,
) {
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  doc.save(fileName);
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Builds the prompt/instructions PDF, opens it in a new tab for viewing,
 * and triggers a download.
 */
export async function downloadEssayPromptPdf(
  input: EssayPromptPdfInput,
): Promise<void> {
  const doc = await buildEssayPromptPdfDocument(input);
  await openAndSavePdf(
    doc,
    `${essayPromptPdfSafeFileName(input.title)}_prompt.pdf`,
  );
}

/** Full essay PDF (prompt + written sections) for library “View in PDF”. */
export async function downloadEssayDocumentPdf(
  input: EssayPromptPdfInput,
): Promise<void> {
  const doc = await buildEssayPromptPdfDocument(input);
  await openAndSavePdf(
    doc,
    `${essayPromptPdfSafeFileName(input.title)}_essay.pdf`,
  );
}

/**
 * Opens a browser preview of the formatted written essay only
 * (no prompt/instructions/outline). Used after applying citation format.
 */
export async function previewFormattedWrittenEssayPdf(
  input: EssayPromptPdfInput,
): Promise<void> {
  const doc = await buildEssayPromptPdfDocument({
    ...input,
    pdfMode: "writtenOnly",
    includeModelEssay: false,
  });
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
