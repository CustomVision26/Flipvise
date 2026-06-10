"use client";

import { useState } from "react";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, XCircle, CircleHelp, Download } from "lucide-react";
import type { PerCardSnapshot } from "@/db/schema";
import { cn } from "@/lib/utils";

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

function QuizResultMemberContext({ result }: { result: QuizResultSummary }) {
  if (!(result.userName || result.userEmail || result.teamName)) return null;

  return (
    <div className="space-y-3 rounded-lg border border-border/80 bg-muted/15 px-4 py-3 text-sm">
      {(result.userName || result.userEmail) && (
        <div className="space-y-0.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Taken by
          </p>
          {result.userName ? (
            <p className="font-medium text-foreground">{result.userName}</p>
          ) : null}
          {result.userEmail ? (
            <p className="text-muted-foreground">{result.userEmail}</p>
          ) : null}
        </div>
      )}
      {result.teamName ? (
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Workspace
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{result.teamName}</span>
            {result.memberRole ? (
              <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                {result.memberRole === "owner"
                  ? "Owner"
                  : result.memberRole === "team_admin"
                    ? "Team admin"
                    : "Member"}
              </Badge>
            ) : null}
          </div>
        </div>
      ) : null}
      {result.teamName && (result.ownerName || result.ownerEmail) ? (
        <div className="space-y-0.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Owner
          </p>
          {result.ownerName ? (
            <p className="font-medium text-foreground">{result.ownerName}</p>
          ) : null}
          {result.ownerEmail ? (
            <p className="text-muted-foreground">{result.ownerEmail}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function QuizResultPerCardReview({ cards }: { cards: PerCardSnapshot[] }) {
  const correctCount = cards.filter((c) => getStatus(c) === "correct").length;
  const incorrectCount = cards.filter((c) => getStatus(c) === "incorrect").length;
  const unansweredCount = cards.filter((c) => getStatus(c) === "unanswered").length;

  if (cards.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No per-card breakdown is available for this result.
      </p>
    );
  }

  return (
    <>
      <ol className="space-y-4">
        {cards.map((card, idx) => {
          const status = getStatus(card);

          return (
            <li
              key={card.cardId}
              className={cn(
                "rounded-xl border p-4 space-y-3 sm:p-5",
                status === "correct"
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : status === "incorrect"
                    ? "border-rose-500/30 bg-rose-500/5"
                    : "border-border bg-muted/15",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-foreground leading-relaxed sm:text-base">
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

              <div className="space-y-2 text-sm pl-1">
                {status === "correct" && (
                  <div className="flex items-start gap-2">
                    <CheckCircle
                      className="size-4 shrink-0 mt-0.5 text-emerald-500"
                      aria-hidden
                    />
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
                      <XCircle
                        className="size-4 shrink-0 mt-0.5 text-rose-500"
                        aria-hidden
                      />
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
                      <CheckCircle
                        className="size-4 shrink-0 mt-0.5 text-emerald-500"
                        aria-hidden
                      />
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
                      <CircleHelp
                        className="size-4 shrink-0 mt-0.5 text-muted-foreground"
                        aria-hidden
                      />
                      <div>
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-0.5">
                          Your answer
                        </span>
                        <span className="italic text-muted-foreground">Not answered</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle
                        className="size-4 shrink-0 mt-0.5 text-emerald-500"
                        aria-hidden
                      />
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

      <div className="mt-4 rounded-lg border border-border bg-muted/10 px-4 py-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span className="text-emerald-500 font-medium">{correctCount} correct</span>
        <span className="text-rose-500 font-medium">{incorrectCount} incorrect</span>
        <span className="font-medium">{unansweredCount} unanswered</span>
        <span className="ml-auto tabular-nums">{cards.length} total questions</span>
      </div>
    </>
  );
}

function QuizResultDownloadButton({
  result,
  className,
}: {
  result: QuizResultSummary;
  className?: string;
}) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadPdf(result);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Button
      variant="default"
      className={cn("h-10 gap-2", className)}
      onClick={handleDownload}
      disabled={downloading}
    >
      <Download className="size-4" aria-hidden />
      {downloading ? "Generating…" : "Download PDF"}
    </Button>
  );
}

/** Full per-card breakdown for team-admin list (no dialog). */
export function QuizResultInlineDetail({ result }: { result: QuizResultSummary }) {
  const cards = result.perCard ?? [];

  return (
    <div className="space-y-4">
      <QuizResultMemberContext result={result} />
      <div className="space-y-3 rounded-lg border border-border/80 bg-muted/10 p-3 sm:p-4">
        <h4 className="text-sm font-semibold text-foreground">Question review</h4>
        <QuizResultPerCardReview cards={cards} />
      </div>
      <div className="flex justify-stretch sm:justify-end">
        <QuizResultDownloadButton result={result} className="w-full sm:w-auto" />
      </div>
    </div>
  );
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

// ─── Shared detail UI (dialog + full page) ───────────────────────────────────

export type QuizResultDetailVariant = "dialog" | "page";

export type QuizResultDetailViewProps = {
  result: QuizResultSummary;
  variant: QuizResultDetailVariant;
  /** When `variant` is `dialog`, called when the user closes the dialog. */
  onClose?: () => void;
};

export function QuizResultDetailView({ result, variant, onClose }: QuizResultDetailViewProps) {
  const tierColor =
    result.percent >= 90
      ? "text-yellow-500"
      : result.percent >= 50
        ? "text-blue-400"
        : "text-purple-400";

  const titleBlock =
    variant === "dialog" ? (
      <DialogHeader className="space-y-1 text-left">
        <DialogTitle className="text-lg font-semibold leading-tight tracking-tight">
          {result.deckName}
        </DialogTitle>
        <DialogDescription className="text-sm">
          Saved {formatDate(result.savedAt)}
        </DialogDescription>
      </DialogHeader>
    ) : (
      <div className="space-y-1">
        <h1 className="text-lg font-semibold leading-tight tracking-tight text-foreground">
          {result.deckName}
        </h1>
        <p className="text-sm text-muted-foreground">Saved {formatDate(result.savedAt)}</p>
      </div>
    );

  const actionButtons = (
    <div className="mt-6 flex flex-col-reverse gap-2 border-t border-border/60 pt-5 sm:flex-row sm:justify-end sm:gap-3">
      {variant === "dialog" ? (
        <Button variant="outline" className="h-10 w-full sm:w-auto" onClick={onClose}>
          Close
        </Button>
      ) : null}
      <QuizResultDownloadButton result={result} className="w-full sm:w-auto" />
    </div>
  );

  const summarySection = (
    <div className="shrink-0 space-y-3 border-b border-border/80 px-4 pt-4 pb-4 sm:space-y-4 sm:px-6 sm:pt-6">
      {titleBlock}

      <QuizResultMemberContext result={result} />

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Score</span>
          <span className={`font-semibold tabular-nums ${tierColor}`}>{result.percent}%</span>
        </div>
        <Progress value={result.percent} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Correct cards</span>
          <span className="font-medium tabular-nums text-foreground">
            {result.correct} / {result.total}
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-border/70 bg-muted/25 px-3 py-3 sm:px-4">
        <div className="grid grid-cols-1 gap-2 text-sm text-muted-foreground sm:grid-cols-3 sm:gap-3">
          <span className="flex items-center gap-1.5">
            <CheckCircle className="size-3.5 shrink-0 text-emerald-500" aria-hidden />
            {result.correct} correct
          </span>
          <span className="flex items-center gap-1.5">
            <XCircle className="size-3.5 shrink-0 text-rose-500" aria-hidden />
            {result.incorrect} incorrect
          </span>
          <span className="flex items-center gap-1.5">
            <CircleHelp className="size-3.5 shrink-0" aria-hidden />
            {result.unanswered} unanswered
          </span>
        </div>
        <p className="mt-2 border-t border-border/50 pt-2 text-xs font-medium tabular-nums text-foreground">
          {result.total} card{result.total !== 1 ? "s" : ""} · {formatClock(result.elapsedSeconds)}
        </p>
      </div>
    </div>
  );

  const reviewSection = (
    <div
      className={cn(
        "px-4 py-4 sm:px-6 sm:py-5",
        variant === "dialog"
          ? "shrink-0 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          : "flex min-h-0 flex-1 flex-col overflow-hidden",
      )}
    >
      <h2 className="mb-3 shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Question review
      </h2>

      <div
        className={cn(
          "rounded-xl border border-border/80 bg-muted/10 p-4 sm:p-5",
          variant === "page" && "flex min-h-0 flex-1 flex-col overflow-y-auto",
        )}
      >
        <QuizResultPerCardReview cards={result.perCard ?? []} />
        {actionButtons}
      </div>
    </div>
  );

  const containerClass =
    variant === "page"
      ? "mx-auto flex min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-card max-h-[min(92vh,calc(100dvh-6rem))]"
      : "flex min-h-0 flex-1 flex-col overflow-hidden";

  const scrollClass =
    variant === "dialog"
      ? "min-h-0 flex-1 overflow-y-auto overscroll-contain"
      : "flex min-h-0 flex-1 flex-col overflow-hidden";

  return (
    <div className={containerClass}>
      <div className={scrollClass}>
        {summarySection}
        {reviewSection}
      </div>
    </div>
  );
}
