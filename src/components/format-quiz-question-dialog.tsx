"use client";

import * as React from "react";
import { ListChecks, Send } from "lucide-react";
import { QuizFormatPreviewButton } from "@/components/quiz-format-preview-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  generateDeckQuizVariantsAction,
  publishDeckQuizFormatsAction,
} from "@/actions/quiz-formats";
import type { QuizFormatsDeckSnapshot } from "@/db/queries/quiz-formats";
import {
  resolveQuizFormats,
  type QuizFormatsSettings,
} from "@/lib/quiz-formats";
import {
  EMPTY_QUIZ_FORMAT_DISTRIBUTION,
  countCardsReadyForQuizFormats,
  explainQuizFormatContentBlock,
  explainQuizFormatReshuffleBlock,
  quizFormatDistributionsEqual,
  validateQuizFormatDistribution,
  type QuizFormatDistribution,
} from "@/lib/quiz-format-assignments";
import type { QuizCardInput } from "@/lib/quiz-questions";
import {
  DEFAULT_TEAM_QUIZ_DURATION_MINUTES,
  MAX_TEAM_QUIZ_DURATION_MINUTES,
  MIN_TEAM_QUIZ_DURATION_MINUTES,
  resolveTeamQuizDurationMinutes,
} from "@/lib/team-quiz-duration";
import { cn } from "@/lib/utils";

function formatsEqual(a: QuizFormatsSettings, b: QuizFormatsSettings): boolean {
  return (
    a.multipleChoice === b.multipleChoice &&
    a.trueFalse === b.trueFalse &&
    a.fillInBlank === b.fillInBlank
  );
}

function aiGenerationStillNeeded(reason: string | null): boolean {
  return Boolean(reason && /Generate AI/i.test(reason));
}

function initialFormats(snapshot: QuizFormatsDeckSnapshot): QuizFormatsSettings {
  return resolveQuizFormats(null, snapshot);
}

function initialDistribution(snapshot: QuizFormatsDeckSnapshot): QuizFormatDistribution {
  if (snapshot.savedDistribution) return { ...snapshot.savedDistribution };
  const formats = initialFormats(snapshot);
  const total = snapshot.eligibleCardCount;
  if (total <= 0) return { ...EMPTY_QUIZ_FORMAT_DISTRIBUTION };
  const next = { ...EMPTY_QUIZ_FORMAT_DISTRIBUTION };
  if (formats.multipleChoice) next.multipleChoice = total;
  else if (formats.trueFalse) next.trueFalse = total;
  else if (formats.fillInBlank) next.fillInBlank = total;
  return next;
}

function defaultDurationMinutes(snapshot: QuizFormatsDeckSnapshot): number {
  if (snapshot.quizDurationMinutes != null) {
    return resolveTeamQuizDurationMinutes(snapshot.quizDurationMinutes);
  }
  const cards = snapshot.eligibleCardCount;
  if (cards <= 25) return DEFAULT_TEAM_QUIZ_DURATION_MINUTES;
  if (cards <= 50) return 20;
  return 30;
}

type FormatQuizQuestionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId: number;
  deckName: string;
  initialSnapshot: QuizFormatsDeckSnapshot;
  /** Live deck cards — used to detect when T/F and FIB compete for the same cards. */
  cards: QuizCardInput[];
  /** Called after formats are published so the prep lobby can refresh. */
  onPublished?: () => void;
};

