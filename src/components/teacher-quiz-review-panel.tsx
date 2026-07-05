"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TooltipProvider } from "@/components/ui/tooltip";
import { previewTeacherQuizDistractorsAction } from "@/actions/teacher-quiz";
import {
  TeacherHelpBalloon,
  TeacherReviewFieldLabel,
} from "@/components/teacher-field-label";
import { TeacherTooltipButton } from "@/components/teacher-tooltip-button";
import {
  distractorContextForTeacherQuizRow,
  type TeacherQuizReviewRow,
} from "@/lib/teacher-quiz-review";
import { cn } from "@/lib/utils";
import { ArrowUpDown, Loader2, RefreshCw } from "lucide-react";

type QuizContext = {
  subject: string;
  gradeLevel: string;
  topic: string;
  difficultyLevel: string;
};

export function TeacherQuizReviewPanel({
  rows,
  quizContext,
  onRowsChange,
  disabled = false,
}: {
  rows: TeacherQuizReviewRow[];
  quizContext: QuizContext;
  onRowsChange: (rows: TeacherQuizReviewRow[]) => void;
  disabled?: boolean;
}) {
  const hasPassageCards = rows.some((row) => row.isReadingPassage);
  const hasRegularCards = rows.some((row) => !row.isReadingPassage);
  const mixedReview = hasPassageCards && hasRegularCards;
  async function fetchDistractorsForRow(row: TeacherQuizReviewRow) {
    const ctx = distractorContextForTeacherQuizRow(row);
    try {
      const { distractors } = await previewTeacherQuizDistractorsAction({
        ...quizContext,
        ...ctx,
      });
      onRowsChange(
        rows.map((item) =>
          item.id === row.id
            ? { ...item, distractors, distractorsLoading: false }
            : item,
        ),
      );
    } catch {
      onRowsChange(
        rows.map((item) =>
          item.id === row.id ? { ...item, distractorsLoading: false } : item,
        ),
      );
    }
  }

  function queueDistractorRegeneration(row: TeacherQuizReviewRow) {
    queueMicrotask(() => {
      void fetchDistractorsForRow(row);
    });
  }

  function updateRow(
    id: string,
    patch: Partial<
      Pick<
        TeacherQuizReviewRow,
        "front" | "back" | "selected" | "distractorsFromOriginalFront" | "distractorsLoading"
      >
    >,
  ) {
    onRowsChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function updateDistractor(rowId: string, index: 0 | 1 | 2, value: string) {
    onRowsChange(
      rows.map((row) => {
        if (row.id !== rowId) return row;
        const next: [string, string, string] = [...row.distractors] as [
          string,
          string,
          string,
        ];
        next[index] = value;
        return { ...row, distractors: next };
      }),
    );
  }

  function handleDistractorSourceChange(rowId: string, fromOriginalFront: boolean) {
    const target = rows.find((row) => row.id === rowId);
    if (!target) return;
    const updated: TeacherQuizReviewRow = {
      ...target,
      distractorsFromOriginalFront: fromOriginalFront,
      distractorsLoading: true,
    };
    onRowsChange(rows.map((row) => (row.id === rowId ? updated : row)));
    queueDistractorRegeneration(updated);
  }

  function regenerateRowDistractors(rowId: string) {
    const target = rows.find((row) => row.id === rowId);
    if (!target) return;
    const updated: TeacherQuizReviewRow = { ...target, distractorsLoading: true };
    onRowsChange(rows.map((row) => (row.id === rowId ? updated : row)));
    queueDistractorRegeneration(updated);
  }

  function swapRowFrontBack(id: string) {
    const target = rows.find((row) => row.id === id);
    if (!target) return;
    const flipped =
      target.front !== target.originalFront || target.back !== target.originalBack;
    const updated: TeacherQuizReviewRow = {
      ...target,
      front: target.back,
      back: target.front,
      distractorsFromOriginalFront: !flipped,
      distractorsLoading: true,
    };
    onRowsChange(rows.map((row) => (row.id === id ? updated : row)));
    queueDistractorRegeneration(updated);
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-start gap-1.5">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {mixedReview
              ? "Review regular and passage-based quiz cards before saving. Passage cards show a paragraph and question on the front; regular cards use a single question prompt."
              : hasPassageCards
                ? "Review passage-based quiz cards before saving. Each front has a passage and question; the back holds the correct answer with three wrong answers for quiz mode."
                : "Review AI-generated quiz cards before saving. Check the boxes for cards you want in the deck, edit any field, then click Save selected."}
          </p>
          <TeacherHelpBalloon
            label="Quiz card review"
            side="left"
            help={
              <>
                <p className="mb-1 font-semibold">Before you save</p>
                <p>
                  Edit front (question), back (correct answer), and three quiz wrong answers.
                  Use Swap to flip question and answer; wrong answers refresh automatically.
                  Toggle Wrong answers from original front after swap when distractors should
                  match the term or question side.
                </p>
              </>
            }
          />
        </div>

        <div className="max-h-[min(65vh,32rem)] space-y-3 overflow-y-auto pr-1">
          {rows.map((row, index) => {
            const passageCard = row.isReadingPassage === true;
            return (
            <div
              key={row.id}
              className={cn(
                "space-y-2 rounded-lg border p-3",
                row.selected ? "border-primary/40 bg-primary/5" : "border-border opacity-80",
              )}
            >
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={row.selected}
                  onCheckedChange={(checked) =>
                    updateRow(row.id, { selected: checked === true })
                  }
                  aria-label={`Include card ${index + 1}`}
                />
                <span className="text-xs font-medium text-muted-foreground">
                  Card {index + 1}
                  {passageCard ? " · Passage" : mixedReview ? " · Regular" : ""}
                </span>
                <TeacherHelpBalloon
                  label={`Include card ${index + 1}`}
                  side="top"
                  help="Checked cards are saved to your new deck. Uncheck any card you do not want."
                />
              </div>
              <div className="space-y-1.5">
                <TeacherReviewFieldLabel
                  htmlFor={`teacher-quiz-front-${row.id}`}
                  label="Front"
                  help="The question or prompt shown on the front of the flashcard — e.g. “What is a colony?”"
                />
                <Textarea
                  id={`teacher-quiz-front-${row.id}`}
                  value={row.front}
                  onChange={(event) => updateRow(row.id, { front: event.target.value })}
                  rows={passageCard ? 10 : 2}
                  disabled={disabled}
                  className="min-h-[2.5rem] resize-y text-sm"
                />
              </div>
              {!passageCard ? (
                <div className="flex justify-center py-0.5">
                  <TeacherTooltipButton
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    disabled={disabled}
                    onClick={() => swapRowFrontBack(row.id)}
                    aria-label={`Swap front and back for card ${index + 1}`}
                    tooltip="Flip the question and correct answer. Wrong answers regenerate to match the new sides."
                  >
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    Swap
                  </TeacherTooltipButton>
                </div>
              ) : null}
              <div className="space-y-1.5">
                <TeacherReviewFieldLabel
                  htmlFor={`teacher-quiz-back-${row.id}`}
                  label="Back"
                  help="The correct answer saved with this card — e.g. a definition, formula, or short response."
                />
                <Textarea
                  id={`teacher-quiz-back-${row.id}`}
                  value={row.back}
                  onChange={(event) => updateRow(row.id, { back: event.target.value })}
                  rows={3}
                  disabled={disabled}
                  className="min-h-[3rem] resize-y text-sm"
                />
              </div>
              {!passageCard ? (
                <div className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/10 px-2.5 py-2">
                  <Checkbox
                    id={`teacher-quiz-distractor-source-${row.id}`}
                    checked={row.distractorsFromOriginalFront}
                    disabled={disabled || row.distractorsLoading}
                    onCheckedChange={(checked) =>
                      handleDistractorSourceChange(row.id, checked === true)
                    }
                    aria-label={`Use original front style for quiz wrong answers on card ${index + 1}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <Label
                        htmlFor={`teacher-quiz-distractor-source-${row.id}`}
                        className="cursor-pointer text-[11px] font-medium text-foreground"
                      >
                        Wrong answers from original front
                      </Label>
                      <TeacherHelpBalloon
                        label="Wrong answers from original front"
                        side="top"
                        help={
                          <>
                            <p className="mb-1 font-semibold">Off (default)</p>
                            <p className="mb-2">
                              Wrong answers match the original back — other definitions, numbers, or
                              answer lists.
                            </p>
                            <p className="mb-1 font-semibold">On</p>
                            <p>
                              Wrong answers match the original front — other terms, parallel
                              questions like &quot;what is 5+5?&quot;, or short prompts.
                            </p>
                          </>
                        }
                      />
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="space-y-2 rounded-md border border-border/60 bg-muted/5 px-2.5 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <TeacherReviewFieldLabel
                    label="Quiz wrong answers (preview)"
                    help="Three incorrect options stored with the correct answer for multiple-choice quiz mode. All three are required before saving."
                  />
                  <TeacherTooltipButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-[11px]"
                    disabled={disabled || row.distractorsLoading}
                    onClick={() => regenerateRowDistractors(row.id)}
                    tooltip="Ask AI to generate a fresh set of three plausible wrong answers for this card."
                  >
                    {row.distractorsLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    ) : (
                      <RefreshCw className="h-3 w-3" aria-hidden />
                    )}
                    Regenerate
                  </TeacherTooltipButton>
                </div>
                {row.distractorsLoading ? (
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
                    Generating wrong answers…
                  </p>
                ) : null}
                {([0, 1, 2] as const).map((distractorIndex) => (
                  <div key={distractorIndex} className="space-y-1">
                    <TeacherReviewFieldLabel
                      htmlFor={`teacher-quiz-distractor-${row.id}-${distractorIndex}`}
                      label={`Wrong answer ${distractorIndex + 1}`}
                      help="A plausible but incorrect choice shown alongside the correct answer during quiz study."
                    />
                    <Textarea
                      id={`teacher-quiz-distractor-${row.id}-${distractorIndex}`}
                      value={row.distractors[distractorIndex]}
                      onChange={(event) =>
                        updateDistractor(row.id, distractorIndex, event.target.value)
                      }
                      disabled={disabled || row.distractorsLoading}
                      rows={distractorIndex === 0 ? 2 : 1}
                      className="min-h-[2rem] resize-y text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
