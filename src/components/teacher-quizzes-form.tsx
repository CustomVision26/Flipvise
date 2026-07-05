"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { saveTeacherQuizDeckAction, generateTeacherQuizAction } from "@/actions/teacher-quiz";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { buttonVariants, Button } from "@/components/ui/button";
import { TeacherToolPageShell } from "@/components/teacher-tool-page-shell";
import { TeacherFieldLabel } from "@/components/teacher-field-label";
import { TeacherTopicFieldHelpContent } from "@/components/teacher-field-help-content";
import type { SavedLessonPlanPickerItem } from "@/db/queries/saved-lesson-plans";
import type { DeckRow } from "@/db/queries/decks";
import {
  teacherDeckQuotaLabel,
  teacherDeckSectionTitle,
  type TeacherDeckQuota,
} from "@/lib/teacher-deck-quota";
import { buildTeacherSubPath } from "@/lib/teacher-url";
import type { TeacherWorkspaceContext } from "@/lib/teacher-url";
import { LESSON_DIFFICULTY_LEVELS } from "@/lib/lesson-plan-difficulty";
import { lessonPlanInputToQuizDefaults } from "@/lib/lesson-plan-quiz-context";
import {
  TEACHER_QUIZ_DEFAULT_QUESTION_COUNT,
  TEACHER_QUIZ_DEFAULT_QUESTION_TYPE,
} from "@/lib/teacher-quiz-ai-schema";
import {
  teacherQuizMixedResultToReviewRows,
  type TeacherQuizReviewRow,
} from "@/lib/teacher-quiz-review";
import { TeacherQuizReviewPanel } from "@/components/teacher-quiz-review-panel";
import { TeacherTooltipButton } from "@/components/teacher-tooltip-button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SAVED_PLAN_NONE = "__none__";

type QuizDeckFormState = {
  savedLessonPlanId?: number;
  subject: string;
  gradeLevel: string;
  topic: string;
  difficultyLevel: string;
  numberOfCards: string;
};

const EMPTY_FORM: QuizDeckFormState = {
  savedLessonPlanId: undefined,
  subject: "",
  gradeLevel: "",
  topic: "",
  difficultyLevel: "",
  numberOfCards: String(TEACHER_QUIZ_DEFAULT_QUESTION_COUNT),
};

function parseNumberOfCards(value: string, maxCardsPerDeck: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return Math.min(TEACHER_QUIZ_DEFAULT_QUESTION_COUNT, maxCardsPerDeck);
  }
  return Math.min(maxCardsPerDeck, Math.max(1, parsed));
}

function parseOptionalCardCount(value: string, maxCardsPerDeck: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(maxCardsPerDeck, Math.max(0, parsed));
}

function clampCardCountInput(value: string, max: number, min = 0): string {
  if (value === "") return value;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return String(min);
  return String(Math.min(max, Math.max(min, parsed)));
}

function defaultNumberOfCards(maxCardsPerDeck: number): string {
  return String(Math.min(TEACHER_QUIZ_DEFAULT_QUESTION_COUNT, maxCardsPerDeck));
}

