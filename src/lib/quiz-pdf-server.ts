import type { PerCardSnapshot } from "@/db/schema";

export type QuizPdfData = {
  deckName: string;
  savedAt: Date | string;
  correct: number;
  incorrect: number;
  unanswered: number;
  total: number;
  percent: number;
  elapsedSeconds: number;
  perCard: PerCardSnapshot[] | null;
  userName: string | null;
  userEmail: string | null;
  teamName: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
};

function formatClock(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const mm = Math.floor(clamped / 60).toString().padStart(2, "0");
  const ss = (clamped % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
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

/**
 * Generates a quiz result PDF server-side using jsPDF and returns it as a Buffer.
 * The layout is identical to the client-side download in ViewQuizResultDialog.
 */
export async function generateQuizResultPdfBuffer(data: QuizPdfData): Promise<Buffer> {
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

  function hRule() {
    doc.setDrawColor(220);
    doc.line(margin, y, margin + contentW, y);
    y += 12;
  }

  // ── Title block ──────────────────────────────────────────────────────────
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20);
  doc.text("Quiz Result", margin, y);
  y += 26;

  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);
  doc.text(data.deckName, margin, y);
  y += 17;

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(formatDate(data.savedAt), margin, y);
  y += 18;

  // ── User / workspace info block ──────────────────────────────────────────
  const infoLines: string[] = [];

  if (data.userName || data.userEmail) {
    infoLines.push(
      `Taken by:  ${[data.userName, data.userEmail].filter(Boolean).join("  |  ")}`,
    );
  }
  if (data.teamName) {
    infoLines.push(`Workspace:  ${data.teamName}`);
  }
  if (data.teamName && (data.ownerName || data.ownerEmail)) {
    infoLines.push(
      `Workspace owner:  ${[data.ownerName, data.ownerEmail].filter(Boolean).join("  |  ")}`,
    );
  }

  if (infoLines.length > 0) {
    doc.setFillColor(245, 245, 248);
    const blockH = infoLines.length * 14 + 12;
    doc.roundedRect(margin, y, contentW, blockH, 3, 3, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50);
    infoLines.forEach((line, i) => {
      doc.text(line, margin + 10, y + 10 + i * 14);
    });
    y += blockH + 10;
  }

  // ── Score bar ────────────────────────────────────────────────────────────
  const barH = 11;
  doc.setFillColor(220, 220, 220);
  doc.roundedRect(margin, y, contentW, barH, 3, 3, "F");

  const fillW = Math.max(0, (data.percent / 100) * contentW);
  const [sr, sg, sb] =
    data.percent >= 90
      ? [234, 179, 8]
      : data.percent >= 50
        ? [59, 130, 246]
        : [168, 85, 247];
  doc.setFillColor(sr, sg, sb);
  if (fillW > 0) doc.roundedRect(margin, y, fillW, barH, 3, 3, "F");
  y += barH + 10;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(sr, sg, sb);
  doc.text(`${data.percent}%`, margin, y);
  doc.setTextColor(60);
  doc.text(
    `  ${data.correct} / ${data.total} correct`,
    margin + doc.getTextWidth(`${data.percent}%`),
    y,
  );
  y += 15;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(
    `Correct: ${data.correct}   Incorrect: ${data.incorrect}   Unanswered: ${data.unanswered}   Time: ${formatClock(data.elapsedSeconds)}`,
    margin,
    y,
  );
  y += 20;

  if (!data.perCard || data.perCard.length === 0) {
    hRule();
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text("No per-card breakdown available for this result.", margin, y);
  } else {
    hRule();

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20);
    doc.text("Question Review", margin, y);
    y += 20;

    data.perCard.forEach((card, idx) => {
      checkPage(80);

      const status = !card.selectedAnswer
        ? "unanswered"
        : card.correct
          ? "correct"
          : "incorrect";

      // ── Question line ──
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(20);
      const qText = `Q${idx + 1}.  ${card.question ?? "(no question text)"}`;
      const qLines = doc.splitTextToSize(qText, contentW - 70);
      doc.text(qLines, margin, y);

      const [lr, lg, lb] =
        status === "correct"
          ? [16, 185, 129]
          : status === "incorrect"
            ? [220, 50, 50]
            : [140, 140, 160];
      doc.setTextColor(lr, lg, lb);
      const statusStr =
        status === "correct"
          ? "Correct"
          : status === "incorrect"
            ? "Incorrect"
            : "Unanswered";
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(statusStr, pageW - margin, y, { align: "right" });

      y += qLines.length * 13 + 5;
      checkPage(40);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");

      if (status === "correct") {
        doc.setTextColor(16, 185, 129);
        const aLines = doc.splitTextToSize(
          `Your answer:  ${card.selectedAnswer}`,
          contentW - 20,
        );
        doc.text(aLines, margin + 14, y);
        y += aLines.length * 12;
      } else if (status === "incorrect") {
        doc.setTextColor(210, 50, 50);
        const wrongLines = doc.splitTextToSize(
          `Your answer:  ${card.selectedAnswer}`,
          contentW - 20,
        );
        doc.text(wrongLines, margin + 14, y);
        y += wrongLines.length * 12 + 3;

        checkPage(18);
        doc.setTextColor(16, 150, 80);
        const corrLines = doc.splitTextToSize(
          `Correct answer:  ${card.correctAnswer}`,
          contentW - 20,
        );
        doc.text(corrLines, margin + 14, y);
        y += corrLines.length * 12;
      } else {
        doc.setTextColor(150);
        doc.text("Not answered", margin + 14, y);
        y += 13;

        checkPage(18);
        doc.setTextColor(16, 150, 80);
        const corrLines = doc.splitTextToSize(
          `Correct answer:  ${card.correctAnswer}`,
          contentW - 20,
        );
        doc.text(corrLines, margin + 14, y);
        y += corrLines.length * 12;
      }

      y += 14;
    });
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(170);
    doc.text(
      `Flipvise - Quiz Result  |  Page ${p} of ${pageCount}`,
      pageW / 2,
      pageH - 22,
      { align: "center" },
    );
  }

  return Buffer.from(doc.output("arraybuffer"));
}
