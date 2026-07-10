"use client";

import * as React from "react";
import { Eye, Loader2, Pencil, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import {
  previewDeckQuizFormatsAction,
  saveQuizFormatVariantEditAction,
} from "@/actions/quiz-formats";
import type { QuizFormatDistribution } from "@/lib/quiz-format-assignments";
import {
  formatPreviewTypeLabel,
  segmentsFromPreviewFillInBlank,
  type QuizFormatPreviewItem,
} from "@/lib/quiz-format-preview";
import { cn } from "@/lib/utils";

type QuizFormatPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId: number;
  teamId: number;
  deckName: string;
  distribution: QuizFormatDistribution;
};

function QuizPreviewText({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="max-h-[min(24rem,50vh)] overflow-y-auto overflow-x-hidden rounded-md border border-border/70 bg-muted/25 p-4 text-sm leading-relaxed whitespace-pre-wrap break-words text-foreground">
        {children}
      </div>
    </div>
  );
}

function autoTextareaRows(text: string, min = 4, max = 14): number {
  const lines = text.split("\n").length;
  const wrapped = Math.ceil(text.length / 72);
  return Math.min(max, Math.max(min, lines, wrapped));
}

function McqOptionsList({
  options,
}: {
  options: { text: string; isCorrect: boolean }[];
}) {
  if (options.length === 0) return null;
  return (
    <div className="space-y-1 rounded-md border border-border/60 bg-muted/20 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Original MCQ options (preserved)
      </p>
      <ul className="space-y-1 text-sm">
        {options.map((opt, index) => (
          <li key={`${index}-${opt.text}`} className="flex gap-2">
            <span className="text-muted-foreground">{String.fromCharCode(65 + index)}.</span>
            <span className={cn(opt.isCorrect && "font-medium text-foreground")}>
              {opt.text}
              {opt.isCorrect ? " (correct)" : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PreviewItemCard({
  item,
  deckId,
  teamId,
  onSaved,
}: {
  item: QuizFormatPreviewItem;
  deckId: number;
  teamId: number;
  onSaved: () => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [tfStatement, setTfStatement] = React.useState(item.trueFalse?.statement ?? "");
  const [tfCorrect, setTfCorrect] = React.useState(item.trueFalse?.correctAnswer ?? true);
  const [fibPrompt, setFibPrompt] = React.useState(item.fillInBlank?.promptText ?? "");
  const [fibAnswers, setFibAnswers] = React.useState(
    item.fillInBlank?.acceptedAnswers.join(", ") ?? "",
  );

  React.useEffect(() => {
    setTfStatement(item.trueFalse?.statement ?? "");
    setTfCorrect(item.trueFalse?.correctAnswer ?? true);
    setFibPrompt(item.fillInBlank?.promptText ?? "");
    setFibAnswers(item.fillInBlank?.acceptedAnswers.join(", ") ?? "");
    setEditing(false);
  }, [item]);

  async function handleSave() {
    setSaving(true);
    try {
      const payload: Parameters<typeof saveQuizFormatVariantEditAction>[0] = {
        deckId,
        teamId,
        cardId: item.cardId,
      };

      if (item.formatType === "true_false") {
        payload.trueFalse = {
          statement: tfStatement.trim(),
          correctAnswer: tfCorrect,
        };
      } else if (item.formatType === "fill_in_blank") {
        const segments = segmentsFromPreviewFillInBlank(
          fibPrompt,
          fibAnswers.split(",").map((a) => a.trim()),
        );
        if (!segments) {
          throw new Error("Fill-in-the-blank must include ___ and at least one accepted answer.");
        }
        payload.fillInBlank = { segments };
      }

      await saveQuizFormatVariantEditAction(payload);
      toast.success("Quiz format saved. Original MCQ on the card is unchanged.");
      setEditing(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-border/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {formatPreviewTypeLabel(item.formatType)}
        </p>
        {item.editable ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={saving || Boolean(item.buildError)}
            onClick={() => setEditing((v) => !v)}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            {editing ? "Cancel edit" : "Edit"}
          </Button>
        ) : null}
      </div>

      {item.buildError ? (
        <p className="text-sm text-destructive">{item.buildError}</p>
      ) : null}

      {item.formatType === "multiple_choice" && item.multipleChoice ? (
        <div className="space-y-3">
          <QuizPreviewText label="What quiz takers see">
            {item.multipleChoice.question}
          </QuizPreviewText>
          <ul className="space-y-1 rounded-md border border-border/60 bg-muted/20 p-3 text-sm">
            {item.multipleChoice.options.map((opt, index) => (
              <li key={`${index}-${opt}`} className="break-words">
                {String.fromCharCode(65 + index)}. {opt}
                {index === item.multipleChoice!.correctIndex ? " ✓" : ""}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Multiple-choice uses the card&apos;s stored options. Edit the card on the deck page to
            change the original.
          </p>
        </div>
      ) : null}

      {item.formatType === "true_false" ? (
        editing ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor={`tf-${item.cardId}`}>Statement (what quiz takers see)</Label>
              <Textarea
                id={`tf-${item.cardId}`}
                value={tfStatement}
                onChange={(e) => setTfStatement(e.target.value)}
                rows={autoTextareaRows(tfStatement)}
                className="min-h-[120px] resize-y whitespace-pre-wrap break-words"
              />
            </div>
            <div className="space-y-2">
              <Label>Correct answer</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={tfCorrect ? "default" : "outline"}
                  onClick={() => setTfCorrect(true)}
                >
                  True
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={!tfCorrect ? "default" : "outline"}
                  onClick={() => setTfCorrect(false)}
                >
                  False
                </Button>
              </div>
            </div>
          </div>
        ) : item.trueFalse ? (
          <div className="space-y-2">
            <QuizPreviewText label="What quiz takers see">
              {item.trueFalse.statement}
            </QuizPreviewText>
            <p className="text-sm text-muted-foreground">
              Answer: {item.trueFalse.correctAnswer ? "True" : "False"}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No T/F content yet — generate AI first.</p>
        )
      ) : null}

      {item.formatType === "fill_in_blank" ? (
        editing ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor={`fib-${item.cardId}`}>Prompt (what quiz takers see — use ___ for the blank)</Label>
              <Textarea
                id={`fib-${item.cardId}`}
                value={fibPrompt}
                onChange={(e) => setFibPrompt(e.target.value)}
                rows={autoTextareaRows(fibPrompt, 5, 16)}
                className="min-h-[120px] resize-y whitespace-pre-wrap break-words"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`fib-ans-${item.cardId}`}>Accepted answers (comma-separated)</Label>
              <Input
                id={`fib-ans-${item.cardId}`}
                value={fibAnswers}
                onChange={(e) => setFibAnswers(e.target.value)}
              />
            </div>
          </div>
        ) : item.fillInBlank ? (
          <div className="space-y-2">
            <QuizPreviewText label="What quiz takers see">
              {item.fillInBlank.promptText}
            </QuizPreviewText>
            <p className="text-sm text-muted-foreground">
              Answer: {item.fillInBlank.acceptedAnswers.join(" / ")}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No FIB content yet — generate AI first.</p>
        )
      ) : null}

      {item.originalQuestion ? (
        <details className="rounded-md border border-border/50 bg-muted/10 px-3 py-2 text-sm">
          <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Original card question (preserved for reformatting)
          </summary>
          <p className="mt-2 break-words whitespace-pre-wrap text-muted-foreground">
            {item.originalQuestion}
          </p>
        </details>
      ) : null}

      <McqOptionsList options={item.mcqOptions} />

      {editing ? (
        <Button
          type="button"
          size="sm"
          className="gap-1.5"
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Save className="h-3.5 w-3.5" aria-hidden />
          )}
          Save for quiz
        </Button>
      ) : null}
    </div>
  );
}

export function QuizFormatPreviewDialog({
  open,
  onOpenChange,
  deckId,
  teamId,
  deckName,
  distribution,
}: QuizFormatPreviewDialogProps) {
  const [loading, setLoading] = React.useState(false);
  const [items, setItems] = React.useState<QuizFormatPreviewItem[]>([]);
  const [usesPublished, setUsesPublished] = React.useState(true);
  const [error, setError] = React.useState("");

  const loadPreview = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await previewDeckQuizFormatsAction({
        deckId,
        teamId,
        distribution,
      });
      setItems(result.items);
      setUsesPublished(result.usesPublishedAssignments);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load preview.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [deckId, teamId, distribution]);

  React.useEffect(() => {
    if (open) {
      void loadPreview();
    }
  }, [open, loadPreview]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(92vh,56rem)] max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-6xl flex-col gap-0 overflow-hidden p-5 sm:max-w-6xl">
        <DialogHeader className="shrink-0 pb-4">
          <DialogTitle>Quiz format preview — {deckName}</DialogTitle>
          <DialogDescription>
            Review how each card will appear in the quiz. Edits save only the quiz format (T/F or
            FIB) on this card — the original question and MCQ options stay unchanged for future
            reformatting.
            {!usesPublished && items.length > 0 ? (
              <span className="mt-2 block text-amber-400/90">
                Draft preview: card-to-format mapping is finalized when you publish to quiz.
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              Loading preview…
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-destructive">{error}</p>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No preview items.</p>
          ) : (
            <div className="space-y-4 pb-4">
              {items.map((item) => (
                <PreviewItemCard
                  key={`${item.cardId}-${item.formatType}`}
                  item={item}
                  deckId={deckId}
                  teamId={teamId}
                  onSaved={() => void loadPreview()}
                />
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function QuizFormatPreviewButton({
  deckId,
  teamId,
  deckName,
  distribution,
  disabled,
}: {
  deckId: number;
  teamId: number;
  deckName: string;
  distribution: QuizFormatDistribution;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-1.5"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Eye className="h-3.5 w-3.5" aria-hidden />
        Preview
      </Button>
      <QuizFormatPreviewDialog
        open={open}
        onOpenChange={setOpen}
        deckId={deckId}
        teamId={teamId}
        deckName={deckName}
        distribution={distribution}
      />
    </>
  );
}