export function TeacherQuizzesForm({
  savedLessonPlans,
  initialLessonPlanId,
  decks,
  deckQuota,
  backHref = "/teacher",
  teacherWorkspace,
}: {
  savedLessonPlans: SavedLessonPlanPickerItem[];
  initialLessonPlanId?: number;
  decks: DeckRow[];
  deckQuota: TeacherDeckQuota;
  backHref?: string;
  teacherWorkspace?: TeacherWorkspaceContext;
}) {
  const router = useRouter();
  const [form, setForm] = useState<QuizDeckFormState>(() => ({
    ...EMPTY_FORM,
    numberOfCards: defaultNumberOfCards(deckQuota.maxCardsPerDeck),
  }));
  const [selectedPlanKey, setSelectedPlanKey] = useState<string>(SAVED_PLAN_NONE);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [reviewRows, setReviewRows] = useState<TeacherQuizReviewRow[] | null>(null);
  const [decksExpanded, setDecksExpanded] = useState(true);
  const [showResult, setShowResult] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [readingPassageQuestions, setReadingPassageQuestions] = useState(false);
  const [readingPassageQuestionCount, setReadingPassageQuestionCount] = useState("5");

  function handleSavedPlanChange(value: string | null) {
    if (!value || value === SAVED_PLAN_NONE) {
      setSelectedPlanKey(SAVED_PLAN_NONE);
      setForm((current) => ({
        ...EMPTY_FORM,
        numberOfCards: current.numberOfCards,
      }));
      return;
    }

    const planId = Number(value);
    const plan = savedLessonPlans.find((item) => item.id === planId);
    if (!plan) return;

    const defaults = lessonPlanInputToQuizDefaults(plan.input);
    setSelectedPlanKey(value);
    setForm((current) => ({
      savedLessonPlanId: plan.id,
      subject: defaults.subject,
      gradeLevel: defaults.gradeLevel,
      topic: defaults.topic,
      difficultyLevel: defaults.difficultyLevel,
      numberOfCards: current.numberOfCards,
    }));
  }

  const selectedPlan =
    form.savedLessonPlanId != null
      ? savedLessonPlans.find((plan) => plan.id === form.savedLessonPlanId) ?? null
      : null;

  useEffect(() => {
    if (!initialLessonPlanId) return;
    const exists = savedLessonPlans.some((plan) => plan.id === initialLessonPlanId);
    if (exists) {
      handleSavedPlanChange(String(initialLessonPlanId));
    }
  }, [initialLessonPlanId, savedLessonPlans]);

  async function handleGenerate() {
    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const standardCount = readingPassageQuestions
        ? parseOptionalCardCount(form.numberOfCards, deckQuota.maxCardsPerDeck)
        : parseNumberOfCards(form.numberOfCards, deckQuota.maxCardsPerDeck);
      const passageCount = readingPassageQuestions
        ? parseOptionalCardCount(readingPassageQuestionCount, deckQuota.maxCardsPerDeck)
        : 0;
      const totalCount = standardCount + passageCount;

      if (totalCount < 1) {
        setErrorMessage("Enter at least one regular or passage card to generate.");
        return;
      }
      if (totalCount > deckQuota.maxCardsPerDeck) {
        setErrorMessage(
          `Combined card count cannot exceed ${deckQuota.maxCardsPerDeck} per deck.`,
        );
        return;
      }

      const result = await generateTeacherQuizAction({
        savedLessonPlanId: form.savedLessonPlanId,
        subject: form.subject,
        gradeLevel: form.gradeLevel,
        topic: form.topic,
        difficultyLevel: form.difficultyLevel,
        numberOfQuestions: standardCount,
        questionTypes: TEACHER_QUIZ_DEFAULT_QUESTION_TYPE,
        readingPassageQuestions,
        readingPassageQuestionCount: readingPassageQuestions ? passageCount : undefined,
      });
      setReviewRows(
        teacherQuizMixedResultToReviewRows({
          standardQuestions: result.standardQuestions,
          passageQuestions: result.passageQuestions,
        }),
      );
      setShowResult(true);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Quiz generation failed. Please try again.";
      setErrorMessage(message);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSaveDeck() {
    if (!reviewRows?.length) return;

    const selected = reviewRows.filter(
      (row) => row.selected && row.front.trim() && row.back.trim(),
    );
    if (selected.length === 0) {
      setErrorMessage("Select at least one card with front and back text.");
      return;
    }

    const missingDistractors = selected.some(
      (row) =>
        row.distractorsLoading || row.distractors.some((distractor) => !distractor.trim()),
    );
    if (missingDistractors) {
      setErrorMessage(
        "Fill in all three quiz wrong answers for each selected card before saving.",
      );
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const saved = await saveTeacherQuizDeckAction({
        savedLessonPlanId: form.savedLessonPlanId,
        subject: form.subject,
        gradeLevel: form.gradeLevel,
        topic: form.topic,
        difficultyLevel: form.difficultyLevel,
        teamId: teacherWorkspace?.teamId ?? undefined,
        cards: selected.map((row) => ({
          front: row.front.trim(),
          back: row.back.trim(),
          distractors: row.distractors.map((item) => item.trim()) as [
            string,
            string,
            string,
          ],
        })),
      });
      toast.success("Deck saved", {
        description: (
          <span>
            {saved.deckName} was created with {saved.cardCount} quiz cards. Open it from your{" "}
            <Link href={`/decks/${saved.deckId}`} className="underline underline-offset-2">
              deck
            </Link>{" "}
            or team dashboard.
          </span>
        ),
      });
      setReviewRows(null);
      setShowResult(false);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save deck. Please try again.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  const selectedPlanLabel =
    selectedPlanKey === SAVED_PLAN_NONE
      ? null
      : savedLessonPlans.find((plan) => String(plan.id) === selectedPlanKey)?.lessonTitle;

  const decksSectionTitle = teacherDeckSectionTitle(deckQuota);
  const quotaLabel = teacherDeckQuotaLabel(deckQuota);
  const cannotSaveDeck = deckQuota.atLimit || deckQuota.needsWorkspace;

  const selectedCount = reviewRows?.filter((row) => row.selected).length ?? 0;
  const anyDistractorsLoading =
    reviewRows?.some((row) => row.selected && row.distractorsLoading) ?? false;
  const isBusy = isGenerating || isSaving;

  const parsedStandardCount = readingPassageQuestions
    ? parseOptionalCardCount(form.numberOfCards, deckQuota.maxCardsPerDeck)
    : parseNumberOfCards(form.numberOfCards, deckQuota.maxCardsPerDeck);
  const parsedPassageCount = readingPassageQuestions
    ? parseOptionalCardCount(readingPassageQuestionCount, deckQuota.maxCardsPerDeck)
    : 0;
  const combinedCardCount = parsedStandardCount + parsedPassageCount;
  const maxStandardCount = readingPassageQuestions
    ? Math.max(0, deckQuota.maxCardsPerDeck - parsedPassageCount)
    : deckQuota.maxCardsPerDeck;
  const maxPassageCount = Math.max(0, deckQuota.maxCardsPerDeck - parsedStandardCount);
  const combinedOverLimit = combinedCardCount > deckQuota.maxCardsPerDeck;

  const generateTooltip = combinedOverLimit
    ? `Combined card count cannot exceed ${deckQuota.maxCardsPerDeck} per deck.`
    : readingPassageQuestions && combinedCardCount < 1
      ? "Enter at least one regular or passage card to generate."
      : deckQuota.atLimit
        ? `Deck limit reached — up to ${deckQuota.maxDecks} decks on your plan.`
        : deckQuota.needsWorkspace
          ? "Select a workspace from the header to create team decks."
          : readingPassageQuestions
            ? "AI generates regular and passage quiz cards for review before saving to a deck."
            : "AI generates multiple-choice quiz cards for review before saving to a deck.";

  return (
    <TeacherToolPageShell
      title="AI Quiz/Test Generator"
      description="Create a quiz deck from a saved lesson plan."
      showResult={showResult && reviewRows != null}
      isGenerating={isGenerating}
      generateLabel="AI Generate"
      submittingLabel="Generating…"
      generateWithAiIcon
      generateTooltip={generateTooltip}
      errorMessage={errorMessage}
      onGenerate={handleGenerate}
      submitDisabled={cannotSaveDeck || combinedOverLimit || (readingPassageQuestions && combinedCardCount < 1)}
      backHref={backHref}
      result={
        reviewRows ? (
          <TeacherQuizReviewPanel
            rows={reviewRows}
            quizContext={{
              subject: form.subject,
              gradeLevel: form.gradeLevel,
              topic: form.topic,
              difficultyLevel: form.difficultyLevel,
            }}
            onRowsChange={setReviewRows}
            disabled={isBusy}
          />
        ) : null
      }
      previewActions={
        reviewRows ? (
          <TooltipProvider>
            <TeacherTooltipButton
              type="button"
              variant="outline"
              size="sm"
              disabled={isBusy}
              onClick={() => {
                setReviewRows(null);
                setShowResult(false);
                setErrorMessage(null);
              }}
              tooltip="Return to the quiz form and generate a new set of cards."
            >
              Back
            </TeacherTooltipButton>
            <TeacherTooltipButton
              type="button"
              size="sm"
              disabled={isBusy || selectedCount === 0 || anyDistractorsLoading || cannotSaveDeck}
              onClick={handleSaveDeck}
              tooltip={
                cannotSaveDeck
                  ? deckQuota.needsWorkspace
                    ? `Create an ${deckQuota.planLabel} workspace before saving.`
                    : `Deck limit reached on your ${deckQuota.planLabel} plan.`
                  : selectedCount === 0
                    ? "Select at least one card to save."
                    : anyDistractorsLoading
                      ? "Wait for wrong answers to finish generating."
                      : `Save ${selectedCount} selected card(s) as a new deck with one correct answer and three wrong answers each.`
              }
            >
              {isSaving ? "Saving…" : `Save ${selectedCount} selected`}
            </TeacherTooltipButton>
          </TooltipProvider>
        ) : null
      }
      headerExtra={
        <div className="flex flex-col items-end gap-1 text-right">
          <p className="text-xs font-medium text-muted-foreground">Decks</p>
          <Badge
            variant={deckQuota.atLimit ? "destructive" : "secondary"}
            className="px-3 py-1 text-sm tabular-nums"
          >
            {deckQuota.deckCount} / {deckQuota.maxDecks}
          </Badge>
          <p className="text-xs text-muted-foreground">{quotaLabel}</p>
          <p className="text-xs text-muted-foreground">
            Up to {deckQuota.maxCardsPerDeck} cards per deck
          </p>
        </div>
      }
      footer={
        <>
          <Separator className="bg-border/80" />
          <Card className="border-border/80 bg-card/60">
            <CardHeader className="pb-0">
              <Button
                type="button"
                variant="ghost"
                className="h-auto w-full justify-between gap-3 px-0 py-0 text-left hover:bg-transparent"
                aria-expanded={decksExpanded}
                onClick={() => setDecksExpanded((open) => !open)}
              >
                <CardTitle className="text-base">{decksSectionTitle}</CardTitle>
                {decksExpanded ? (
                  <ChevronUp className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                ) : (
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
              </Button>
            </CardHeader>
            <div
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
                decksExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
              aria-hidden={!decksExpanded}
            >
              <div className="min-h-0 overflow-hidden">
                <CardContent className="space-y-3 pt-4">
                  {decks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No decks yet. Select a saved lesson plan and click AI Generate to create one.
                    </p>
                  ) : (
                    decks.map((deck) => (
                      <div
                        key={deck.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{deck.name}</p>
                          {deck.description ? (
                            <p className="text-sm text-muted-foreground">{deck.description}</p>
                          ) : null}
                        </div>
                        <Link
                          href={`/decks/${deck.id}`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                        >
                          Open Deck
                        </Link>
                      </div>
                    ))
                  )}
                </CardContent>
              </div>
            </div>
          </Card>
        </>
      }
    >
      <TooltipProvider>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <TeacherFieldLabel
              htmlFor="savedLessonPlan"
              label="Saved Lesson Plan (optional)"
              help={
                <>
                  <p className="mb-1 font-semibold">Example:</p>
                  <p>
                    Select a plan saved from the AI Lesson Builder. Subject, grade,
                    topic, and difficulty will auto-fill for your quiz deck.
                  </p>
                </>
              }
            />
          <Select value={selectedPlanKey} onValueChange={handleSavedPlanChange}>
            <SelectTrigger id="savedLessonPlan" className="h-10 w-full bg-background">
              <SelectValue placeholder="Select a saved lesson plan">
                {selectedPlanLabel ?? "No saved lesson plan"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SAVED_PLAN_NONE}>No saved lesson plan</SelectItem>
              {savedLessonPlans.map((plan) => (
                <SelectItem key={plan.id} value={String(plan.id)}>
                  {plan.lessonTitle} ({plan.subject} · {plan.gradeLevel})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {savedLessonPlans.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No saved lesson plans yet. Save one in the{" "}
              <Link
                href={
                  teacherWorkspace
                    ? buildTeacherSubPath(
                        "/lesson-builder",
                        teacherWorkspace.teamId,
                        teacherWorkspace.teamMemberId,
                      )
                    : "/teacher/lesson-builder"
                }
                className="underline underline-offset-2"
              >
                AI Lesson Builder
              </Link>{" "}
              first — input data and the PDF are stored for quiz generation.
            </p>
          ) : null}
          {selectedPlan?.pdfUrl ? (
            <p className="text-xs text-muted-foreground">
              Lesson plan PDF:{" "}
              <a
                href={selectedPlan.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline underline-offset-2"
              >
                View saved PDF
                <ExternalLink className="size-3" aria-hidden />
              </a>
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <TeacherFieldLabel
            htmlFor="subject"
            label="Subject"
            help={
              <>
                <p className="mb-1 font-semibold">Example:</p>
                <p>Mathematics, Science, English Language Arts, Social Studies</p>
              </>
            }
          />
          <Input
            id="subject"
            placeholder="e.g. Mathematics"
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-2">
          <TeacherFieldLabel
            htmlFor="gradeLevel"
            label="Grade Level"
            help={
              <>
                <p className="mb-1 font-semibold">Examples by level:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Primary: Grade 1, Grade 2, Grade 3, Grade 4, Grade 5, Grade 6</li>
                  <li>Secondary: Grade 7, Grade 8, Grade 9, Grade 10, Grade 11</li>
                  <li>Tertiary: Year 1, Year 2, 1st Year College, Undergraduate</li>
                </ul>
              </>
            }
          />
          <Input
            id="gradeLevel"
            placeholder="e.g. Grade 6"
            value={form.gradeLevel}
            onChange={(e) => setForm((f) => ({ ...f, gradeLevel: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <TeacherFieldLabel
            htmlFor="topic"
            label="Topic"
            help={<TeacherTopicFieldHelpContent />}
          />
          <Input
            id="topic"
            placeholder="e.g. Algebra 1"
            value={form.topic}
            onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <TeacherFieldLabel
            htmlFor="difficultyLevel"
            label="Difficulty Level"
            help={
              <>
                <p className="mb-1 font-semibold">Choose the class readiness level:</p>
                <p>
                  Beginner for foundational support; Intermediate for most classes;
                  Advanced for accelerated learners; Honors/Gifted for enrichment groups.
                </p>
              </>
            }
          />
          <Select
            value={form.difficultyLevel}
            onValueChange={(value) => {
              if (value == null) return;
              setForm((f) => ({ ...f, difficultyLevel: value }));
            }}
          >
            <SelectTrigger id="difficultyLevel" className="h-10 w-full bg-background">
              <SelectValue placeholder="Select difficulty" />
            </SelectTrigger>
            <SelectContent>
              {LESSON_DIFFICULTY_LEVELS.filter((level) => level !== "All").map(
                (option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2 sm:max-w-xs">
          <TeacherFieldLabel
            htmlFor="numberOfCards"
            label={readingPassageQuestions ? "Regular quiz cards" : "Number of Cards"}
            help={
              <>
                <p className="mb-1 font-semibold">Example:</p>
                <p>
                  {readingPassageQuestions
                    ? "How many standard multiple-choice cards to include alongside passage cards."
                    : "Enter how many multiple-choice quiz cards to generate for this deck."}{" "}
                  Each deck on your plan holds up to {deckQuota.maxCardsPerDeck} cards total.
                </p>
              </>
            }
          />
          <Input
            id="numberOfCards"
            type="number"
            min={readingPassageQuestions ? 0 : 1}
            max={maxStandardCount}
            value={form.numberOfCards}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                setForm((f) => ({ ...f, numberOfCards: "" }));
                return;
              }
              setForm((f) => ({
                ...f,
                numberOfCards: clampCardCountInput(
                  raw,
                  maxStandardCount,
                  readingPassageQuestions ? 0 : 1,
                ),
              }));
            }}
            onBlur={() => {
              if (readingPassageQuestions) {
                setForm((f) => ({
                  ...f,
                  numberOfCards: String(
                    parseOptionalCardCount(f.numberOfCards, maxStandardCount),
                  ),
                }));
                return;
              }
              setForm((f) => ({
                ...f,
                numberOfCards: String(
                  parseNumberOfCards(f.numberOfCards, deckQuota.maxCardsPerDeck),
                ),
              }));
            }}
            required={!readingPassageQuestions || parsedPassageCount === 0}
          />
          <p className="text-xs text-muted-foreground">
            {readingPassageQuestions
              ? `0–${maxStandardCount} regular cards (combined total ≤ ${deckQuota.maxCardsPerDeck}).`
              : `1–${deckQuota.maxCardsPerDeck} cards per deck on your ${deckQuota.planLabel} plan.`}
          </p>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <div className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/10 px-3 py-2.5">
            <Checkbox
              id="readingPassageQuestions"
              checked={readingPassageQuestions}
              disabled={isBusy}
              onCheckedChange={(checked) => {
                const enabled = checked === true;
                setReadingPassageQuestions(enabled);
                if (enabled) {
                  const regular = parseOptionalCardCount(
                    form.numberOfCards,
                    deckQuota.maxCardsPerDeck,
                  );
                  const remaining = Math.max(0, deckQuota.maxCardsPerDeck - regular);
                  setReadingPassageQuestionCount(
                    String(Math.min(5, remaining)),
                  );
                }
              }}
              aria-label="Include reading passage questions"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <Label
                htmlFor="readingPassageQuestions"
                className="cursor-pointer text-sm font-medium text-foreground"
              >
                Include reading passage + multiple choice
              </Label>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Mix passage cards (short paragraph + question on front) with regular quiz cards.
                Passage backs store the correct answer (step-by-step for math) plus three wrong
                answers for quiz mode.
              </p>
              {readingPassageQuestions ? (
                <div className="space-y-1.5">
                  <Label htmlFor="readingPassageQuestionCount" className="text-xs">
                    Passage quiz cards
                  </Label>
                  <Input
                    id="readingPassageQuestionCount"
                    type="number"
                    min={0}
                    max={maxPassageCount}
                    value={readingPassageQuestionCount}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") {
                        setReadingPassageQuestionCount("");
                        return;
                      }
                      setReadingPassageQuestionCount(
                        clampCardCountInput(raw, maxPassageCount, 0),
                      );
                    }}
                    onBlur={() => {
                      setReadingPassageQuestionCount(
                        String(
                          parseOptionalCardCount(readingPassageQuestionCount, maxPassageCount),
                        ),
                      );
                    }}
                    className="w-full sm:w-28"
                    disabled={isBusy}
                  />
                  <p
                    className={cn(
                      "text-xs",
                      combinedOverLimit ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {parsedStandardCount} regular + {parsedPassageCount} passage ={" "}
                    {combinedCardCount} / {deckQuota.maxCardsPerDeck} cards
                    {combinedOverLimit ? " — reduce one count to continue." : null}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        {deckQuota.needsWorkspace ? (
          <p className="text-sm text-destructive sm:col-span-2" role="status">
            Create an {deckQuota.planLabel} workspace in Team Admin before saving quiz
            decks. Decks for {deckQuota.planLabel} are stored in your team workspace.
          </p>
        ) : deckQuota.atLimit ? (
          <p className="text-sm text-destructive sm:col-span-2" role="status">
            Deck limit reached — up to {deckQuota.maxDecks}{" "}
            {deckQuota.scope === "workspace" ? "workspace" : "personal"} deck(s) on your{" "}
            {deckQuota.planLabel} plan. Remove a deck or upgrade to save more.
          </p>
        ) : null}
      </div>
      </TooltipProvider>
    </TeacherToolPageShell>
  );
}
