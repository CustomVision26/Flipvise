"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  XCircle,
  CircleHelp,
  Download,
  Eye,
} from "lucide-react";
import type { PerCardSnapshot } from "@/db/schema";

export type QuizResultSummary = {
  id: number;
  deckName: string;
  correct: number;
  incorrect: number;
  unanswered: number;
  total: number;
  percent: number;
  elapsedSeconds: number;
  savedAt: Date | string;
  perCard: PerCardSnapshot[] | null;
  // Who took the quiz
  userName: string | null;
  userEmail: string | null;
  // Workspace context (null for personal quizzes)
  teamName: string | null;
  memberRole: "owner" | "team_admin" | "team_member" | null;
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
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type CardStatus = "correct" | "incorrect" | "unanswered";

function getStatus(card: PerCardSnapshot): CardStatus {
  if (!card.selectedAnswer) return "unanswered";
  return card.correct ? "correct" : "incorrect";
}

// ─── PDF generation ───────────────────────────────────────────────────────────

async function downloadPdf(result: QuizResultSummary) {
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
  doc.text(result.deckName, margin, y);
  y += 17;

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(formatDate(result.savedAt), margin, y);
  y += 18;

  // ── User / workspace info block ──────────────────────────────────────────
  const infoLines: string[] = [];

  if (result.userName || result.userEmail) {
    const nameEmail = [result.userName, result.userEmail].filter(Boolean).join("  |  ");
    infoLines.push(`Taken by:  ${nameEmail}`);
  }

  if (result.teamName) {
    infoLines.push(`Workspace:  ${result.teamName}`);
  }

  if (result.memberRole) {
    const roleLabel =
      result.memberRole === "owner"
        ? "Owner"
        : result.memberRole === "team_admin"
          ? "Team Admin"
          : "Member";
    infoLines.push(`Role:  ${roleLabel}`);
  }

  if (result.teamName && (result.ownerName || result.ownerEmail)) {
    const ownerNameEmail = [result.ownerName, result.ownerEmail].filter(Boolean).join("  |  ");
    infoLines.push(`Workspace owner:  ${ownerNameEmail}`);
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

  const fillW = Math.max(0, (result.percent / 100) * contentW);
  const [sr, sg, sb] =
    result.percent >= 90 ? [234, 179, 8] : result.percent >= 50 ? [59, 130, 246] : [168, 85, 247];
  doc.setFillColor(sr, sg, sb);
  if (fillW > 0) doc.roundedRect(margin, y, fillW, barH, 3, 3, "F");
  y += barH + 10;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(sr, sg, sb);
  doc.text(`${result.percent}%`, margin, y);
  doc.setTextColor(60);
  doc.text(
    `  ${result.correct} / ${result.total} correct`,
    margin + doc.getTextWidth(`${result.percent}%`),
    y,
  );
  y += 15;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(
    `Correct: ${result.correct}   Incorrect: ${result.incorrect}   Unanswered: ${result.unanswered}   Time: ${formatClock(result.elapsedSeconds)}`,
    margin,
    y,
  );
  y += 20;

  if (!result.perCard || result.perCard.length === 0) {
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

    result.perCard.forEach((card, idx) => {
      checkPage(80);

      const status = getStatus(card);

      // ── Question line ──
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(20);
      const qText = `Q${idx + 1}.  ${card.question ?? "(no question text)"}`;
      const qLines = doc.splitTextToSize(qText, contentW - 70);
      doc.text(qLines, margin, y);

      // Status label aligned right
      const [lr, lg, lb] =
        status === "correct" ? [16, 185, 129] : status === "incorrect" ? [220, 50, 50] : [140, 140, 160];
      doc.setTextColor(lr, lg, lb);
      const statusStr =
        status === "correct" ? "Correct" : status === "incorrect" ? "Incorrect" : "Unanswered";
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(statusStr, pageW - margin, y, { align: "right" });

      y += qLines.length * 13 + 5;
      checkPage(40);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");

      if (status === "correct") {
        // Only show what the user answered (it's correct — no need to show separately)
        doc.setTextColor(16, 185, 129);
        const aLines = doc.splitTextToSize(
          `Your answer:  ${card.selectedAnswer}`,
          contentW - 20,
        );
        doc.text(aLines, margin + 14, y);
        y += aLines.length * 12;
      } else if (status === "incorrect") {
        // Show what user picked (wrong), then the correct answer
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
        // Unanswered — show "Not answered", then correct answer
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

      y += 14; // gap between cards
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

  const safeName = result.deckName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  doc.save(`quiz_result_${safeName}.pdf`);
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ViewQuizResultDialogProps {
  result: QuizResultSummary;
  triggerLabel?: string;
}

export function ViewQuizResultDialog({
  result,
  triggerLabel = "View Results",
}: ViewQuizResultDialogProps) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadPdf(result);
    } finally {
      setDownloading(false);
    }
  }

  const tierColor =
    result.percent >= 90
      ? "text-yellow-500"
      : result.percent >= 50
        ? "text-blue-400"
        : "text-purple-400";

  const cards = result.perCard ?? [];
  const correctCount = cards.filter((c) => getStatus(c) === "correct").length;
  const incorrectCount = cards.filter((c) => getStatus(c) === "incorrect").length;
  const unansweredCount = cards.filter((c) => getStatus(c) === "unanswered").length;

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Eye className="size-3.5" aria-hidden />
        {triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl flex flex-col overflow-hidden p-0">

          {/* ── Fixed header ── */}
          <div className="shrink-0 border-b px-6 pt-6 pb-4 space-y-4">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold leading-tight">
                {result.deckName}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Saved {formatDate(result.savedAt)}
              </DialogDescription>
            </DialogHeader>

            {/* User / workspace info */}
            {(result.userName || result.userEmail || result.teamName) && (
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 space-y-1.5 text-xs">
                {(result.userName || result.userEmail) && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-muted-foreground uppercase tracking-wide">
                      Taken by
                    </span>
                    {result.userName && (
                      <span className="text-foreground font-medium">{result.userName}</span>
                    )}
                    {result.userEmail && (
                      <span className="text-muted-foreground">{result.userEmail}</span>
                    )}
                  </div>
                )}
                {result.teamName && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-muted-foreground uppercase tracking-wide">
                      Workspace
                    </span>
                    <span className="text-foreground font-medium">{result.teamName}</span>
                    {result.memberRole && (
                      <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground capitalize">
                        {result.memberRole === "owner"
                          ? "Owner"
                          : result.memberRole === "team_admin"
                            ? "Team Admin"
                            : "Member"}
                      </span>
                    )}
                  </div>
                )}
                {result.teamName && (result.ownerName || result.ownerEmail) && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-muted-foreground uppercase tracking-wide">
                      Owner
                    </span>
                    {result.ownerName && (
                      <span className="text-foreground font-medium">{result.ownerName}</span>
                    )}
                    {result.ownerEmail && (
                      <span className="text-muted-foreground">{result.ownerEmail}</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Score bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground font-medium">Score</span>
                <span className={`font-bold tabular-nums ${tierColor}`}>
                  {result.percent}%
                </span>
              </div>
              <Progress value={result.percent} className="h-2.5" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Correct cards</span>
                <span className={`font-semibold ${tierColor}`}>
                  {result.correct} / {result.total}
                </span>
              </div>
            </div>

            {/* Stat chips */}
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="flex items-center gap-1.5 font-medium text-emerald-500">
                <CheckCircle className="size-4" aria-hidden />
                {result.correct} correct
              </span>
              <span className="flex items-center gap-1.5 font-medium text-rose-500">
                <XCircle className="size-4" aria-hidden />
                {result.incorrect} incorrect
              </span>
              <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                <CircleHelp className="size-4" aria-hidden />
                {result.unanswered} unanswered
              </span>
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {result.total} card{result.total !== 1 ? "s" : ""} · {formatClock(result.elapsedSeconds)}
              </span>
            </div>
          </div>

          {/* ── Scrollable question review ── */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {cards.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No per-card breakdown is available for this result.
              </p>
            ) : (
              <ol className="space-y-3">
                {cards.map((card, idx) => {
                  const status = getStatus(card);

                  return (
                    <li
                      key={card.cardId}
                      className={`rounded-xl border p-4 space-y-3 ${
                        status === "correct"
                          ? "border-emerald-500/30 bg-emerald-500/5"
                          : status === "incorrect"
                            ? "border-rose-500/30 bg-rose-500/5"
                            : "border-border bg-muted/15"
                      }`}
                    >
                      {/* Question row */}
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-foreground leading-snug">
                          <span className="text-muted-foreground font-normal mr-1.5 tabular-nums">
                            {idx + 1}.
                          </span>
                          {card.question ?? (
                            <span className="italic text-muted-foreground font-normal">
                              (no question text)
                            </span>
                          )}
                        </p>

                        {status === "correct" && (
                          <Badge
                            variant="outline"
                            className="shrink-0 border-emerald-500/40 text-emerald-500 text-[11px] gap-1 px-2"
                          >
                            <CheckCircle className="size-3" aria-hidden />
                            Correct
                          </Badge>
                        )}
                        {status === "incorrect" && (
                          <Badge
                            variant="outline"
                            className="shrink-0 border-rose-500/40 text-rose-500 text-[11px] gap-1 px-2"
                          >
                            <XCircle className="size-3" aria-hidden />
                            Incorrect
                          </Badge>
                        )}
                        {status === "unanswered" && (
                          <Badge
                            variant="outline"
                            className="shrink-0 text-muted-foreground text-[11px] gap-1 px-2"
                          >
                            <CircleHelp className="size-3" aria-hidden />
                            Unanswered
                          </Badge>
                        )}
                      </div>

                      <Separator className="opacity-40" />

                      {/* Answer block */}
                      <div className="space-y-2 text-sm pl-1">
                        {status === "correct" && (
                          <div className="flex items-start gap-2">
                            <CheckCircle className="size-4 shrink-0 mt-0.5 text-emerald-500" aria-hidden />
                            <div>
                              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-0.5">
                                Your answer
                              </span>
                              <span className="text-emerald-400 font-medium">
                                {card.selectedAnswer}
                              </span>
                            </div>
                          </div>
                        )}

                        {status === "incorrect" && (
                          <>
                            <div className="flex items-start gap-2">
                              <XCircle className="size-4 shrink-0 mt-0.5 text-rose-500" aria-hidden />
                              <div>
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-0.5">
                                  Your answer
                                </span>
                                <span className="text-rose-400 font-medium">
                                  {card.selectedAnswer}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-start gap-2">
                              <CheckCircle className="size-4 shrink-0 mt-0.5 text-emerald-500" aria-hidden />
                              <div>
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-0.5">
                                  Correct answer
                                </span>
                                <span className="text-emerald-400 font-medium">
                                  {card.correctAnswer}
                                </span>
                              </div>
                            </div>
                          </>
                        )}

                        {status === "unanswered" && (
                          <>
                            <div className="flex items-start gap-2">
                              <CircleHelp className="size-4 shrink-0 mt-0.5 text-muted-foreground" aria-hidden />
                              <div>
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-0.5">
                                  Your answer
                                </span>
                                <span className="italic text-muted-foreground">
                                  Not answered
                                </span>
                              </div>
                            </div>
                            <div className="flex items-start gap-2">
                              <CheckCircle className="size-4 shrink-0 mt-0.5 text-emerald-500" aria-hidden />
                              <div>
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-0.5">
                                  Correct answer
                                </span>
                                <span className="text-emerald-400 font-medium">
                                  {card.correctAnswer}
                                </span>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}

            {/* Summary row at the bottom of the list */}
            {cards.length > 0 && (
              <div className="mt-4 rounded-lg border border-border bg-muted/10 px-4 py-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="text-emerald-500 font-medium">{correctCount} correct</span>
                <span className="text-rose-500 font-medium">{incorrectCount} incorrect</span>
                <span className="font-medium">{unansweredCount} unanswered</span>
                <span className="ml-auto tabular-nums">{cards.length} total questions</span>
              </div>
            )}
          </div>

          {/* ── Fixed footer ── */}
          <div className="shrink-0 border-t px-6 py-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button className="gap-2" onClick={handleDownload} disabled={downloading}>
              <Download className="size-4" aria-hidden />
              {downloading ? "Generating…" : "Download PDF"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
