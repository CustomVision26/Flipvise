"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, ChevronDown, ChevronUp, Search } from "lucide-react";
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
import type {
  OwnerQuizLessonPlanPickerPayload,
  SavedLessonPlanPickerItem,
  TeamAdminQuizPickerOption,
} from "@/db/queries/saved-lesson-plans";
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
import { getLessonPlanReferenceMaterials } from "@/lib/lesson-plan-reference-material";
import { LessonPlanSavedReferenceSummary } from "@/components/lesson-plan-saved-reference-summary";
import {
  TEACHER_QUIZ_DEFAULT_QUESTION_COUNT,
  TEACHER_QUIZ_DEFAULT_QUESTION_TYPE,
  TEACHER_QUIZ_MAX_PASSAGES,
  activePassageQuestionCounts,
  sumPassageQuestionCounts,
} from "@/lib/teacher-quiz-ai-schema";
import {
  teacherQuizMixedResultToReviewRows,
  type TeacherQuizReviewRow,
} from "@/lib/teacher-quiz-review";
import { TeacherQuizReviewPanel } from "@/components/teacher-quiz-review-panel";
import { TeacherTooltipButton } from "@/components/teacher-tooltip-button";
import { LessonPlanDayScopeDialog } from "@/components/lesson-plan-day-scope-dialog";
import {
  getLessonPlanDayScopeOptions,
  shouldPromptLessonPlanDayScope,
  type LessonPlanDayScope,
} from "@/lib/lesson-plan-day-scope";
import { withTeamWorkspaceQuery } from "@/lib/team-workspace-url";
import {
  formatDeckCardDisplayName,
  formatLessonPlanDayCardLabel,
} from "@/lib/teacher-generation-titles";
import { previewTeacherQuizDeckSaveDestination } from "@/lib/teacher-quiz-deck-save-preview";
import { cn } from "@/lib/utils";
import { ADMIN_NONE, adminDisplayLabel } from "@/lib/owner-team-admin-picker";
import { toast } from "sonner";

const SAVED_PLAN_NONE = "__none__";

