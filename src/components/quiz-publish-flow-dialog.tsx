"use client";

import * as React from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import {
  listDeckQuizSelectableCardsAction,
  publishSelectedDeckQuizCardsAction,
  reshuffleDeckQuizFormatAssignmentsAction,
} from "@/actions/quiz-formats";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  distributionForQuizSize,
  quizFormatDistributionSum,
  type QuizFormatDistribution,
} from "@/lib/quiz-format-assignments";
import type { QuizFormatsSettings } from "@/lib/quiz-formats";
import {
  formatPreviewTypeLabel,
  type QuizFormatPreviewItem,
} from "@/lib/quiz-format-preview";
import { cn } from "@/lib/utils";

type PublishMode = "all" | "choose";
type Step = "mode" | "count" | "select";

export type QuizPublishFlowResult = {
  shuffledAt: string;
  cardCount: number;
  distribution: QuizFormatDistribution;
  mode: PublishMode;
};

type QuizPublishFlowDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId: number;
  teamId: number;
  deckName: string;
  eligibleCardCount: number;
  formats: QuizFormatsSettings;
  distribution: QuizFormatDistribution;
  onPublished: (result: QuizPublishFlowResult) => void;
};

function SelectablePreviewCard({
  item,
  checked,
  disabled,
  onCheckedChange,
}: {
  item: QuizFormatPreviewItem;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const quizTakerText =
    item.formatType === "multiple_choice"
      ? item.multipleChoice?.question
      : item.formatType === "true_false"
        ? item.trueFalse?.statement
        : item.fillInBlank?.promptText;

  return (
    <div
      className={cn(
        "space-y-3 rounded-lg border p-4 transition-colors",
        checked ? "border-sky-500/50 bg-sky-500/5" : "border-border/80",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {formatPreviewTypeLabel(item.formatType)}
        </p>
        <div className="flex items-center gap-2">
          <Checkbox
            id={`quiz-pick-${item.cardId}`}
            checked={checked}
            disabled={disabled && !checked}
            onCheckedChange={(value) => onCheckedChange(value === true)}
          />
          <Label
            htmlFor={`quiz-pick-${item.cardId}`}
            className="cursor-pointer text-sm font-normal"
          >
            Include in quiz
          </Label>
        </div>
      </div>

      {item.buildError ? (
        <p className="text-sm text-destructive">{item.buildError}</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-sky-400/90">
            What quiz takers see
          </p>
          <div className="rounded-md border border-sky-500/40 bg-sky-500/10 p-4 text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground">
            {quizTakerText?.trim() || item.originalQuestion || "—"}
          </div>
          {item.formatType === "multiple_choice" && item.multipleChoice ? (
            <ul className="space-y-1 rounded-md border border-sky-500/30 bg-sky-500/5 p-3 text-sm">
              {item.multipleChoice.options.map((opt, index) => (
                <li key={`${index}-${opt}`} className="break-words">
                  {String.fromCharCode(65 + index)}. {opt}
                  {index === item.multipleChoice!.correctIndex ? " ✓" : ""}
                </li>
              ))}
            </ul>
          ) : null}
          {item.formatType === "true_false" && item.trueFalse ? (
            <p className="text-sm text-muted-foreground">
              Answer: {item.trueFalse.correctAnswer ? "True" : "False"}
            </p>
          ) : null}
          {item.formatType === "fill_in_blank" && item.fillInBlank ? (
            <p className="text-sm text-muted-foreground">
              Answer: {item.fillInBlank.acceptedAnswers.join(" / ")}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function QuizPublishFlowDialog({
  open,
  onOpenChange,
  deckId,
  teamId,
  deckName,
  eligibleCardCount,
  formats,
  distribution,
  onPublished,
}: QuizPublishFlowDialogProps) {
  const distributionSum = quizFormatDistributionSum(distribution);
  const defaultLimit = Math.min(
    Math.max(distributionSum > 0 ? distributionSum : eligibleCardCount, 1),
    Math.max(eligibleCardCount, 1),
  );

  const [step, setStep] = React.useState<Step>("mode");
  const [mode, setMode] = React.useState<PublishMode>("all");
  const [limitInput, setLimitInput] = React.useState(String(defaultLimit));
  const [quizCardLimit, setQuizCardLimit] = React.useState(defaultLimit);
  const [workingDistribution, setWorkingDistribution] =
    React.useState<QuizFormatDistribution>(distribution);
  const [items, setItems] = React.useState<QuizFormatPreviewItem[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
  const [loading, setLoading] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setStep("mode");
    setMode("all");
    setLimitInput(String(defaultLimit));
    setQuizCardLimit(defaultLimit);
    setWorkingDistribution(distribution);
    setItems([]);
    setSelectedIds(new Set());
    setLoading(false);
    setPublishing(false);
    setError("");
  }, [open, defaultLimit, distribution]);

  async function publishAll() {
    setPublishing(true);
    setError("");
    try {
      const result = await reshuffleDeckQuizFormatAssignmentsAction({
        deckId,
        teamId,
        distribution,
      });
      onPublished({
        shuffledAt: result.shuffledAt,
        cardCount: result.cardCount,
        distribution,
        mode: "all",
      });
      onOpenChange(false);
      toast.success(
        `Published ${result.cardCount} card${result.cardCount === 1 ? "" : "s"} to quiz.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not publish to quiz.");
    } finally {
      setPublishing(false);
    }
  }

  async function continueFromMode() {
    if (mode === "all") {
      await publishAll();
      return;
    }
    setStep("count");
    setError("");
  }

  async function continueFromCount() {
    const parsed = Number.parseInt(limitInput, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setError("Enter how many cards should appear in the quiz.");
      return;
    }
    if (parsed > eligibleCardCount) {
      setError(`This deck only has ${eligibleCardCount} eligible cards.`);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await listDeckQuizSelectableCardsAction({
        deckId,
        teamId,
        quizCardLimit: parsed,
        distribution,
      });
      setQuizCardLimit(result.quizCardLimit);
      setWorkingDistribution(result.distribution);
      setItems(result.items);
      setSelectedIds(new Set());
      setStep("select");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load cards.");
    } finally {
      setLoading(false);
    }
  }

  function toggleCard(cardId: number, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        if (next.size >= quizCardLimit) return prev;
        next.add(cardId);
      } else {
        next.delete(cardId);
      }
      return next;
    });
  }

  async function publishSelected() {
    if (selectedIds.size !== quizCardLimit) {
      setError(`Select exactly ${quizCardLimit} card${quizCardLimit === 1 ? "" : "s"}.`);
      return;
    }
    setPublishing(true);
    setError("");
    try {
      const result = await publishSelectedDeckQuizCardsAction({
        deckId,
        teamId,
        cardIds: [...selectedIds],
        quizCardLimit,
        distribution: workingDistribution,
      });
      onPublished({
        shuffledAt: result.shuffledAt,
        cardCount: result.cardCount,
        distribution: result.distribution,
        mode: "choose",
      });
      onOpenChange(false);
      toast.success(
        `Published ${result.cardCount} selected card${result.cardCount === 1 ? "" : "s"} to quiz.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not publish selected cards.");
    } finally {
      setPublishing(false);
    }
  }

  const scaledPreview = distributionForQuizSize(formats, distribution, Number.parseInt(limitInput, 10) || defaultLimit);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-5",
          step === "select"
            ? "h-[min(92vh,56rem)] max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-6xl sm:max-w-6xl"
            : "max-w-lg",
        )}
      >
        <DialogHeader className="shrink-0 pb-4">
          <DialogTitle>
            {step === "mode"
              ? `Publish to quiz — ${deckName}`
              : step === "count"
                ? "How many cards in the quiz?"
                : `Choose cards — ${deckName}`}
          </DialogTitle>
          <DialogDescription>
            {step === "mode"
              ? "Publish every eligible card for your question mix, or choose a specific subset."
              : step === "count"
                ? `This deck has ${eligibleCardCount} eligible card${eligibleCardCount === 1 ? "" : "s"}. Enter how many should appear in the quiz.`
                : `Scroll through cards for the enabled formats and check up to ${quizCardLimit}. Selected ${selectedIds.size} / ${quizCardLimit}.`}
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            "min-h-0",
            step === "select" ? "flex flex-1 flex-col overflow-hidden" : "overflow-y-auto",
          )}
        >
          {step === "mode" ? (
            <RadioGroup
              value={mode}
              onValueChange={(value) => {
                if (value === "all" || value === "choose") setMode(value);
              }}
              className="gap-3"
              aria-label="Publish mode"
            >
              <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/10 px-3 py-2.5">
                <RadioGroupItem value="all" id="quiz-publish-all" className="mt-0.5" />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <Label htmlFor="quiz-publish-all" className="cursor-pointer text-sm font-medium">
                    Publish all cards
                  </Label>
                  <p className="text-xs leading-snug text-muted-foreground">
                    Assign formats across the deck using your Questions per format counts
                    ({distributionSum || eligibleCardCount} card
                    {distributionSum === 1 ? "" : "s"}).
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/10 px-3 py-2.5">
                <RadioGroupItem value="choose" id="quiz-publish-choose" className="mt-0.5" />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <Label
                    htmlFor="quiz-publish-choose"
                    className="cursor-pointer text-sm font-medium"
                  >
                    Choose cards
                  </Label>
                  <p className="text-xs leading-snug text-muted-foreground">
                    Pick how many cards to include, then check the specific cards to publish.
                  </p>
                </div>
              </div>
            </RadioGroup>
          ) : null}

          {step === "count" ? (
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="quiz-card-limit">Cards in quiz</Label>
                <Input
                  id="quiz-card-limit"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={eligibleCardCount}
                  step={1}
                  value={limitInput}
                  onChange={(e) => setLimitInput(e.target.value)}
                  className="w-32 tabular-nums"
                />
                <p className="text-xs text-muted-foreground">
                  Total in deck: {eligibleCardCount}. Format mix will be adjusted to{" "}
                  {Number.parseInt(limitInput, 10) > 0
                    ? `${scaledPreview.multipleChoice} MCQ · ${scaledPreview.trueFalse} T/F · ${scaledPreview.fillInBlank} FIB`
                    : "—"}
                  .
                </p>
              </div>
            </div>
          ) : null}

          {step === "select" ? (
            loading ? (
              <div className="flex flex-1 items-center justify-center gap-2 py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                Loading cards…
              </div>
            ) : items.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No cards are ready for the enabled formats.
              </p>
            ) : items.length < quizCardLimit ? (
              <p className="py-8 text-center text-sm text-destructive" role="alert">
                Only {items.length} card{items.length === 1 ? "" : "s"} ready for the enabled
                formats, but the quiz size is {quizCardLimit}. Lower the card count or generate AI
                content.
              </p>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
                <div className="space-y-4 pb-4">
                  {items.map((item, index) => (
                    <div key={`${item.cardId}-${item.formatType}`} className="space-y-2">
                      <p className="text-xs text-muted-foreground tabular-nums">
                        Card {index + 1} of {items.length}
                      </p>
                      <SelectablePreviewCard
                        item={item}
                        checked={selectedIds.has(item.cardId)}
                        disabled={selectedIds.size >= quizCardLimit}
                        onCheckedChange={(checked) => toggleCard(item.cardId, checked)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : null}
        </div>

        {error ? (
          <p className="shrink-0 pt-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter className="shrink-0 -mx-5 -mb-5 mt-4 border-t px-5 pb-5 pt-4">
          {step === "mode" ? (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="gap-1.5"
                disabled={publishing || eligibleCardCount === 0}
                onClick={() => void continueFromMode()}
              >
                {publishing ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Send className="size-3.5" aria-hidden />
                )}
                {mode === "all"
                  ? publishing
                    ? "Publishing…"
                    : "Publish all"
                  : "Continue"}
              </Button>
            </>
          ) : null}

          {step === "count" ? (
            <>
              <Button type="button" variant="outline" onClick={() => setStep("mode")}>
                Back
              </Button>
              <Button
                type="button"
                disabled={loading}
                onClick={() => void continueFromCount()}
              >
                {loading ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    Loading…
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </>
          ) : null}

          {step === "select" ? (
            <>
              <Button type="button" variant="outline" onClick={() => setStep("count")}>
                Back
              </Button>
              <Button
                type="button"
                className="gap-1.5"
                disabled={publishing || selectedIds.size !== quizCardLimit}
                onClick={() => void publishSelected()}
              >
                {publishing ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Send className="size-3.5" aria-hidden />
                )}
                {publishing ? "Publishing…" : "Publish settings"}
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
