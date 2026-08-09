"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  addLiveClassroomRemediationCardsToDeckAction,
  generateLiveClassroomRemediationQuestionsAction,
  type LiveClassroomRemediationQuestion,
  type LiveClassroomRemediationSuggestions,
} from "@/actions/live-classroom-remediation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { LiveClassroomReportStats } from "@/lib/live-classroom-types";

type LiveClassroomReportActionsProps = {
  sessionId: number;
  teamId: number;
  sessionName: string;
  stats: LiveClassroomReportStats;
  /** Remediation deck generation is owner-only. */
  isOwner: boolean;
};

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function LiveClassroomReportActions({
  sessionId,
  sessionName,
  stats,
  isOwner,
}: LiveClassroomReportActionsProps) {
  const safeName = sessionName.replace(/[^\w\-]+/g, "_").slice(0, 64);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generating, startGenerating] = useTransition();
  const [adding, startAdding] = useTransition();
  const [suggestions, setSuggestions] =
    useState<LiveClassroomRemediationSuggestions | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const itemRefs = useRef<Array<HTMLLabelElement | null>>([]);

  function focusItem(index: number) {
    const el = itemRefs.current[index];
    if (el) {
      el.focus();
      el.scrollIntoView({ block: "nearest" });
    }
  }

  function handleItemKeyDown(
    e: React.KeyboardEvent<HTMLLabelElement>,
    index: number,
  ) {
    const count = suggestions?.questions.length ?? 0;
    if (count === 0) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusItem(Math.min(index + 1, count - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        focusItem(Math.max(index - 1, 0));
        break;
      case "Home":
        e.preventDefault();
        focusItem(0);
        break;
      case "End":
        e.preventDefault();
        focusItem(count - 1);
        break;
      case " ":
      case "Enter":
        e.preventDefault();
        toggle(index);
        break;
      default:
        break;
    }
  }

  function exportJsonAsPdfProxy() {
    // Structured text export — printable PDF generation can reuse teacher PDF pipeline later.
    const lines = [
      `Live Classroom™ Report`,
      `Session: ${sessionName}`,
      `Attendance: ${stats.attendance}`,
      `Accuracy: ${stats.accuracyPercent}%`,
      `Avg response: ${stats.averageResponseTimeSec}s`,
      `Strongest: ${stats.strongestTopic ?? "—"}`,
      `Weakest: ${stats.weakestTopic ?? "—"}`,
      "",
      "AI Summary",
      stats.aiTeacherSummary,
      "",
      "Recommendations",
      ...stats.recommendations.map((r) => `- ${r}`),
    ];
    downloadText(`${safeName}-report.txt`, lines.join("\n"), "text/plain");
    toast.success("Report exported (printable text)");
  }

  function exportExcelCsv() {
    const rows = [
      ["Type", "Name", "Score/Correct", "Accuracy%", "AvgResponseSec"],
      ...stats.teamStats.map((t) => [
        "team",
        t.teamName,
        String(t.score),
        String(t.accuracyPercent),
        String(t.avgResponseTimeSec),
      ]),
      ...stats.individualStats.map((p) => [
        "individual",
        p.displayName,
        `${p.correct}/${p.correct + p.incorrect}`,
        String(p.accuracyPercent),
        String(p.avgResponseTimeSec),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    downloadText(`${safeName}-report.csv`, csv, "text/csv");
    toast.success("Excel-compatible CSV exported");
  }

  function openRemediationDialog() {
    setDialogOpen(true);
    setSuggestions(null);
    setChecked(new Set());
    startGenerating(async () => {
      try {
        const result = await generateLiveClassroomRemediationQuestionsAction(
          sessionId,
        );
        setSuggestions(result);
        setChecked(new Set(result.questions.map((_, i) => i)));
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not generate questions",
        );
        setDialogOpen(false);
      }
    });
  }

  function toggle(index: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else if (suggestions && next.size < suggestions.remainingDeckSlots) {
        next.add(index);
      } else if (suggestions) {
        toast.error(
          `Only ${suggestions.remainingDeckSlots} more card${
            suggestions.remainingDeckSlots !== 1 ? "s" : ""
          } fit in this deck.`,
        );
      }
      return next;
    });
  }

  function addSelected() {
    if (!suggestions) return;
    const selected: LiveClassroomRemediationQuestion[] = suggestions.questions
      .filter((_, i) => checked.has(i))
      .map((q) => ({
        front: q.front,
        back: q.back,
        distractors: q.distractors,
      }));
    if (selected.length === 0) {
      toast.error("Check at least one question to add.");
      return;
    }
    startAdding(async () => {
      try {
        const result = await addLiveClassroomRemediationCardsToDeckAction({
          sessionId,
          deckId: suggestions.deckId,
          cards: selected,
        });
        toast.success(
          `Added ${result.added} card${result.added !== 1 ? "s" : ""} to "${suggestions.deckName}"`,
        );
        setDialogOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not add cards");
      }
    });
  }

  return (
    <>
      <Card className="border-border/80 bg-card/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Report actions</CardTitle>
          <CardDescription>
            Export this report, or build a remediation deck targeting the
            weakest topic from this battle.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {isOwner ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={openRemediationDialog}
            >
              <Sparkles className="size-3.5" aria-hidden />
              Create Remediation Deck
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={exportJsonAsPdfProxy}>
            Export PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportExcelCsv}>
            Export Excel
          </Button>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="grid-rows-[auto_1fr_auto] max-h-[85vh] max-w-lg overflow-hidden sm:max-w-lg">
          <DialogHeader className="min-h-0">
            <DialogTitle>Create Remediation Deck</DialogTitle>
            <DialogDescription>
              AI-generated multiple-choice questions targeting this battle’s
              weakest topic. Check the ones you want to add to{" "}
              {suggestions ? `"${suggestions.deckName}"` : "the deck"}.
            </DialogDescription>
          </DialogHeader>

          {generating ? (
            <div className="flex min-h-0 flex-col items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin" aria-hidden />
              Generating questions from the weakest topic…
            </div>
          ) : suggestions ? (
            <div className="flex min-h-0 flex-col gap-3">
              <p className="shrink-0 text-xs text-muted-foreground">
                {suggestions.existingCount} / {suggestions.deckCardLimit} cards
                in this deck · {suggestions.remainingDeckSlots} slot
                {suggestions.remainingDeckSlots !== 1 ? "s" : ""} left ·{" "}
                {checked.size} selected
              </p>
              <ScrollArea className="min-h-0 flex-1 rounded-md border border-border/50">
                <div className="divide-y divide-border/50" role="listbox">
                  {suggestions.questions.map((q, i) => (
                    <label
                      key={i}
                      ref={(el) => {
                        itemRefs.current[i] = el;
                      }}
                      tabIndex={0}
                      role="option"
                      aria-selected={checked.has(i)}
                      onKeyDown={(e) => handleItemKeyDown(e, i)}
                      className="flex cursor-pointer items-start gap-2.5 px-3 py-2.5 text-sm outline-none hover:bg-muted/40 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
                    >
                      <Checkbox
                        checked={checked.has(i)}
                        onCheckedChange={() => toggle(i)}
                        tabIndex={-1}
                        className="mt-0.5"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-foreground">
                          {q.front}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          Answer: {q.back}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
              <p className="shrink-0 text-[11px] text-muted-foreground">
                Use ↑ / ↓ to navigate, Space to check/uncheck.
              </p>
            </div>
          ) : null}

          <DialogFooter className="shrink-0">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={adding}
            >
              Cancel
            </Button>
            <Button
              onClick={addSelected}
              disabled={!suggestions || generating || adding || checked.size === 0}
            >
              {adding ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  Adding…
                </>
              ) : (
                `Add ${checked.size || ""} to deck`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