export function FormatQuizQuestionDialog({
  open,
  onOpenChange,
  deckId,
  deckName,
  initialSnapshot,
  cards,
  onPublished,
}: FormatQuizQuestionDialogProps) {
  const [formats, setFormats] = React.useState(() => initialFormats(initialSnapshot));
  const [publishedFormats, setPublishedFormats] = React.useState(() =>
    initialFormats(initialSnapshot),
  );
  const [distribution, setDistribution] = React.useState(() =>
    initialDistribution(initialSnapshot),
  );
  const [durationMinutes, setDurationMinutes] = React.useState(() =>
    defaultDurationMinutes(initialSnapshot),
  );
  const [publishedDurationMinutes, setPublishedDurationMinutes] = React.useState(() =>
    defaultDurationMinutes(initialSnapshot),
  );
  const [appliedDistribution, setAppliedDistribution] = React.useState<QuizFormatDistribution | null>(
    () => initialSnapshot.savedDistribution,
  );
  const [localReadyCounts, setLocalReadyCounts] = React.useState<ReturnType<
    typeof countCardsReadyForQuizFormats
  > | null>(null);
  const [hasAssignments, setHasAssignments] = React.useState(
    () => initialSnapshot.hasQuizFormatAssignments,
  );
  const [shuffledAt, setShuffledAt] = React.useState(
    () => initialSnapshot.quizFormatShuffledAt,
  );
  const [preferCountChecks, setPreferCountChecks] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const nextFormats = initialFormats(initialSnapshot);
    setFormats(nextFormats);
    setPublishedFormats(nextFormats);
    setDistribution(initialDistribution(initialSnapshot));
    const nextDuration = defaultDurationMinutes(initialSnapshot);
    setDurationMinutes(nextDuration);
    setPublishedDurationMinutes(nextDuration);
    setAppliedDistribution(initialSnapshot.savedDistribution);
    setLocalReadyCounts(null);
    setHasAssignments(initialSnapshot.hasQuizFormatAssignments);
    setShuffledAt(initialSnapshot.quizFormatShuffledAt);
    setPreferCountChecks(false);
    setError(null);
    setStatusMessage(null);
  }, [open, initialSnapshot]);

  const eligibleCardCount = React.useMemo(() => {
    return cards.filter((c) => (c.front ?? "").trim() && (c.back ?? "").trim()).length;
  }, [cards]);

  const formatReadyCounts = React.useMemo(() => {
    if (preferCountChecks && localReadyCounts) return localReadyCounts;
    return countCardsReadyForQuizFormats(cards, formats);
  }, [preferCountChecks, localReadyCounts, cards, formats]);

  const cardsForCheck = preferCountChecks ? undefined : cards;

  const distributionValidation = validateQuizFormatDistribution(
    formats,
    distribution,
    eligibleCardCount,
  );
  const distributionValid = distributionValidation.valid;
  const contentBlockReason = distributionValid
    ? explainQuizFormatContentBlock(
        formats,
        formatReadyCounts,
        distribution,
        cardsForCheck,
      )
    : null;
  const publishBlockReason = distributionValid
    ? explainQuizFormatReshuffleBlock(
        formats,
        formatReadyCounts,
        distribution,
        cardsForCheck,
      )
    : distributionValidation.error;
  const blockReason = contentBlockReason ?? publishBlockReason;
  const aiContentNeeded =
    aiGenerationStillNeeded(contentBlockReason) ||
    aiGenerationStillNeeded(publishBlockReason) ||
    aiGenerationStillNeeded(error);
  const showGenerate = distributionValid && aiContentNeeded;
  const canPublish = distributionValid && publishBlockReason === null;
  const distributionSum =
    distribution.multipleChoice + distribution.trueFalse + distribution.fillInBlank;
  const distributionApplied =
    formatsEqual(formats, publishedFormats) &&
    quizFormatDistributionsEqual(distribution, appliedDistribution) &&
    durationMinutes === publishedDurationMinutes &&
    hasAssignments;
  const draftChanged =
    !formatsEqual(formats, publishedFormats) ||
    !quizFormatDistributionsEqual(distribution, appliedDistribution) ||
    durationMinutes !== publishedDurationMinutes;

  function setFormatField(key: keyof QuizFormatsSettings, value: boolean) {
    setFormats((prev) => {
      const next = { ...prev, [key]: value };
      if (!next.multipleChoice && !next.trueFalse && !next.fillInBlank) {
        return prev;
      }
      return next;
    });
    setPreferCountChecks(false);
    setLocalReadyCounts(null);
    setError(null);
    setStatusMessage(null);
  }

  function setDistributionField(key: keyof QuizFormatDistribution, raw: string) {
    const parsed = raw.trim() === "" ? 0 : Number.parseInt(raw, 10);
    const value = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    setDistribution((prev) => ({ ...prev, [key]: value }));
    setPreferCountChecks(false);
    setError(null);
    setStatusMessage(null);
  }

  function setDurationField(raw: string) {
    const parsed = raw.trim() === "" ? MIN_TEAM_QUIZ_DURATION_MINUTES : Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) return;
    setDurationMinutes(resolveTeamQuizDurationMinutes(parsed));
    setError(null);
    setStatusMessage(null);
  }

  async function generateAi() {
    setGenerating(true);
    setError(null);
    setStatusMessage(null);
    try {
      const result = await generateDeckQuizVariantsAction({
        deckId,
        distribution,
        formats,
      });
      setLocalReadyCounts(result.formatReadyCounts);
      setPreferCountChecks(true);
      if (result.contentReady) {
        setStatusMessage(
          result.generated > 0
            ? `Generated AI content for ${result.generated} card${result.generated === 1 ? "" : "s"}. Click Publish to quiz to apply formats.`
            : "No cards needed generation. Click Publish to quiz to apply formats.",
        );
      } else {
        setStatusMessage(result.contentBlockReason);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate AI quiz sentences.");
    } finally {
      setGenerating(false);
    }
  }

  async function publishToQuiz() {
    setPublishing(true);
    setError(null);
    setStatusMessage(null);
    try {
      const result = await publishDeckQuizFormatsAction({
        deckId,
        formats,
        distribution,
        durationMinutes,
      });
      setPublishedFormats(formats);
      setPublishedDurationMinutes(durationMinutes);
      setHasAssignments(true);
      setAppliedDistribution({ ...distribution });
      setShuffledAt(result.shuffledAt);
      setStatusMessage(
        `Published format mix across ${result.cardCount} card${result.cardCount === 1 ? "" : "s"} · ${durationMinutes} min timer.`,
      );
      onPublished?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not publish quiz formats.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,40rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b border-border px-4 py-4 sm:px-5">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <ListChecks className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            Format Quiz Question
          </DialogTitle>
          <DialogDescription className="text-left">
            Choose question types and how many of each for{" "}
            <span className="font-medium text-foreground">{deckName}</span>. Formats are added to
            the quiz only when you click Publish to quiz.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          <div className="space-y-3 rounded-lg border border-border/80 p-4">
            <p className="font-medium text-foreground">{deckName}</p>
            <div className="space-y-2">
              <FormatCheckboxRow
                id={`study-mc-${deckId}`}
                label="Multiple choice"
                checked={formats.multipleChoice}
                onCheckedChange={(c) => setFormatField("multipleChoice", c)}
              />
              <FormatCheckboxRow
                id={`study-tf-${deckId}`}
                label="True / false"
                checked={formats.trueFalse}
                onCheckedChange={(c) => setFormatField("trueFalse", c)}
              />
              <FormatCheckboxRow
                id={`study-fib-${deckId}`}
                label="Fill in the blank"
                checked={formats.fillInBlank}
                onCheckedChange={(c) => setFormatField("fillInBlank", c)}
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/15 px-3 py-2.5">
              <div className="min-w-0 space-y-0.5">
                <Label
                  htmlFor={`study-quiz-duration-${deckId}`}
                  className="text-sm font-medium text-foreground"
                >
                  Quiz time limit
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Minutes on the clock when you start this deck&apos;s quiz (
                  {MIN_TEAM_QUIZ_DURATION_MINUTES}–{MAX_TEAM_QUIZ_DURATION_MINUTES}).
                </p>
              </div>
              <Input
                id={`study-quiz-duration-${deckId}`}
                type="number"
                inputMode="numeric"
                min={MIN_TEAM_QUIZ_DURATION_MINUTES}
                max={MAX_TEAM_QUIZ_DURATION_MINUTES}
                step={1}
                value={String(durationMinutes)}
                onChange={(e) => setDurationField(e.target.value)}
                className="h-8 w-20 shrink-0 text-right tabular-nums"
                aria-label="Quiz time limit in minutes"
              />
            </div>

            {eligibleCardCount > 0 ? (
              <div className="space-y-2 rounded-md border border-border/60 bg-muted/15 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium text-foreground">Questions per format</p>
                  <p
                    className={cn(
                      "text-xs tabular-nums",
                      distributionValid ? "text-muted-foreground" : "text-destructive",
                    )}
                  >
                    {distributionSum} / {eligibleCardCount} cards
                  </p>
                </div>
                {formats.multipleChoice ? (
                  <FormatCountRow
                    id={`study-mc-count-${deckId}`}
                    label="Multiple choice"
                    value={distribution.multipleChoice}
                    onChange={(v) => setDistributionField("multipleChoice", v)}
                  />
                ) : null}
                {formats.trueFalse ? (
                  <FormatCountRow
                    id={`study-tf-count-${deckId}`}
                    label="True / false"
                    value={distribution.trueFalse}
                    onChange={(v) => setDistributionField("trueFalse", v)}
                  />
                ) : null}
                {formats.fillInBlank ? (
                  <FormatCountRow
                    id={`study-fib-count-${deckId}`}
                    label="Fill in the blank"
                    value={distribution.fillInBlank}
                    onChange={(v) => setDistributionField("fillInBlank", v)}
                  />
                ) : null}
                {!distributionValid ? (
                  <p className="text-xs text-destructive" role="alert">
                    {distributionValidation.error}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Counts must add up to {eligibleCardCount} before generating AI content or
                    publishing.
                  </p>
                )}
                {distributionValid && blockReason ? (
                  <p
                    className={cn(
                      "text-xs",
                      aiContentNeeded ? "text-amber-400/90" : "text-destructive",
                    )}
                    role="status"
                  >
                    {blockReason}
                  </p>
                ) : null}
                {distributionValid && draftChanged && canPublish ? (
                  <p className="text-xs text-amber-400/90" role="status">
                    These formats are not on the quiz yet. Click Publish to quiz to apply them.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Add cards with front and back text before configuring question counts.
              </p>
            )}

            {error && error !== blockReason ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {showGenerate ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={generating || !distributionValid}
                  onClick={() => void generateAi()}
                >
                  {generating ? "Generating…" : "Generate AI quiz sentences"}
                </Button>
              ) : null}
              {distributionValid && (canPublish || distributionApplied) ? (
                <QuizFormatPreviewButton
                  deckId={deckId}
                  deckName={deckName}
                  distribution={distribution}
                />
              ) : null}
              {eligibleCardCount > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  variant={distributionApplied ? "secondary" : "default"}
                  className="gap-1.5"
                  disabled={publishing || !canPublish}
                  onClick={() => void publishToQuiz()}
                >
                  <Send className="h-3.5 w-3.5" aria-hidden />
                  {publishing
                    ? "Publishing…"
                    : distributionApplied
                      ? "Republish to quiz"
                      : "Publish to quiz"}
                </Button>
              ) : null}
            </div>

            {statusMessage ? (
              <p className="text-xs text-muted-foreground">{statusMessage}</p>
            ) : null}
            {shuffledAt && hasAssignments && distributionApplied ? (
              <p className="text-xs text-muted-foreground">
                Published to quiz{" "}
                {new Date(shuffledAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FormatCheckboxRow({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(c) => onCheckedChange(c === true)}
      />
      <Label htmlFor={id} className="cursor-pointer text-sm font-normal">
        {label}
      </Label>
    </div>
  );
}

function FormatCountRow({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id} className="text-sm font-normal text-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={value === 0 ? "" : String(value)}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-20 text-right tabular-nums"
        aria-label={`${label} question count`}
      />
    </div>
  );
}

/** Trigger + dialog for Pro Plus / Education Plus personal deck quiz format setup. */
export function FormatQuizQuestionButton({
  deckId,
  deckName,
  snapshot,
  cards,
  onPublished,
}: {
  deckId: number;
  deckName: string;
  snapshot: QuizFormatsDeckSnapshot;
  cards: QuizCardInput[];
  onPublished?: () => void;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="default"
        className="w-full gap-2 sm:w-auto"
        onClick={() => setOpen(true)}
      >
        <ListChecks className="h-4 w-4" aria-hidden />
        Format Quiz Question
      </Button>
      <FormatQuizQuestionDialog
        open={open}
        onOpenChange={setOpen}
        deckId={deckId}
        deckName={deckName}
        initialSnapshot={snapshot}
        cards={cards}
        onPublished={onPublished}
      />
    </>
  );
}