function lessonPlanHaystack(plan: SavedLessonPlanPickerItem): string {
  return [
    plan.optionLabel,
    plan.lessonTitle,
    plan.subject,
    plan.gradeLevel,
    plan.topic,
    plan.sourceDeckName,
  ]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ")
    .toLowerCase();
}

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
  ownerPicker,
  initialLessonPlanId,
  decks,
  deckQuota,
  backHref = "/teacher",
  teacherWorkspace,
}: {
  savedLessonPlans: SavedLessonPlanPickerItem[];
  ownerPicker: OwnerQuizLessonPlanPickerPayload;
  initialLessonPlanId?: number;
  decks: DeckRow[];
  deckQuota: TeacherDeckQuota;
  backHref?: string;
  teacherWorkspace?: TeacherWorkspaceContext;
}) {
  const router = useRouter();
  const isWorkspaceOwner = ownerPicker.isWorkspaceOwner;
  const [form, setForm] = useState<QuizDeckFormState>(() => ({
    ...EMPTY_FORM,
    numberOfCards: defaultNumberOfCards(deckQuota.maxCardsPerDeck),
  }));
  const [selectedPlanKey, setSelectedPlanKey] = useState<string>(SAVED_PLAN_NONE);
  const [selectedAdminUserId, setSelectedAdminUserId] = useState<string>(ADMIN_NONE);
  const [lessonPlanSearchQuery, setLessonPlanSearchQuery] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [reviewRows, setReviewRows] = useState<TeacherQuizReviewRow[] | null>(null);
  const [decksExpanded, setDecksExpanded] = useState(true);
  const [showResult, setShowResult] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [readingPassageQuestions, setReadingPassageQuestions] = useState(false);
  const [readingPassageCount, setReadingPassageCount] = useState("1");
  const [passageQuestionCounts, setPassageQuestionCounts] = useState<string[]>(["5"]);
  const [dayScopeDialogOpen, setDayScopeDialogOpen] = useState(false);
  const [generationDayScope, setGenerationDayScope] =
    useState<LessonPlanDayScope>("all");

  function handleSavedPlanChange(
    value: string | null,
    plans: SavedLessonPlanPickerItem[],
  ) {
    if (!value || value === SAVED_PLAN_NONE) {
      setSelectedPlanKey(SAVED_PLAN_NONE);
      setForm((current) => ({
        ...EMPTY_FORM,
        numberOfCards: current.numberOfCards,
      }));
      return;
    }

    const planId = Number(value);
    const plan = plans.find((item) => item.id === planId);
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

  function handleAdminChange(value: string | null) {
    if (!value || value === ADMIN_NONE) {
      setSelectedAdminUserId(ADMIN_NONE);
      setLessonPlanSearchQuery("");
      handleSavedPlanChange(SAVED_PLAN_NONE, []);
      return;
    }

    setSelectedAdminUserId(value);
    setLessonPlanSearchQuery("");
    handleSavedPlanChange(
      SAVED_PLAN_NONE,
      ownerPicker.lessonPlansByAdminUserId[value] ?? [],
    );
  }

  const adminLessonPlans =
    isWorkspaceOwner && selectedAdminUserId !== ADMIN_NONE
      ? ownerPicker.lessonPlansByAdminUserId[selectedAdminUserId] ?? []
      : [];

  const activeLessonPlans = isWorkspaceOwner ? adminLessonPlans : savedLessonPlans;

  const filteredLessonPlans = useMemo(() => {
    const query = lessonPlanSearchQuery.trim().toLowerCase();
    if (!query) return activeLessonPlans;
    return activeLessonPlans.filter((plan) => lessonPlanHaystack(plan).includes(query));
  }, [activeLessonPlans, lessonPlanSearchQuery]);

  const selectedPlan =
    form.savedLessonPlanId != null
      ? activeLessonPlans.find((plan) => plan.id === form.savedLessonPlanId) ?? null
      : null;

  const dayScopeOptions = useMemo(
    () => getLessonPlanDayScopeOptions(selectedPlan?.result),
    [selectedPlan],
  );

  const saveDestination = useMemo(() => {
    const linkedMainDeck =
      selectedPlan?.deckId != null
        ? decks.find((deck) => deck.id === selectedPlan.deckId) ?? null
        : null;
    return previewTeacherQuizDeckSaveDestination({
      savedLessonPlanId: form.savedLessonPlanId,
      dayScope:
        form.savedLessonPlanId != null && dayScopeOptions.length > 0
          ? generationDayScope
          : form.savedLessonPlanId != null
            ? "all"
            : null,
      subject: form.subject,
      topic: form.topic,
      linkedMainDeckId: selectedPlan?.deckId ?? null,
      linkedMainDeckName: linkedMainDeck?.name ?? selectedPlan?.sourceDeckName ?? null,
      sourceDeckName: selectedPlan?.sourceDeckName ?? null,
      decks: decks.map((deck) => ({
        id: deck.id,
        name: deck.name,
        description: deck.description,
      })),
    });
  }, [
    decks,
    dayScopeOptions.length,
    form.savedLessonPlanId,
    form.subject,
    form.topic,
    generationDayScope,
    selectedPlan,
  ]);

  useEffect(() => {
    if (!initialLessonPlanId) return;

    if (isWorkspaceOwner) {
      for (const admin of ownerPicker.teamAdmins) {
        const plans = ownerPicker.lessonPlansByAdminUserId[admin.userId] ?? [];
        if (plans.some((plan) => plan.id === initialLessonPlanId)) {
          setSelectedAdminUserId(admin.userId);
          handleSavedPlanChange(String(initialLessonPlanId), plans);
          return;
        }
      }
      return;
    }

    const exists = savedLessonPlans.some((plan) => plan.id === initialLessonPlanId);
    if (exists) {
      handleSavedPlanChange(String(initialLessonPlanId), savedLessonPlans);
    }
  }, [initialLessonPlanId, savedLessonPlans, isWorkspaceOwner, ownerPicker]);

  function validateGenerateCounts(): {
    standardCount: number;
    passageQuestionCounts: number[];
    passageCount: number;
  } | null {
    const standardCount = readingPassageQuestions
      ? parseOptionalCardCount(form.numberOfCards, deckQuota.maxCardsPerDeck)
      : parseNumberOfCards(form.numberOfCards, deckQuota.maxCardsPerDeck);
    const configuredPassageCount = readingPassageQuestions
      ? parseOptionalCardCount(readingPassageCount, TEACHER_QUIZ_MAX_PASSAGES)
      : 0;
    const perPassageCounts = readingPassageQuestions
      ? passageQuestionCounts
          .slice(0, Math.max(1, configuredPassageCount))
          .map((value) => parseOptionalCardCount(value, deckQuota.maxCardsPerDeck))
      : [];
    while (
      readingPassageQuestions &&
      perPassageCounts.length < Math.max(1, configuredPassageCount)
    ) {
      perPassageCounts.push(0);
    }
    const passageCount = sumPassageQuestionCounts(perPassageCounts);
    const totalCount = standardCount + passageCount;

    if (readingPassageQuestions && activePassageQuestionCounts(perPassageCounts).length < 1) {
      setErrorMessage(
        "Give at least one passage one or more questions, or turn off Include reading passage.",
      );
      return null;
    }
    if (totalCount < 1) {
      setErrorMessage(
        "Enter at least one regular quiz card or one question linked to a reading passage.",
      );
      return null;
    }
    if (totalCount > deckQuota.maxCardsPerDeck) {
      setErrorMessage(
        `Combined card count (regular + passage questions) cannot exceed ${deckQuota.maxCardsPerDeck} per deck.`,
      );
      return null;
    }

    return { standardCount, passageQuestionCounts: perPassageCounts, passageCount };
  }

  async function runGenerate(dayScope: LessonPlanDayScope = "all") {
    const counts = validateGenerateCounts();
    if (!counts) return;

    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const result = await generateTeacherQuizAction({
        savedLessonPlanId: form.savedLessonPlanId,
        subject: form.subject,
        gradeLevel: form.gradeLevel,
        topic: form.topic,
        difficultyLevel: form.difficultyLevel,
        numberOfQuestions: counts.standardCount,
        questionTypes: TEACHER_QUIZ_DEFAULT_QUESTION_TYPE,
        readingPassageQuestions,
        readingPassageCount: readingPassageQuestions
          ? counts.passageQuestionCounts.length
          : undefined,
        readingPassageQuestionCounts: readingPassageQuestions
          ? counts.passageQuestionCounts
          : undefined,
        teamId: teacherWorkspace?.teamId ?? undefined,
        dayScope: form.savedLessonPlanId != null && dayScopeOptions.length > 0
          ? dayScope
          : undefined,
      });
      setGenerationDayScope(dayScope);
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

  async function handleGenerate() {
    setErrorMessage(null);
    if (!validateGenerateCounts()) return;

    if (
      form.savedLessonPlanId != null &&
      shouldPromptLessonPlanDayScope(selectedPlan?.result)
    ) {
      setDayScopeDialogOpen(true);
      return;
    }

    await runGenerate("all");
  }

  function handleDayScopeConfirm(scope: LessonPlanDayScope) {
    setDayScopeDialogOpen(false);
    void runGenerate(scope);
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
        dayScope:
          form.savedLessonPlanId != null && dayScopeOptions.length > 0
            ? generationDayScope
            : undefined,
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
      const openDeckHref = teacherWorkspace?.queryString
        ? withTeamWorkspaceQuery(`/decks/${saved.deckId}`, teacherWorkspace.queryString)
        : `/decks/${saved.deckId}`;
      toast.success(saved.created ? "Deck created" : "Cards saved", {
        description: (
          <span>
            {saved.created
              ? `${saved.deckName} was created with ${saved.cardCount} quiz cards.`
              : `${saved.cardCount} quiz card${saved.cardCount === 1 ? "" : "s"} added to ${saved.deckName}.`}{" "}
            Open it from your{" "}
            <Link href={openDeckHref} className="underline underline-offset-2">
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
      : activeLessonPlans.find((plan) => String(plan.id) === selectedPlanKey)
          ?.optionLabel;

  const selectedAdminLabel =
    selectedAdminUserId === ADMIN_NONE
      ? null
      : ownerPicker.teamAdmins.find((admin) => admin.userId === selectedAdminUserId);

  const selectedCreatorIsWorkspaceOwner = selectedAdminLabel?.isWorkspaceOwner === true;

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
  const parsedPassageCountValue = readingPassageQuestions
    ? Math.max(
        1,
        Math.min(
          TEACHER_QUIZ_MAX_PASSAGES,
          parseOptionalCardCount(readingPassageCount, TEACHER_QUIZ_MAX_PASSAGES) || 1,
        ),
      )
    : 0;
  const parsedPassageQuestionCounts = readingPassageQuestions
    ? Array.from({ length: parsedPassageCountValue }, (_, index) =>
        parseOptionalCardCount(
          passageQuestionCounts[index] ?? "0",
          deckQuota.maxCardsPerDeck,
        ),
      )
    : [];
  const parsedPassageCount = sumPassageQuestionCounts(parsedPassageQuestionCounts);
  const activePassageCount = activePassageQuestionCounts(parsedPassageQuestionCounts).length;
  const combinedCardCount = parsedStandardCount + parsedPassageCount;
  const maxStandardCount = readingPassageQuestions
    ? Math.max(0, deckQuota.maxCardsPerDeck - parsedPassageCount)
    : deckQuota.maxCardsPerDeck;
  const maxPassageQuestionsTotal = Math.max(
    0,
    deckQuota.maxCardsPerDeck - parsedStandardCount,
  );
  const passageBreakdown =
    parsedPassageQuestionCounts.length > 0
      ? parsedPassageQuestionCounts.join("+")
      : "0";
  const combinedOverLimit = combinedCardCount > deckQuota.maxCardsPerDeck;
  const passageModeInvalid =
    readingPassageQuestions && activePassageCount < 1;

  const generateTooltip = combinedOverLimit
    ? `Combined card count (regular + passage questions) cannot exceed ${deckQuota.maxCardsPerDeck} per deck.`
    : passageModeInvalid
      ? "Give at least one passage one or more questions, or turn off Include reading passage."
      : readingPassageQuestions && combinedCardCount < 1
        ? "Enter at least one regular quiz card or one question linked to a reading passage."
        : deckQuota.atLimit
          ? `Deck limit reached — up to ${deckQuota.maxDecks} decks on your plan.`
          : deckQuota.needsWorkspace
            ? "Select a workspace from the header to create team decks."
            : readingPassageQuestions
              ? "AI generates regular quiz cards plus distinct vocabulary-focused reading passages with per-passage comprehension questions for review before saving."
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
      submitDisabled={
        cannotSaveDeck ||
        combinedOverLimit ||
        passageModeInvalid ||
        (readingPassageQuestions && combinedCardCount < 1)
      }
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
            saveDestination={saveDestination}
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
                      : saveDestination.mode === "append"
                        ? `Save ${selectedCount} selected card(s) to ${saveDestination.deckName} with one correct answer and three wrong answers each.`
                        : `Save ${selectedCount} selected card(s) to the new deck ${saveDestination.deckName} with one correct answer and three wrong answers each.`
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
                    decks.map((deck) => {
                      const deckHref = teacherWorkspace?.queryString
                        ? withTeamWorkspaceQuery(
                            `/decks/${deck.id}`,
                            teacherWorkspace.queryString,
                          )
                        : `/decks/${deck.id}`;
                      const displayName = formatDeckCardDisplayName(deck.name);
                      const lessonPlanDayLabel = formatLessonPlanDayCardLabel(
                        deck.description,
                        deck.name,
                      );
                      return (
                      <div
                        key={deck.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 px-4 py-3"
                      >
                        <div className="min-w-0">
                          {lessonPlanDayLabel ? (
                            <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              {lessonPlanDayLabel}
                            </p>
                          ) : null}
                          <p className="font-medium text-foreground">{displayName}</p>
                          {deck.description ? (
                            <p className="text-sm text-muted-foreground">{deck.description}</p>
                          ) : null}
                        </div>
                        <Link
                          href={deckHref}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                        >
                          Open Deck
                        </Link>
                      </div>
                      );
                    })
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
          {isWorkspaceOwner ? (
            <div className="space-y-2 sm:col-span-2">
              <TeacherFieldLabel
                htmlFor="teamAdmin"
                label="Workspace owner or team admin"
                help={
                  <>
                    <p className="mb-1 font-semibold">Workspace owner:</p>
                    <p>
                      Select yourself (workspace owner) or a team admin by name or email,
                      then choose one of their saved lesson plans to auto-fill the quiz fields.
                    </p>
                  </>
                }
              />
              <Select value={selectedAdminUserId} onValueChange={handleAdminChange}>
                <SelectTrigger id="teamAdmin" className="h-10 w-full bg-background">
                  <SelectValue placeholder="Select workspace owner or team admin">
                    {selectedAdminLabel
                      ? adminDisplayLabel(selectedAdminLabel)
                      : "Select workspace owner or team admin"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ADMIN_NONE}>Select workspace owner or team admin</SelectItem>
                  {ownerPicker.teamAdmins.map((admin) => (
                    <SelectItem key={admin.userId} value={admin.userId}>
                      {adminDisplayLabel(admin)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {ownerPicker.teamAdmins.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No team admins in this workspace yet. Invite team admins from Team Admin
                  settings.
                </p>
              ) : null}
            </div>
          ) : null}

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
          {isWorkspaceOwner && selectedAdminUserId === ADMIN_NONE ? (
            <p className="text-sm text-muted-foreground">
              Select the workspace owner or a team admin above to browse their saved lesson
              plans.
            </p>
          ) : (
            <>
              {isWorkspaceOwner && activeLessonPlans.length > 0 ? (
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    value={lessonPlanSearchQuery}
                    onChange={(e) => setLessonPlanSearchQuery(e.target.value)}
                    placeholder="Search lesson plans by title, subject, grade, or topic…"
                    className="pl-9"
                    aria-label="Search lesson plans"
                  />
                </div>
              ) : null}
              <Select
                value={selectedPlanKey}
                onValueChange={(value) => handleSavedPlanChange(value, activeLessonPlans)}
                disabled={isWorkspaceOwner && selectedAdminUserId === ADMIN_NONE}
              >
                <SelectTrigger id="savedLessonPlan" className="h-10 w-full bg-background">
                  <SelectValue placeholder="Select a saved lesson plan">
                    {selectedPlanLabel ?? "No saved lesson plan"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SAVED_PLAN_NONE}>No saved lesson plan</SelectItem>
                  {filteredLessonPlans.map((plan) => (
                    <SelectItem key={plan.id} value={String(plan.id)}>
                      {plan.optionLabel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isWorkspaceOwner &&
              selectedAdminUserId !== ADMIN_NONE &&
              activeLessonPlans.length > 0 &&
              filteredLessonPlans.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No lesson plans match your search.
                </p>
              ) : null}
            </>
          )}
          {!isWorkspaceOwner && savedLessonPlans.length === 0 ? (
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
          {isWorkspaceOwner &&
          selectedAdminUserId !== ADMIN_NONE &&
          activeLessonPlans.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {selectedCreatorIsWorkspaceOwner
                ? "No saved lesson plans yet. Save one in the AI Lesson Builder first."
                : "This team admin has no saved lesson plans yet."}
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
          {selectedPlan ? (
            <LessonPlanSavedReferenceSummary
              references={getLessonPlanReferenceMaterials(selectedPlan.input)}
            />
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
                    ? "How many standard multiple-choice cards to include alongside the per-passage reading questions."
                    : "Enter how many multiple-choice quiz cards to generate for this deck."}{" "}
                  Each deck on your plan holds up to {deckQuota.maxCardsPerDeck} cards total.
                  When reading passages are included, regular cards plus all passage questions
                  must stay within that limit.
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
            required={!readingPassageQuestions || activePassageCount < 1}
          />
          <p className="text-xs text-muted-foreground">
            {readingPassageQuestions
              ? `0–${maxStandardCount} regular cards (regular + passage questions ≤ ${deckQuota.maxCardsPerDeck}).`
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
                  setReadingPassageCount("1");
                  setPassageQuestionCounts([String(Math.min(5, remaining))]);
                }
              }}
              aria-label="Include reading passage"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <Label
                htmlFor="readingPassageQuestions"
                className="cursor-pointer text-sm font-medium text-foreground"
              >
                Include reading passage
              </Label>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Adds one or more short informational reading passages (PEP-style) that teach the
                lesson vocabulary in context — not a summary of classroom activities. Set how many
                questions each passage should get — use 0 to skip a passage row. Only passages
                with at least one question are generated. Each question is saved as its own quiz
                card with that passage on the front; backs store the correct answer plus three
                wrong answers for quiz mode. Total cards must stay within your plan limit.
              </p>
              {readingPassageQuestions ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <TeacherFieldLabel
                      htmlFor="readingPassageCount"
                      label="Number of passages"
                      help={
                        <>
                          <p className="mb-1 font-semibold">Multiple passages</p>
                          <p>
                            Choose how many passage rows to configure (up to{" "}
                            {TEACHER_QUIZ_MAX_PASSAGES}). Then set questions per passage. Rows
                            set to 0 questions are skipped during generation.
                          </p>
                        </>
                      }
                    />
                    <Input
                      id="readingPassageCount"
                      type="number"
                      min={1}
                      max={TEACHER_QUIZ_MAX_PASSAGES}
                      value={readingPassageCount}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") {
                          setReadingPassageCount("");
                          return;
                        }
                        const nextCount = Number.parseInt(
                          clampCardCountInput(raw, TEACHER_QUIZ_MAX_PASSAGES, 1),
                          10,
                        );
                        setReadingPassageCount(String(nextCount));
                        setPassageQuestionCounts((current) => {
                          if (current.length === nextCount) return current;
                          if (current.length < nextCount) {
                            const remainingBudget = Math.max(
                              0,
                              maxPassageQuestionsTotal -
                                sumPassageQuestionCounts(
                                  current.map((value) =>
                                    parseOptionalCardCount(value, deckQuota.maxCardsPerDeck),
                                  ),
                                ),
                            );
                            const defaultForNew =
                              remainingBudget > 0
                                ? String(Math.min(1, remainingBudget))
                                : "0";
                            return [
                              ...current,
                              ...Array.from(
                                { length: nextCount - current.length },
                                () => defaultForNew,
                              ),
                            ];
                          }
                          return current.slice(0, nextCount);
                        });
                      }}
                      onBlur={() => {
                        const nextCount = Math.max(
                          1,
                          parseOptionalCardCount(readingPassageCount, TEACHER_QUIZ_MAX_PASSAGES) ||
                            1,
                        );
                        setReadingPassageCount(String(nextCount));
                        setPassageQuestionCounts((current) => {
                          if (current.length === nextCount) return current;
                          if (current.length < nextCount) {
                            return [
                              ...current,
                              ...Array.from(
                                { length: nextCount - current.length },
                                () => "0",
                              ),
                            ];
                          }
                          return current.slice(0, nextCount);
                        });
                      }}
                      className="w-full sm:w-28"
                      disabled={isBusy}
                    />
                  </div>

                  <div className="space-y-2">
                    {Array.from({ length: parsedPassageCountValue }, (_, index) => {
                      const otherPassageTotal = parsedPassageQuestionCounts.reduce(
                        (sum, count, countIndex) =>
                          countIndex === index ? sum : sum + count,
                        0,
                      );
                      const maxForThisPassage = Math.max(
                        0,
                        deckQuota.maxCardsPerDeck - parsedStandardCount - otherPassageTotal,
                      );
                      const fieldId = `passageQuestionCount-${index + 1}`;
                      return (
                        <div key={fieldId} className="space-y-1">
                          <TeacherFieldLabel
                            htmlFor={fieldId}
                            label={`Passage ${index + 1} — questions`}
                            help={
                              <>
                                <p className="mb-1 font-semibold">Questions for this passage</p>
                                <p>
                                  AI writes a distinct informational passage and this many
                                  comprehension questions about it. Set 0 to skip generating
                                  this passage. Each question counts as one card toward the deck
                                  limit.
                                </p>
                              </>
                            }
                          />
                          <Input
                            id={fieldId}
                            type="number"
                            min={0}
                            max={maxForThisPassage}
                            value={passageQuestionCounts[index] ?? "0"}
                            onChange={(e) => {
                              const raw = e.target.value;
                              setPassageQuestionCounts((current) => {
                                const next = [...current];
                                while (next.length < parsedPassageCountValue) next.push("0");
                                if (raw === "") {
                                  next[index] = "";
                                  return next;
                                }
                                next[index] = clampCardCountInput(raw, maxForThisPassage, 0);
                                return next;
                              });
                            }}
                            onBlur={() => {
                              setPassageQuestionCounts((current) => {
                                const next = [...current];
                                while (next.length < parsedPassageCountValue) next.push("0");
                                next[index] = String(
                                  parseOptionalCardCount(
                                    next[index] ?? "0",
                                    maxForThisPassage,
                                  ),
                                );
                                return next;
                              });
                            }}
                            className="w-full sm:w-28"
                            disabled={isBusy}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <p
                    className={cn(
                      "text-xs",
                      combinedOverLimit || passageModeInvalid
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {parsedStandardCount} regular + ({passageBreakdown}) passage questions ={" "}
                    {combinedCardCount} / {deckQuota.maxCardsPerDeck} cards
                    {combinedOverLimit
                      ? " — reduce one count to continue."
                      : passageModeInvalid
                        ? " — set at least one passage to 1 or more questions."
                        : null}
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

      <LessonPlanDayScopeDialog
        open={dayScopeDialogOpen}
        onOpenChange={setDayScopeDialogOpen}
        options={dayScopeOptions}
        onConfirm={handleDayScopeConfirm}
        confirmLabel="Generate"
        title="Which part of the lesson plan?"
        description="All Days uses the full multi-day plan. A single day uses only that day’s vocabulary, daily focus, and class outline. Quiz cards are generated only from your choice."
      />
    </TeacherToolPageShell>
  );
}
