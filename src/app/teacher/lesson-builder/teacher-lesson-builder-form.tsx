"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, Loader2, Pencil, RefreshCw, Save, X } from "lucide-react";
import {
  generateLessonPlanAction,
  saveLessonPlanAction,
  updateLessonPlanAction,
  keepLessonPlanOnExitAction,
  adaptAssignedLessonPlanToIntakeAction,
  generateAllDaysVocabularyDetailAction,
} from "@/actions/teacher-lesson-plan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  cloneLessonPlanResult,
  LessonPlanPreviewEditor,
} from "@/components/lesson-plan-preview-editor";
import {
  LessonPlanReferenceMaterialFields,
  type LessonPlanReferenceMaterialFieldsHandle,
} from "@/components/lesson-plan-reference-material-fields";
import { getLessonPlanReferenceMaterials } from "@/lib/lesson-plan-reference-material";
import { TeacherToolPageShell } from "@/components/teacher-tool-page-shell";
import { TeacherFieldLabel } from "@/components/teacher-field-label";
import { TeacherTopicFieldHelpContent } from "@/components/teacher-field-help-content";
import {
  OwnerTeamAdminResourcePicker,
  useOwnerScopedItems,
} from "@/components/owner-team-admin-resource-picker";
import type { OwnerTeamAdminDeckPickerPayload } from "@/db/queries/teacher-owner-pickers";
import type { DeckRow } from "@/db/queries/decks";
import { ADMIN_NONE } from "@/lib/owner-team-admin-picker";
import type { TeacherDeckQuota } from "@/lib/teacher-deck-quota";
import { teacherDeckQuotaLabel } from "@/lib/teacher-deck-quota";
import { LESSON_DIFFICULTY_LEVELS } from "@/lib/lesson-plan-difficulty";
import type {
  LessonPlanActionInput,
  VocabularyTeachingApproach,
} from "@/lib/lesson-plan-ai-schema";
import { VOCABULARY_TEACHING_APPROACH_OPTIONS } from "@/lib/lesson-plan-vocabulary-approach";
import {
  DEFAULT_PLAN_PERIOD_DAYS,
  PLAN_PERIOD_DAY_OPTIONS,
  normalizeLessonPlanResultDayLabels,
} from "@/lib/lesson-plan-weekly-schedule";
import {
  downloadLessonPlanPdf,
  downloadLessonPlanVocabularyDetailPdf,
  lessonPlanHasVocabularyDetails,
} from "@/lib/lesson-plan-pdf";
import { attachVocabularyDetailsToSchedule, mergeVocabularyDetailsByDayLabel, scheduleDaysEligibleForVocabularyDetail } from "@/lib/lesson-plan-vocabulary-detail";
import type { LessonPlanInput, LessonPlanResult } from "@/lib/teacher-generators";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  buildTeacherQuizzesPath,
  buildTeacherSubPath,
  type TeacherWorkspaceContext,
} from "@/lib/teacher-url";
import { deckToHomeworkDefaults } from "@/lib/homework-source-context";
import { resolveDeckSubjectAndTopic } from "@/lib/deck-subject-topic";
import { afterOverlayDismiss, dismissOpenOverlays } from "@/lib/dismiss-open-overlays";
import {
  normalizeLessonPlanReferenceMaterial,
  type LessonPlanReferenceMaterial,
} from "@/lib/lesson-plan-reference-material";
import {
  clearDeckEditLessonIntake,
  readDeckEditLessonIntake,
} from "@/lib/deck-edit-lesson-plan-sync";
import {
  buildLessonPlanIntakePreviewDiscrepancies,
  cloneComparableLessonPlanIntake,
  type LessonPlanIntakePreviewDiscrepancy,
} from "@/lib/lesson-plan-intake-preview-discrepancy";
import { isLessonPlanEditorStateDirty } from "@/lib/lesson-plan-similarity";
import {
  BROWSER_BACK_EXIT_HREF,
  proceedAfterDirtyLeaveConfirm,
  useDirtyRouteLeaveGuard,
} from "@/hooks/use-dirty-route-leave-guard";

const DIFFICULTY_LEVEL_OPTIONS = LESSON_DIFFICULTY_LEVELS;
const DECK_NONE = "__none__";

type DeckTargetMode = "existing" | "new";

function CompareValue({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "min-w-0 whitespace-pre-wrap break-words text-xs leading-relaxed",
        className,
      )}
    >
      {value}
    </span>
  );
}

function IntakePreviewDiscrepancyList({
  items,
}: {
  items: LessonPlanIntakePreviewDiscrepancy[];
}) {
  const rows = (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <li
          key={item.field}
          className="grid grid-cols-[minmax(5.5rem,0.9fr)_minmax(0,1.1fr)_minmax(0,1.1fr)] items-start gap-x-3 px-3 py-2.5"
        >
          <span className="min-w-0 break-words text-xs font-medium text-foreground">
            {item.field}
          </span>
          <CompareValue value={item.inputValue} className="text-foreground" />
          <CompareValue
            value={item.previewValue}
            className="text-muted-foreground"
          />
        </li>
      ))}
    </ul>
  );

  return (
    <div className="w-full overflow-hidden rounded-md border border-border bg-muted/30 text-left">
      <div className="grid grid-cols-[minmax(5.5rem,0.9fr)_minmax(0,1.1fr)_minmax(0,1.1fr)] items-center gap-x-3 border-b border-border bg-muted/50 px-3 py-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Field
        </span>
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Input
        </span>
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Preview
        </span>
      </div>
      <div className="max-h-56 overflow-y-auto overscroll-contain">{rows}</div>
    </div>
  );
}

function lessonDifficultyFromDeck(
  deckDefaults: ReturnType<typeof deckToHomeworkDefaults>,
): string {
  if (
    LESSON_DIFFICULTY_LEVELS.includes(
      deckDefaults.difficultyLevel as (typeof LESSON_DIFFICULTY_LEVELS)[number],
    )
  ) {
    return deckDefaults.difficultyLevel;
  }
  return deckDefaults.difficultyLevel === "On-level" ? "Intermediate" : "Intermediate";
}

function lessonFormDefaultsFromDeck(deck: DeckRow): Pick<
  LessonPlanInput,
  "subject" | "gradeLevel" | "topic" | "difficultyLevel"
> {
  const base = deckToHomeworkDefaults(deck);
  const { subject, topic } = resolveDeckSubjectAndTopic(deck);
  return {
    subject: subject || base.subject,
    gradeLevel: base.gradeLevel,
    topic: topic || base.topic,
    difficultyLevel: lessonDifficultyFromDeck(base),
  };
}

function validateLessonPlanFormForGeneration(
  form: LessonPlanInput,
  references: LessonPlanReferenceMaterial[],
): string | null {
  if (!form.subject.trim()) return "Enter a subject.";
  if (!form.gradeLevel.trim()) return "Enter a grade level.";
  if (!form.topic.trim()) return "Enter a topic.";
  if (!form.lessonDuration.trim()) return "Enter a lesson duration.";
  if (
    !DIFFICULTY_LEVEL_OPTIONS.includes(
      form.difficultyLevel as (typeof DIFFICULTY_LEVEL_OPTIONS)[number],
    )
  ) {
    return "Select a difficulty level.";
  }

  for (let index = 0; index < references.length; index += 1) {
    const reference = references[index];
    if (!reference.text.trim()) {
      return `Reference ${index + 1} is empty. Remove it and add the source again.`;
    }
    if (!reference.summary.trim()) {
      return `Reference ${index + 1} is missing a label. Remove it and add the source again.`;
    }
  }

  return null;
}

function normalizeLessonPlanReferences(
  references: LessonPlanReferenceMaterial[],
): LessonPlanReferenceMaterial[] {
  return references.map(normalizeLessonPlanReferenceMaterial);
}

function defaultNewDeckName(subject: string, topic: string): string {
  const subjectTrim = subject.trim();
  const topicTrim = topic.trim();
  if (subjectTrim && topicTrim) return `${subjectTrim} — ${topicTrim}`;
  return subjectTrim || topicTrim;
}

type InitialSavedLessonPlan = {
  id: number;
  input: LessonPlanInput;
  result: LessonPlanResult;
  deckId: number | null;
  sourceDeckName: string | null;
  lessonTitle: string;
  vocabularyDetailPdfUrl?: string | null;
  /** Prefill from an assigned-deck original; Save creates a personal copy. */
  isAssignedSourcePlan?: boolean;
};

type TeacherLessonBuilderFormProps = {
  hasAdvancedSourceImport: boolean;
  backHref?: string;
  teacherWorkspace?: TeacherWorkspaceContext;
  decks: DeckRow[];
  ownerDeckPicker: OwnerTeamAdminDeckPickerPayload;
  deckQuota: TeacherDeckQuota;
  initialDeckId?: number;
  initialDeckAdminUserId?: string;
  initialSavedPlan?: InitialSavedLessonPlan;
  initialDeckDefaults?: {
    subject: string;
    gradeLevel: string;
    topic: string;
    difficultyLevel: string;
  };
  /** Arrived from Edit deck with pending intake sync (sessionStorage). */
  fromDeckEdit?: boolean;
};

export function TeacherLessonBuilderForm({
  hasAdvancedSourceImport,
  backHref = "/teacher",
  teacherWorkspace,
  decks,
  ownerDeckPicker,
  deckQuota,
  initialDeckId,
  initialDeckAdminUserId,
  initialSavedPlan,
  initialDeckDefaults,
  fromDeckEdit = false,
}: TeacherLessonBuilderFormProps) {
  const router = useRouter();
  const isWorkspaceOwner = ownerDeckPicker.isWorkspaceOwner;
  const isEditingExistingPlan = initialSavedPlan != null;
  const resolvedInitialDeckId = initialSavedPlan?.deckId ?? initialDeckId;
  const initialDeck =
    resolvedInitialDeckId != null
      ? decks.find((deck) => deck.id === resolvedInitialDeckId) ?? null
      : null;

  const referenceFieldsRef = useRef<LessonPlanReferenceMaterialFieldsHandle>(null);
  const [referenceMaterials, setReferenceMaterials] = useState<
    LessonPlanReferenceMaterial[]
  >(
    initialSavedPlan
      ? getLessonPlanReferenceMaterials(initialSavedPlan.input)
      : [],
  );
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [form, setForm] = useState<LessonPlanInput>(
    initialSavedPlan?.input ?? {
      subject: initialDeckDefaults?.subject ?? "",
      gradeLevel: initialDeckDefaults?.gradeLevel ?? "",
      topic: initialDeckDefaults?.topic ?? "",
      lessonDuration: "45 minutes",
      planPeriodDays: DEFAULT_PLAN_PERIOD_DAYS,
      difficultyLevel: initialDeckDefaults?.difficultyLevel ?? "Intermediate",
      learningStandard: "",
      classSize: "",
      specialInstructions: "",
    },
  );
  const [result, setResult] = useState<LessonPlanResult | null>(
    initialSavedPlan?.result
      ? normalizeLessonPlanResultDayLabels(initialSavedPlan.result)
      : null,
  );
  const [showResult, setShowResult] = useState(isEditingExistingPlan);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingDayDetails, setIsGeneratingDayDetails] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingVocabularyDetail, setIsDownloadingVocabularyDetail] = useState(false);
  const [savedVocabularyDetailPdfUrl, setSavedVocabularyDetailPdfUrl] = useState<string | null>(
    initialSavedPlan?.vocabularyDetailPdfUrl ?? null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [savedPlanId, setSavedPlanId] = useState<number | null>(
    isEditingExistingPlan ? initialSavedPlan.id : null,
  );
  const [editingPlanId, setEditingPlanId] = useState<number | null>(
    isEditingExistingPlan ? initialSavedPlan.id : null,
  );
  const [regenerationSeed, setRegenerationSeed] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(isEditingExistingPlan);
  const [editDraft, setEditDraft] = useState<LessonPlanResult | null>(
    initialSavedPlan
      ? cloneLessonPlanResult(normalizeLessonPlanResultDayLabels(initialSavedPlan.result))
      : null,
  );
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [regenerateApproach, setRegenerateApproach] =
    useState<VocabularyTeachingApproach>("weekly");
  const [deckTargetMode, setDeckTargetMode] = useState<DeckTargetMode>("existing");
  const [selectedDeckKey, setSelectedDeckKey] = useState<string>(
    resolvedInitialDeckId != null ? String(resolvedInitialDeckId) : DECK_NONE,
  );
  const [deckId, setDeckId] = useState<number | undefined>(
    resolvedInitialDeckId ?? undefined,
  );
  const [selectedDeckAdminUserId, setSelectedDeckAdminUserId] = useState<string>(
    initialDeckAdminUserId ?? ADMIN_NONE,
  );
  const [isAssignedSourceEditing, setIsAssignedSourceEditing] = useState(
    Boolean(initialSavedPlan?.isAssignedSourcePlan),
  );
  const [pendingDeckEditSync, setPendingDeckEditSync] = useState(false);
  const [exitSyncDialogOpen, setExitSyncDialogOpen] = useState(false);
  const [assigneeGenerateChoiceOpen, setAssigneeGenerateChoiceOpen] =
    useState(false);
  const [assigneeGenerateChoiceSource, setAssigneeGenerateChoiceSource] =
    useState<"generate" | "leave">("generate");
  const [isAdaptingCreatorPlan, setIsAdaptingCreatorPlan] = useState(false);
  const [isKeepingCurrentPlan, setIsKeepingCurrentPlan] = useState(false);
  const [previewSyncedIntake, setPreviewSyncedIntake] =
    useState<LessonPlanInput | null>(
      initialSavedPlan?.input
        ? cloneComparableLessonPlanIntake(initialSavedPlan.input)
        : null,
    );
  const [savedBaseline, setSavedBaseline] = useState<{
    input: LessonPlanInput;
    result: LessonPlanResult;
  } | null>(
    initialSavedPlan
      ? {
          input: initialSavedPlan.input,
          result: normalizeLessonPlanResultDayLabels(initialSavedPlan.result),
        }
      : null,
  );
  const [exitDiscrepancies, setExitDiscrepancies] = useState<
    LessonPlanIntakePreviewDiscrepancy[]
  >([]);
  const pendingDeckEditSyncRef = useRef(false);
  const shouldGuardExitRef = useRef(false);
  const allowExitNavigationRef = useRef(false);
  const pendingExitHrefRef = useRef<string | null>(null);
  const intakePreviewDiscrepanciesRef = useRef<LessonPlanIntakePreviewDiscrepancy[]>(
    [],
  );

  const activePreviewResult =
    isEditing && editDraft != null ? editDraft : result;

  const intakePreviewDiscrepancies =
    isEditingExistingPlan &&
    activePreviewResult != null &&
    previewSyncedIntake != null
      ? buildLessonPlanIntakePreviewDiscrepancies(
          form,
          activePreviewResult,
          previewSyncedIntake,
        )
      : [];
  const isDirtyVsSaved =
    isEditingExistingPlan &&
    savedBaseline != null &&
    activePreviewResult != null &&
    isLessonPlanEditorStateDirty(
      { input: form, result: activePreviewResult },
      savedBaseline,
    );
  const shouldGuardExit =
    isEditingExistingPlan &&
    activePreviewResult != null &&
    (pendingDeckEditSync ||
      isDirtyVsSaved ||
      intakePreviewDiscrepancies.length > 0);
  shouldGuardExitRef.current = shouldGuardExit;
  intakePreviewDiscrepanciesRef.current = intakePreviewDiscrepancies;

  const openExitGuard = useCallback((destinationHref: string | null) => {
    if (!shouldGuardExitRef.current) return;
    pendingExitHrefRef.current = destinationHref;
    setExitDiscrepancies(intakePreviewDiscrepanciesRef.current);
    setExitSyncDialogOpen(true);
  }, []);

  useDirtyRouteLeaveGuard({
    enabled: shouldGuardExit,
    allowNavigationRef: allowExitNavigationRef,
    onBlock: openExitGuard,
  });

  const markDeckEditSyncResolved = useCallback(
    (nextIntake?: LessonPlanInput, nextResult?: LessonPlanResult | null) => {
      pendingDeckEditSyncRef.current = false;
      setPendingDeckEditSync(false);
      if (nextIntake) {
        setPreviewSyncedIntake(cloneComparableLessonPlanIntake(nextIntake));
      }
      if (nextIntake && nextResult) {
        setSavedBaseline({ input: nextIntake, result: nextResult });
      }
      if (initialSavedPlan?.id != null) {
        clearDeckEditLessonIntake(initialSavedPlan.id);
      }
    },
    [initialSavedPlan?.id],
  );

  const activeDecks = useOwnerScopedItems(
    isWorkspaceOwner,
    selectedDeckAdminUserId,
    ownerDeckPicker.itemsByAdminUserId,
    decks,
  );
  const selectedDeck =
    deckId != null ? activeDecks.find((deck) => deck.id === deckId) ?? null : null;
  const selectedDeckLabel =
    selectedDeck?.name ??
    (isEditingExistingPlan && initialSavedPlan.sourceDeckName
      ? initialSavedPlan.sourceDeckName
      : null);

  function deckHaystack(deck: DeckRow): string {
    return [deck.name, deck.description, deck.gradeLevel]
      .filter((part): part is string => Boolean(part && part.trim()))
      .join(" ")
      .toLowerCase();
  }

  function handleDeckAdminChange(adminUserId: string) {
    setSelectedDeckAdminUserId(adminUserId);
    setSelectedDeckKey(DECK_NONE);
    setDeckId(undefined);
    if (!isEditingExistingPlan) {
      setForm((prev) => ({
        ...prev,
        subject: "",
        gradeLevel: "",
        topic: "",
        difficultyLevel: "Intermediate",
      }));
    }
  }

  function applyDeckDefaults(deck: DeckRow) {
    const defaults = lessonFormDefaultsFromDeck(deck);
    setForm((prev) => ({
      ...prev,
      subject: defaults.subject,
      gradeLevel: defaults.gradeLevel,
      topic: defaults.topic,
      difficultyLevel: defaults.difficultyLevel,
    }));
  }

  function handleDeckChange(value: string | null) {
    const next = value ?? DECK_NONE;
    dismissOpenOverlays();
    afterOverlayDismiss(() => {
      setSelectedDeckKey(next);
      if (next === DECK_NONE) {
        setDeckId(undefined);
        if (!isEditingExistingPlan) {
          setForm((prev) => ({
            ...prev,
            subject: "",
            gradeLevel: "",
            topic: "",
            difficultyLevel: "Intermediate",
          }));
        }
        return;
      }
      const parsed = Number(next);
      const id = Number.isFinite(parsed) ? parsed : undefined;
      setDeckId(id);
      if (isEditingExistingPlan || id == null) return;

      const deck = activeDecks.find((item) => item.id === id);
      if (!deck) return;

      applyDeckDefaults(deck);
    });
  }

  useEffect(() => {
    if (isEditingExistingPlan || initialSavedPlan) return;
    if (resolvedInitialDeckId == null) return;

    const deck =
      decks.find((item) => item.id === resolvedInitialDeckId) ??
      Object.values(ownerDeckPicker.itemsByAdminUserId)
        .flat()
        .find((item) => item.id === resolvedInitialDeckId);
    if (!deck) return;

    afterOverlayDismiss(() => {
      applyDeckDefaults(deck);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed form once from server-provided deck id
  }, []);

  useEffect(() => {
    if (!fromDeckEdit || initialSavedPlan == null) return;
    const intake = readDeckEditLessonIntake(initialSavedPlan.id);
    if (!intake) return;

    setForm((prev) => ({
      ...prev,
      subject: intake.subject || prev.subject,
      topic: intake.topic || prev.topic,
      gradeLevel: intake.gradeLevel || prev.gradeLevel,
      difficultyLevel: intake.difficultyLevel || prev.difficultyLevel,
    }));
    pendingDeckEditSyncRef.current = true;
    setPendingDeckEditSync(true);
    toast.message("Deck details applied", {
      description:
        "Intake fields were updated from your deck edit. Generate a new lesson plan when ready, or keep the current plan when you leave.",
    });
  }, [fromDeckEdit, initialSavedPlan]);

  useEffect(() => {
    if (!shouldGuardExit) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!shouldGuardExitRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [shouldGuardExit]);

  function handleDeckTargetModeChange(mode: DeckTargetMode) {
    dismissOpenOverlays();
    afterOverlayDismiss(() => {
      setDeckTargetMode(mode);
      setSavedPlanId(null);
      setSavedVocabularyDetailPdfUrl(null);
      if (mode === "new") {
        setSelectedDeckKey(DECK_NONE);
        setDeckId(undefined);
      }
    });
  }

  const runGeneration = useCallback(
    async (
      isRegenerate: boolean,
      vocabularyTeachingApproach?: VocabularyTeachingApproach,
    ) => {
      dismissOpenOverlays();
      setIsGenerating(true);
      setErrorMessage(null);
      setIsEditing(false);
      setEditDraft(null);

      const seed = isRegenerate ? regenerationSeed + 1 : 0;
      if (isRegenerate) {
        setRegenerationSeed(seed);
      } else {
        setRegenerationSeed(0);
      }

      try {
        const resolvedReferences = normalizeLessonPlanReferences(
          (await referenceFieldsRef.current?.resolveReferences()) ?? referenceMaterials,
        );

        const validationError = validateLessonPlanFormForGeneration(
          form,
          resolvedReferences,
        );
        if (validationError) {
          setErrorMessage(validationError);
          return;
        }

        const planPeriodDays = form.planPeriodDays ?? DEFAULT_PLAN_PERIOD_DAYS;
        let plan = await generateLessonPlanAction({
          ...form,
          planPeriodDays,
          difficultyLevel:
            form.difficultyLevel as LessonPlanActionInput["difficultyLevel"],
          regenerationSeed: seed,
          vocabularyTeachingApproach: isRegenerate
            ? vocabularyTeachingApproach
            : planPeriodDays > 1
              ? "weekly"
              : undefined,
          referenceMaterials:
            resolvedReferences.length > 0 ? resolvedReferences : undefined,
        });
        setSavedPlanId(null);
        setSavedVocabularyDetailPdfUrl(null);

        if (planPeriodDays > 1 && plan.weeklySchedule?.length) {
          setResult(plan);
          setShowResult(true);
          setIsGeneratingDayDetails(true);
          try {
            const details = await generateAllDaysVocabularyDetailAction({
              subject: form.subject,
              gradeLevel: form.gradeLevel,
              topic: form.topic,
              difficultyLevel:
                form.difficultyLevel as LessonPlanActionInput["difficultyLevel"],
              learningStandard: form.learningStandard,
              lessonTitle: plan.lessonTitle,
              jamaicaNscGuidelinesApplied: plan.jamaicaNscGuidelinesApplied,
              days: plan.weeklySchedule.map((day) => ({
                dayLabel: day.dayLabel,
                dailyFocus: day.dailyFocus,
                vocabulary: day.vocabulary,
                lessonTimeline: day.lessonTimeline,
              })),
            });
            plan = {
              ...plan,
              weeklySchedule: attachVocabularyDetailsToSchedule(
                plan.weeklySchedule,
                details,
              ),
            };
            setResult(plan);
          } catch (detailError) {
            console.warn(
              "[TeacherLessonBuilderForm] All-day vocabulary detail failed.",
              detailError,
            );
            setResult(plan);
            toast.warning("Lesson plan ready", {
              description:
                "Could not auto-generate vocabulary detail for every day. Use Expand all day vocabulary (AI) in the Daily Schedule.",
            });
          } finally {
            setIsGeneratingDayDetails(false);
          }
        } else {
          setResult(plan);
          setShowResult(true);
        }
        markDeckEditSyncResolved(form);
      } catch (error) {
        const raw =
          error instanceof Error
            ? error.message
            : "Lesson generation failed. Please try again.";
        const message =
          raw.includes("Server Components render") || raw.includes("digest property")
            ? "Lesson generation failed. Refresh the page and try again. If it keeps happening, restart the dev server."
            : raw;
        setErrorMessage(message);
      } finally {
        setIsGenerating(false);
      }
    },
    [form, regenerationSeed, referenceMaterials, markDeckEditSyncResolved],
  );

  const shouldAutoRefreshVocabularyDetails = useCallback(
    (plan: LessonPlanResult) => {
      const planPeriodDays = form.planPeriodDays ?? DEFAULT_PLAN_PERIOD_DAYS;
      return (
        planPeriodDays > 1 &&
        (plan.weeklySchedule?.length ?? 0) > 0 &&
        scheduleDaysEligibleForVocabularyDetail(plan.weeklySchedule ?? []).length > 0
      );
    },
    [form.planPeriodDays],
  );

  const refreshVocabularyDetailsForPlan = useCallback(
    async (plan: LessonPlanResult): Promise<LessonPlanResult> => {
      const schedule = plan.weeklySchedule ?? [];
      const targetDays = scheduleDaysEligibleForVocabularyDetail(schedule);
      if (targetDays.length === 0) {
        return plan;
      }

      setIsGeneratingDayDetails(true);
      try {
        const details = await generateAllDaysVocabularyDetailAction({
          subject: form.subject,
          gradeLevel: form.gradeLevel,
          topic: form.topic,
          difficultyLevel:
            form.difficultyLevel as LessonPlanActionInput["difficultyLevel"],
          learningStandard: form.learningStandard,
          lessonTitle: plan.lessonTitle,
          jamaicaNscGuidelinesApplied: plan.jamaicaNscGuidelinesApplied,
          days: targetDays.map((day) => ({
            dayLabel: day.dayLabel,
            dailyFocus: day.dailyFocus,
            vocabulary: day.vocabulary,
            lessonTimeline: day.lessonTimeline,
          })),
        });

        return {
          ...plan,
          weeklySchedule: mergeVocabularyDetailsByDayLabel(
            schedule,
            targetDays,
            details,
          ),
        };
      } catch (error) {
        console.warn(
          "[TeacherLessonBuilderForm] Post-edit vocabulary detail refresh failed.",
          error,
        );
        toast.warning("Edits saved locally", {
          description:
            "Could not auto-refresh AI vocabulary details. Use Expand all day vocabulary (AI) in the Daily Schedule.",
        });
        return plan;
      } finally {
        setIsGeneratingDayDetails(false);
      }
    },
    [form],
  );

  function startEditing() {
    if (!result) return;
    setEditDraft(cloneLessonPlanResult(result));
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setEditDraft(null);
  }

  async function finishEditing() {
    if (!editDraft) return;

    let updated = editDraft;
    if (shouldAutoRefreshVocabularyDetails(editDraft)) {
      updated = await refreshVocabularyDetailsForPlan(editDraft);
    }

    setResult(updated);
    if (editingPlanId == null) {
      setSavedPlanId(null);
      setSavedVocabularyDetailPdfUrl(null);
    }
    setIsEditing(false);
    setEditDraft(null);
    toast.success("Lesson plan updated", {
      description: shouldAutoRefreshVocabularyDetails(updated)
        ? "Your edits were applied and daily vocabulary details were refreshed with AI."
        : "Your edits are ready to save or download.",
    });
  }

  function handleRegenerateConfirm() {
    setRegenerateDialogOpen(false);
    void runGeneration(true, regenerateApproach);
  }

  function openAssigneeGenerateChoice(source: "generate" | "leave") {
    setAssigneeGenerateChoiceSource(source);
    setAssigneeGenerateChoiceOpen(true);
  }

  function requestGenerateFromIntake() {
    if (isAssignedSourceEditing) {
      openAssigneeGenerateChoice("generate");
      return;
    }
    void runGeneration(false);
  }

  function handleLeaveGenerateClick() {
    pendingExitHrefRef.current = null;
    setExitSyncDialogOpen(false);
    if (isAssignedSourceEditing) {
      openAssigneeGenerateChoice("leave");
      return;
    }
    toast.message("Ready when you are", {
      description:
        "Click Generate to create a new lesson plan from the current intake fields. AI does not run until you click Generate.",
    });
  }

  function handleAssigneeChooseNewGeneration() {
    setAssigneeGenerateChoiceOpen(false);
    if (assigneeGenerateChoiceSource === "leave") {
      toast.message("Ready when you are", {
        description:
          "Click Generate to create a completely new lesson plan from the current intake fields. AI does not run until you click Generate.",
      });
      return;
    }
    void runGeneration(false);
  }

  async function handleAssigneeAdaptCreatorPlan() {
    if (editingPlanId == null) {
      toast.error("Open the assigned lesson plan before adapting it.");
      return;
    }

    setIsAdaptingCreatorPlan(true);
    setErrorMessage(null);
    try {
      const resolvedReferences = normalizeLessonPlanReferences(
        (await referenceFieldsRef.current?.resolveReferences()) ??
          referenceMaterials,
      );

      const validationError = validateLessonPlanFormForGeneration(
        form,
        resolvedReferences,
      );
      if (validationError) {
        setErrorMessage(validationError);
        setAssigneeGenerateChoiceOpen(false);
        return;
      }

      const inputToSave: LessonPlanInput = {
        ...form,
        planPeriodDays: form.planPeriodDays ?? DEFAULT_PLAN_PERIOD_DAYS,
        referenceMaterials:
          resolvedReferences.length > 0 ? resolvedReferences : undefined,
      };

      const saved = await adaptAssignedLessonPlanToIntakeAction({
        lessonPlanId: editingPlanId,
        input: inputToSave,
        teamId: teacherWorkspace?.teamId ?? undefined,
        sourceDeckName: selectedDeckLabel,
      });

      const adapted = normalizeLessonPlanResultDayLabels(saved.result);
      setResult(adapted);
      setShowResult(true);
      setIsEditing(false);
      setEditDraft(null);
      setSavedPlanId(saved.id);
      setEditingPlanId(saved.id);
      setSavedVocabularyDetailPdfUrl(saved.vocabularyDetailPdfUrl ?? null);
      setDeckId(undefined);
      setSelectedDeckKey(DECK_NONE);
      setIsAssignedSourceEditing(false);
      setReferenceMaterials(getLessonPlanReferenceMaterials(inputToSave));
      markDeckEditSyncResolved(inputToSave, adapted);
      setAssigneeGenerateChoiceOpen(false);

      toast.success("Personal lesson plan created", {
        description:
          "A personal copy was created from the linked plan. The original stays unchanged. No new AI generation was run.",
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not create your lesson plan from the linked plan.",
      );
    } finally {
      setIsAdaptingCreatorPlan(false);
    }
  }

  async function handleSavePlan() {
    if (!result) return;
    let planToSave = isEditing && editDraft ? editDraft : result;

    if (shouldAutoRefreshVocabularyDetails(planToSave)) {
      planToSave = await refreshVocabularyDetailsForPlan(planToSave);
      setResult(planToSave);
      if (isEditing) {
        setIsEditing(false);
        setEditDraft(null);
      }
    }

    // Existing plans (including assigned-source copy-on-write and unlinked personal
    // copies) keep their deck linkage rules on the server — only new plans require a target.
    if (!isEditingExistingPlan && !isAssignedSourceEditing) {
      if (deckTargetMode === "existing" && deckId == null) {
        toast.error("Select a deck to save this lesson plan.");
        return;
      }
      if (
        deckTargetMode === "new" &&
        !defaultNewDeckName(form.subject, form.topic).trim()
      ) {
        toast.error(
          "Enter Subject and Topic — they become the new deck name when you save.",
        );
        return;
      }
    }

    setIsSaving(true);
    try {
      const resolvedReferences =
        (await referenceFieldsRef.current?.resolveReferences()) ?? referenceMaterials;

      const payload = {
        input: {
          ...form,
          referenceMaterials:
            resolvedReferences.length > 0 ? resolvedReferences : undefined,
        },
        result: planToSave,
        deckId: deckTargetMode === "existing" ? deckId : undefined,
        newDeckName:
          deckTargetMode === "new"
            ? defaultNewDeckName(form.subject, form.topic)
            : undefined,
        teamId: teacherWorkspace?.teamId ?? undefined,
      };

      const saved =
        editingPlanId != null
          ? await updateLessonPlanAction({
              lessonPlanId: editingPlanId,
              ...payload,
            })
          : await saveLessonPlanAction(payload);

      if (isEditing && editDraft) {
        setResult(planToSave);
        setIsEditing(false);
        setEditDraft(null);
      }

      setSavedPlanId(saved.id);
      setEditingPlanId(saved.id);
      setSavedVocabularyDetailPdfUrl(saved.vocabularyDetailPdfUrl ?? null);
      markDeckEditSyncResolved(form, planToSave);
      if (saved.savedAsPersonalCopy || saved.deckId == null) {
        setDeckId(undefined);
        setSelectedDeckKey(DECK_NONE);
        setIsAssignedSourceEditing(false);
      } else if (deckTargetMode === "new") {
        setDeckTargetMode("existing");
        setDeckId(saved.deckId);
        setSelectedDeckKey(String(saved.deckId));
      }
      const quizzesHref = teacherWorkspace
        ? buildTeacherQuizzesPath(
            teacherWorkspace.teamId,
            teacherWorkspace.teamMemberId,
            new URLSearchParams({ lessonPlanId: String(saved.id) }),
          )
        : `/teacher/quizzes?lessonPlanId=${saved.id}`;
      const resourcesHref = teacherWorkspace
        ? buildTeacherSubPath(
            "/resources",
            teacherWorkspace.teamId,
            teacherWorkspace.teamMemberId,
          )
        : "/teacher/resources";
      const deckLabel = saved.sourceDeckName || "your library";
      toast.success(
        saved.savedAsPersonalCopy
          ? "Personal lesson plan saved"
          : editingPlanId != null && initialSavedPlan?.id === saved.id
            ? "Lesson plan updated"
            : "Lesson plan saved",
        {
        description: (
          <span>
            {saved.savedAsPersonalCopy ? (
              <>
                {saved.lessonTitle} was saved as your own copy under My lesson plans
                {saved.sourceDeckName ? (
                  <>
                    {" "}
                    (derived from{" "}
                    <span className="font-medium">{saved.sourceDeckName}</span>)
                  </>
                ) : null}
                . The linked assigned original was not changed.
              </>
            ) : saved.deckId != null ? (
              <>
                {saved.lessonTitle} was{" "}
                {editingPlanId != null ? "updated in" : "saved to"}{" "}
                <Link
                  href={`/decks/${saved.deckId}`}
                  className="underline underline-offset-2"
                >
                  {deckLabel}
                </Link>
              </>
            ) : (
              <>
                {saved.lessonTitle} was{" "}
                {editingPlanId != null ? "updated in" : "saved to"} your resource library
              </>
            )}
            {saved.pdfUrl ? " with lesson PDF" : ""}
            {saved.vocabularyDetailPdfUrl ? " and vocabulary detail PDF" : ""}. Use it in the{" "}
            <Link href={quizzesHref} className="underline underline-offset-2">
              Quiz Generator
            </Link>{" "}
            or{" "}
            <Link href={resourcesHref} className="underline underline-offset-2">
              Resource Library
            </Link>
            .
          </span>
        ),
      },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save lesson plan.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDownloadPdf() {
    if (!result) return;
    setIsDownloading(true);
    try {
      await downloadLessonPlanPdf(result, {
        planPeriodDays: form.planPeriodDays ?? DEFAULT_PLAN_PERIOD_DAYS,
        lessonDuration: form.lessonDuration,
      });
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleDownloadVocabularyDetailPdf() {
    if (!result) return;
    if (!lessonPlanHasVocabularyDetails(result)) {
      toast.error("No expanded vocabulary yet", {
        description:
          "Use Expand all day vocabulary (AI) in the Daily Schedule before downloading the vocabulary detail PDF.",
      });
      return;
    }

    setIsDownloadingVocabularyDetail(true);
    try {
      await downloadLessonPlanVocabularyDetailPdf(result, {
        planPeriodDays: form.planPeriodDays ?? DEFAULT_PLAN_PERIOD_DAYS,
        lessonDuration: form.lessonDuration,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not download the vocabulary detail PDF.",
      );
    } finally {
      setIsDownloadingVocabularyDetail(false);
    }
  }

  const hasVocabularyDetails = result != null && lessonPlanHasVocabularyDetails(result);

  function handleBackNavigationAttempt(): boolean {
    if (!shouldGuardExitRef.current) return true;
    openExitGuard(backHref);
    return false;
  }

  function proceedWithConfirmedExit() {
    const destination = pendingExitHrefRef.current;
    pendingExitHrefRef.current = null;
    allowExitNavigationRef.current = true;
    proceedAfterDirtyLeaveConfirm(router, destination, backHref);
    if (destination !== BROWSER_BACK_EXIT_HREF) {
      router.refresh();
    }
  }

  async function handleKeepCurrentLessonPlan() {
    const previewToKeep = activePreviewResult;
    if (editingPlanId == null || previewToKeep == null) {
      markDeckEditSyncResolved(form, previewToKeep);
      setExitSyncDialogOpen(false);
      proceedWithConfirmedExit();
      return;
    }

    setIsKeepingCurrentPlan(true);
    try {
      const resolvedReferences =
        (await referenceFieldsRef.current?.resolveReferences()) ??
        referenceMaterials;

      const inputToSave: LessonPlanInput = {
        ...form,
        referenceMaterials:
          resolvedReferences.length > 0 ? resolvedReferences : undefined,
      };

      const saved = await keepLessonPlanOnExitAction({
        lessonPlanId: editingPlanId,
        input: inputToSave,
        result: previewToKeep,
        teamId: teacherWorkspace?.teamId ?? undefined,
        sourceDeckName: selectedDeckLabel,
      });

      setSavedPlanId(saved.id);
      setEditingPlanId(saved.id);
      setSavedVocabularyDetailPdfUrl(saved.vocabularyDetailPdfUrl ?? null);
      if (saved.savedAsPersonalCopy || saved.deckId == null) {
        setDeckId(undefined);
        setSelectedDeckKey(DECK_NONE);
        setIsAssignedSourceEditing(false);
      }
      if (isEditing && editDraft) {
        setResult(previewToKeep);
        setIsEditing(false);
        setEditDraft(null);
      }
      markDeckEditSyncResolved(inputToSave, previewToKeep);
      setExitSyncDialogOpen(false);

      if (saved.skippedOverwrite) {
        toast.message("No changes needed", {
          description:
            "Your personal lesson plan already matches the current intake and preview. Leaving without overwriting.",
        });
      } else {
        toast.success(
          saved.savedAsPersonalCopy
            ? "Personal lesson plan saved"
            : "Lesson plan saved",
          {
            description: saved.savedAsPersonalCopy
              ? "Intake and preview were saved as your own copy. The linked assigned original was not changed."
              : "Current intake and lesson plan preview were saved to the Resource Library.",
          },
        );
      }
      proceedWithConfirmedExit();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save the current lesson plan.",
      );
    } finally {
      setIsKeepingCurrentPlan(false);
    }
  }

  return (
    <>
      <TeacherToolPageShell
        title={isEditingExistingPlan ? "Edit Lesson Plan" : "AI Lesson Builder"}
        description={
          pendingDeckEditSync
            ? "Deck details were updated. Review the intake fields, then generate a new lesson plan or keep the current one when you leave."
            : shouldGuardExit
              ? "You have unsaved edit-mode changes. Leaving prompts you to generate a new plan, or keep the current preview and auto-save intake + preview."
              : isEditingExistingPlan
                ? `Update ${initialSavedPlan.lessonTitle} and save changes back to your Resource Library.`
                : "Generate a structured lesson plan for review before saving."
        }
        backHref={backHref}
        onBackClick={handleBackNavigationAttempt}
        showResult={showResult && result != null}
        isGenerating={isGenerating}
        errorMessage={errorMessage ?? referenceError}
        onGenerate={requestGenerateFromIntake}
        result={
          result ? (
            <LessonPlanPreviewEditor
              result={result}
              isEditing={isEditing}
              editDraft={editDraft}
              onEditDraftChange={setEditDraft}
              onResultChange={setResult}
              isGeneratingAllDayDetails={isGeneratingDayDetails}
              unitContext={{
                planPeriodDays: form.planPeriodDays ?? DEFAULT_PLAN_PERIOD_DAYS,
                lessonDuration: form.lessonDuration,
              }}
              lessonContext={{
                subject: form.subject,
                gradeLevel: form.gradeLevel,
                topic: form.topic,
                difficultyLevel:
                  form.difficultyLevel as LessonPlanActionInput["difficultyLevel"],
                learningStandard: form.learningStandard,
                lessonTitle: result.lessonTitle,
              }}
            />
          ) : null
        }
        previewActions={
          result ? (
            <TooltipProvider>
              {isEditing ? (
                <>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={cancelEditing}
                        />
                      }
                    >
                      <X className="size-4" aria-hidden />
                      Cancel
                    </TooltipTrigger>
                    <TooltipContent>Discard edits and close editor</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span className="inline-flex" tabIndex={0} />
                      }
                    >
                      <Button
                        type="button"
                        size="sm"
                        disabled={isGeneratingDayDetails}
                        onClick={() => void finishEditing()}
                      >
                        {isGeneratingDayDetails ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : null}
                        Done editing
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Finish editing this lesson plan</TooltipContent>
                  </Tooltip>
                  {editingPlanId != null ? (
                    <Tooltip>
                      <TooltipTrigger
                        render={<span className="inline-flex" tabIndex={0} />}
                      >
                        <Button
                          type="button"
                          size="sm"
                          disabled={isSaving || isGeneratingDayDetails}
                          onClick={() => void handleSavePlan()}
                        >
                          {isSaving ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden />
                          ) : (
                            <Save className="size-4" aria-hidden />
                          )}
                          Save changes
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Save your lesson plan changes</TooltipContent>
                    </Tooltip>
                  ) : null}
                </>
              ) : (
                <>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span className="inline-flex" tabIndex={0} />
                      }
                    >
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isGenerating || isSaving}
                        onClick={startEditing}
                      >
                        <Pencil className="size-4" aria-hidden />
                        Edit
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit this lesson plan</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={<span className="inline-flex" tabIndex={0} />}
                    >
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isGenerating}
                        onClick={() => {
                          const planPeriodDays =
                            form.planPeriodDays ?? DEFAULT_PLAN_PERIOD_DAYS;
                          if (planPeriodDays > 1) {
                            void runGeneration(true, "weekly");
                            return;
                          }
                          setRegenerateDialogOpen(true);
                        }}
                      >
                        {isGenerating ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <RefreshCw className="size-4" aria-hidden />
                        )}
                        Regenerate
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Generate a new version of this plan</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={<span className="inline-flex" tabIndex={0} />}
                    >
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isSaving || isGeneratingDayDetails || (savedPlanId !== null && editingPlanId == null)}
                        onClick={() => void handleSavePlan()}
                      >
                        {isSaving ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <Save className="size-4" aria-hidden />
                        )}
                        {editingPlanId != null
                          ? "Save changes"
                          : savedPlanId !== null
                            ? "Saved"
                            : "Save Lesson Plan"}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {savedPlanId !== null && editingPlanId == null
                        ? "This lesson plan is already saved"
                        : "Save this lesson plan to your library"}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={<span className="inline-flex" tabIndex={0} />}
                    >
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isDownloading}
                        onClick={() => void handleDownloadPdf()}
                      >
                        {isDownloading ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <Download className="size-4" aria-hidden />
                        )}
                        Download PDF
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Download the lesson plan as a PDF</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={<span className="inline-flex" tabIndex={0} />}
                    >
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!hasVocabularyDetails || isDownloadingVocabularyDetail}
                        onClick={() => void handleDownloadVocabularyDetailPdf()}
                      >
                        {isDownloadingVocabularyDetail ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <Download className="size-4" aria-hidden />
                        )}
                        Download vocabulary PDF
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {!hasVocabularyDetails
                        ? "Vocabulary details are not available yet"
                        : "Download the vocabulary detail PDF"}
                    </TooltipContent>
                  </Tooltip>
                  {savedVocabularyDetailPdfUrl ? (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              window.open(
                                savedVocabularyDetailPdfUrl,
                                "_blank",
                                "noopener,noreferrer",
                              )
                            }
                          />
                        }
                      >
                        <ExternalLink className="size-4" aria-hidden />
                        Saved vocabulary PDF
                      </TooltipTrigger>
                      <TooltipContent>Open the saved vocabulary PDF</TooltipContent>
                    </Tooltip>
                  ) : null}
                </>
              )}
            </TooltipProvider>
          ) : null
        }
      >
      <TooltipProvider>
        <div className="grid gap-4 sm:grid-cols-2">
          <div
            className={cn(
              "space-y-2 sm:col-span-2",
              isEditingExistingPlan && "opacity-60",
            )}
          >
            <TeacherFieldLabel
              htmlFor="lessonDeckTargetMode"
              label="Save to deck"
              help={
                <>
                  <p className="mb-2">
                    Link this lesson plan to a deck so it appears in Classes and your
                    Resource Library for that deck.
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>
                      <strong>Existing deck</strong> — attach the lesson to a deck you
                      already created.
                    </li>
                    <li>
                      <strong>New deck</strong> — creates a deck named Subject — Topic when you
                      save the lesson plan.
                    </li>
                  </ul>
                </>
              }
            />
            <ToggleGroup
              id="lessonDeckTargetMode"
              value={[deckTargetMode]}
              onValueChange={(next) => {
                if (isEditingExistingPlan) return;
                const value = next[0] as DeckTargetMode | undefined;
                if (value) handleDeckTargetModeChange(value);
              }}
              variant="outline"
              spacing={0}
              className="flex w-full"
            >
              <ToggleGroupItem
                value="existing"
                className="h-10 flex-1 px-3"
                disabled={isEditingExistingPlan}
              >
                Existing deck
              </ToggleGroupItem>
              <ToggleGroupItem
                value="new"
                className="h-10 flex-1 px-3"
                disabled={isEditingExistingPlan}
              >
                New deck
              </ToggleGroupItem>
            </ToggleGroup>
            <p className="text-xs text-muted-foreground">{teacherDeckQuotaLabel(deckQuota)}</p>
          </div>

          {isEditingExistingPlan ? (
            <div className="space-y-2 sm:col-span-2">
              <TeacherFieldLabel
                htmlFor="lessonBuilderDeckLocked"
                label="Deck"
                help={
                  isAssignedSourceEditing
                    ? "This plan came with an assigned deck. Saving creates your own copy in My lesson plans and leaves the original unchanged."
                    : (initialSavedPlan?.deckId == null && deckId == null)
                      ? "This is your personal library copy. It is not linked to the assigned deck’s original lesson plan."
                      : "A saved lesson plan stays linked to its original deck. Create a new lesson plan if you need a different deck."
                }
              />
              <Input
                id="lessonBuilderDeckLocked"
                value={selectedDeckLabel ?? initialSavedPlan?.sourceDeckName ?? "Linked deck"}
                readOnly
                disabled
                className="h-10 cursor-not-allowed bg-muted/40 text-muted-foreground"
              />
              {isAssignedSourceEditing ? (
                <p className="text-xs text-muted-foreground">
                  Save will add an updated personal version to your Teacher Resource Library.
                </p>
              ) : null}
              {(initialSavedPlan?.deckId ?? deckId) != null ? (
                <p className="text-xs text-muted-foreground">
                  <Link
                    href={`/decks/${initialSavedPlan?.deckId ?? deckId}`}
                    className="inline-flex items-center gap-1 underline underline-offset-2"
                  >
                    Open deck
                    <ExternalLink className="size-3" aria-hidden />
                  </Link>
                </p>
              ) : null}
            </div>
          ) : deckTargetMode === "existing" ? (
            isWorkspaceOwner ? (
              <OwnerTeamAdminResourcePicker
                ownerPicker={ownerDeckPicker}
                itemsByAdminUserId={ownerDeckPicker.itemsByAdminUserId}
                selectedAdminUserId={selectedDeckAdminUserId}
                onAdminChange={handleDeckAdminChange}
                selectedItemKey={selectedDeckKey}
                onItemChange={handleDeckChange}
                noneValue={DECK_NONE}
                noneLabel="Select a deck"
                placeholder="Select a deck"
                resourceLabel="Deck"
                resourceSelectId="lessonBuilderDeck"
                adminSelectId="lessonBuilderDeckTeamAdmin"
                getItemKey={(deck) => String(deck.id)}
                getItemLabel={(deck) => deck.name}
                getItemHaystack={deckHaystack}
                searchPlaceholder="Search decks by name, subject, or description…"
                resourceHelp="Only decks without an existing lesson plan are listed."
                resourceFooter={
                  selectedDeck ? (
                    <p className="text-xs text-muted-foreground">
                      <Link
                        href={`/decks/${selectedDeck.id}`}
                        className="inline-flex items-center gap-1 underline underline-offset-2"
                      >
                        Open deck
                        <ExternalLink className="size-3" aria-hidden />
                      </Link>
                    </p>
                  ) : null
                }
              />
            ) : (
              <div className="space-y-2 sm:col-span-2">
                <TeacherFieldLabel
                  htmlFor="lessonBuilderDeck"
                  label="Deck"
                  help="Only decks without an existing lesson plan are listed. Pick the deck this lesson plan belongs to."
                />
                <Select value={selectedDeckKey} onValueChange={handleDeckChange}>
                  <SelectTrigger id="lessonBuilderDeck" className="h-10 w-full bg-background">
                    <SelectValue placeholder="Select a deck">
                      {selectedDeckLabel ?? "Select a deck"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DECK_NONE} disabled>
                      Select a deck
                    </SelectItem>
                    {activeDecks.map((deck) => (
                      <SelectItem key={deck.id} value={String(deck.id)}>
                        {deck.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeDecks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No decks without a lesson plan are available. Switch to{" "}
                    <strong>New deck</strong>
                    {teacherWorkspace?.teamId != null
                      ? " or use a deck from this workspace Team Dashboard (including decks assigned to you)."
                      : " or create a deck from your Personal Dashboard first."}
                  </p>
                ) : null}
                {selectedDeck ? (
                  <p className="text-xs text-muted-foreground">
                    <Link
                      href={`/decks/${selectedDeck.id}`}
                      className="inline-flex items-center gap-1 underline underline-offset-2"
                    >
                      Open deck
                      <ExternalLink className="size-3" aria-hidden />
                    </Link>
                  </p>
                ) : null}
              </div>
            )
          ) : (
            <div className="space-y-2 sm:col-span-2">
              <p className="text-sm text-muted-foreground">
                A new deck is created when you save, using{" "}
                <span className="font-medium text-foreground">Subject — Topic</span> as the deck
                name.
              </p>
              {deckQuota.atLimit ? (
                <p className="text-xs text-destructive">
                  Deck limit reached on your plan. Select an existing deck instead.
                </p>
              ) : null}
            </div>
          )}

          <div className="space-y-2">
            <TeacherFieldLabel
              htmlFor="subject"
              label="Subject"
              help={
                <>
                  <p className="mb-1 font-semibold">Example:</p>
                  <p>Science, Social Studies, Mathematics, English Language Arts</p>
                </>
              }
            />
            <Input
              id="subject"
              placeholder="e.g. Science"
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
              placeholder="e.g. Grade 5"
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
              placeholder="e.g. Water cycle"
              value={form.topic}
              onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <TeacherFieldLabel
              htmlFor="lessonDuration"
              label="Lesson Duration"
              help={
                <>
                  <p className="mb-1 font-semibold">One class period</p>
                  <p>How long each daily lesson runs — e.g. 45 minutes or 1 hour.</p>
                </>
              }
            />
            <Input
              id="lessonDuration"
              placeholder="e.g. 45 minutes"
              value={form.lessonDuration}
              onChange={(e) =>
                setForm((f) => ({ ...f, lessonDuration: e.target.value }))
              }
              required
            />
          </div>
          <div className="space-y-2">
            <TeacherFieldLabel
              htmlFor="planPeriodDays"
              label="Plan Period"
              help={
                <>
                  <p className="mb-1 font-semibold">Unit length in school days</p>
                  <p>
                    Vocabulary and a class timeline are distributed across this many
                    days. Each day uses the lesson duration above.
                  </p>
                </>
              }
            />
            <Select
              value={String(form.planPeriodDays ?? DEFAULT_PLAN_PERIOD_DAYS)}
              onValueChange={(value) => {
                if (value == null) return;
                setForm((f) => ({
                  ...f,
                  planPeriodDays: Number(value),
                }));
              }}
            >
              <SelectTrigger
                id="planPeriodDays"
                className="h-10 w-full bg-background"
              >
                <SelectValue placeholder="Select plan period" />
              </SelectTrigger>
              <SelectContent>
                {PLAN_PERIOD_DAY_OPTIONS.map((days) => (
                  <SelectItem key={days} value={String(days)}>
                    {days === 1 ? "1 day (single lesson)" : `${days} days`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <TeacherFieldLabel
              htmlFor="difficultyLevel"
              label="Difficulty Level"
              help={
                <>
                  <p className="mb-1 font-semibold">Choose the class readiness level:</p>
                  <p>
                    Select All to show strategies for every tier in Differentiated
                    Instruction. Otherwise only the selected level appears in the
                    generated plan.
                  </p>
                  <p className="mt-1">
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
              <SelectTrigger
                id="difficultyLevel"
                className="h-10 w-full bg-background"
                aria-required
              >
                <SelectValue placeholder="Select difficulty" />
              </SelectTrigger>
              <SelectContent>
                {DIFFICULTY_LEVEL_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <TeacherFieldLabel
              htmlFor="learningStandard"
              label="Learning Standard (optional)"
              help={
                <>
                  <p className="mb-1 font-semibold">Examples:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>Common Core State Standards (CCSS)</li>
                    <li>Next Generation Science Standards (NGSS)</li>
                    <li>C3 Framework for Social Studies</li>
                    <li>Jamaica National Standards Curriculum (NSC)</li>
                    <li>CARICOM regional curriculum</li>
                  </ul>
                  <p className="mt-2">
                    When the standard is linked to Jamaica (for example Jamaica
                    NSC), generation uses Jamaica NSC structure guidelines (5E
                    model, inquiry-based design, and culturally relevant
                    examples).
                  </p>
                </>
              }
            />
            <Input
              id="learningStandard"
              placeholder="e.g. NGSS, Common Core (CCSS), Jamaica NSC"
              value={form.learningStandard}
              onChange={(e) =>
                setForm((f) => ({ ...f, learningStandard: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <TeacherFieldLabel
              htmlFor="classSize"
              label="Class Size (optional)"
              help={
                <>
                  <p className="mb-1 font-semibold">Example:</p>
                  <p>23 students, 28, small group of 12</p>
                </>
              }
            />
            <Input
              id="classSize"
              placeholder="e.g. 23"
              value={form.classSize}
              onChange={(e) => setForm((f) => ({ ...f, classSize: e.target.value }))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <TeacherFieldLabel
              htmlFor="specialInstructions"
              label="Special need or Accommodations (optional)"
              help={
                <>
                  <p className="mb-2">
                    This tells the AI how to adapt the lesson for students who need
                    additional support.
                  </p>
                  <p className="mb-1 font-semibold">Examples:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>Reading</li>
                    <li>Dyslexia</li>
                    <li>Reading comprehension support</li>
                    <li>Large print materials</li>
                  </ul>
                </>
              }
            />
            <Textarea
              id="specialInstructions"
              placeholder="e.g. Dyslexia — use large print materials and reading comprehension support"
              value={form.specialInstructions}
              onChange={(e) =>
                setForm((f) => ({ ...f, specialInstructions: e.target.value }))
              }
              rows={3}
            />
          </div>

          <LessonPlanReferenceMaterialFields
            ref={referenceFieldsRef}
            hasAdvancedSourceImport={hasAdvancedSourceImport}
            disabled={isGenerating}
            value={referenceMaterials}
            onChange={setReferenceMaterials}
            onError={setReferenceError}
          />
        </div>
      </TooltipProvider>
      </TeacherToolPageShell>

      <AlertDialog
        open={exitSyncDialogOpen}
        onOpenChange={(open) => {
          if (!open && !isKeepingCurrentPlan) {
            pendingExitHrefRef.current = null;
          }
          setExitSyncDialogOpen(open);
        }}
      >
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-xl mx-4 gap-0 p-0 sm:mx-auto sm:max-w-xl">
          <AlertDialogHeader className="place-items-start gap-2 p-4 pb-3 text-left sm:p-5 sm:pb-3">
            <div className="flex w-full flex-wrap items-center gap-2">
              <AlertDialogTitle className="text-base font-semibold sm:text-lg">
                {exitDiscrepancies.length > 0
                  ? "Intake differs from lesson preview"
                  : "Leave Lesson Builder?"}
              </AlertDialogTitle>
              {exitDiscrepancies.length > 0 ? (
                <Badge variant="secondary" className="rounded-md font-normal">
                  {exitDiscrepancies.length}{" "}
                  {exitDiscrepancies.length === 1 ? "difference" : "differences"}
                </Badge>
              ) : null}
            </div>
            <AlertDialogDescription className="text-left text-sm text-muted-foreground">
              {pendingDeckEditSync
                ? "Deck details updated the intake fields, but the lesson plan preview is unchanged. Choose how you would like to continue."
                : exitDiscrepancies.length > 0
                  ? "Some intake fields no longer match the current lesson plan preview. Review the differences below, then choose how to continue."
                  : "You have unsaved changes on this page. Choose how you would like to continue."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {exitDiscrepancies.length > 0 ? (
            <div className="space-y-2 px-4 pb-4 sm:px-5">
              <p className="text-xs text-muted-foreground">
                Comparison of current intake values against the lesson plan
                preview.
              </p>
              <IntakePreviewDiscrepancyList items={exitDiscrepancies} />
            </div>
          ) : (
            <div className="px-4 pb-4 sm:px-5">
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5 text-left text-xs text-muted-foreground">
                You can generate a new plan from the current intake, keep the
                current plan and leave, or stay and continue editing.
              </div>
            </div>
          )}

          <Separator />

          <AlertDialogFooter className="m-0 flex-col gap-2 rounded-b-xl border-0 bg-muted/40 p-4 sm:flex-col sm:space-x-0">
            <AlertDialogAction
              disabled={isKeepingCurrentPlan || isAdaptingCreatorPlan}
              className="w-full"
              onClick={(event) => {
                event.preventDefault();
                handleLeaveGenerateClick();
              }}
            >
              Generate a new lesson plan
            </AlertDialogAction>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={
                isKeepingCurrentPlan ||
                isAdaptingCreatorPlan ||
                editingPlanId == null
              }
              onClick={() => {
                void handleKeepCurrentLessonPlan();
              }}
            >
              {isKeepingCurrentPlan
                ? "Saving…"
                : "Keep current plan and leave"}
            </Button>
            <AlertDialogCancel
              disabled={isKeepingCurrentPlan || isAdaptingCreatorPlan}
              className="mt-0 w-full"
            >
              Stay on this page
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={assigneeGenerateChoiceOpen}
        onOpenChange={(open) => {
          if (!open && isAdaptingCreatorPlan) return;
          setAssigneeGenerateChoiceOpen(open);
        }}
      >
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-xl mx-4 gap-0 p-0 sm:mx-auto sm:max-w-xl">
          <AlertDialogHeader className="place-items-start gap-2 p-4 pb-3 text-left sm:p-5 sm:pb-3">
            <AlertDialogTitle className="text-base font-semibold sm:text-lg">
              How would you like to proceed?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left text-sm text-muted-foreground">
              This deck includes the creator’s saved lesson plan. Choose whether
              to generate an entirely new plan with AI, or create your own lesson
              plan from the linked plan without running a new AI generation.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 px-4 pb-4 sm:px-5">
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5 text-left text-xs text-muted-foreground">
              Creating from the linked plan leaves the original unchanged forever.
              A personal copy is saved to your Teacher Resource Library. If your
              intake details differ (subject, topic, grade, difficulty, duration,
              plan period, learning standard, and related fields), the copied
              content is restructured to match — no new AI generation.
            </div>
          </div>

          <Separator />

          <AlertDialogFooter className="m-0 flex-col gap-2 rounded-b-xl border-0 bg-muted/40 p-4 sm:flex-col sm:space-x-0">
            <AlertDialogAction
              disabled={isAdaptingCreatorPlan || isGenerating}
              className="w-full"
              onClick={(event) => {
                event.preventDefault();
                handleAssigneeChooseNewGeneration();
              }}
            >
              Generate a completely new lesson plan
            </AlertDialogAction>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={isAdaptingCreatorPlan || isGenerating || editingPlanId == null}
              onClick={() => {
                void handleAssigneeAdaptCreatorPlan();
              }}
            >
              {isAdaptingCreatorPlan
                ? "Creating…"
                : "Create my lesson plan from the linked plan"}
            </Button>
            <AlertDialogCancel
              disabled={isAdaptingCreatorPlan}
              className="mt-0 w-full"
            >
              Cancel
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <TooltipProvider>
          <DialogHeader>
            <DialogTitle>Vocabulary teaching approach</DialogTitle>
            <DialogDescription>
              Choose how vocabulary should be distributed when regenerating this
              lesson plan. The AI will rebuild the plan using your Learning Standard
              and this pacing preference.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {VOCABULARY_TEACHING_APPROACH_OPTIONS.map((option) => {
              const selected = regenerateApproach === option.value;
              return (
                <Tooltip key={option.value}>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant={selected ? "default" : "outline"}
                        className={cn(
                          "h-auto flex-col items-start gap-1 whitespace-normal px-4 py-3 text-left",
                          !selected && "text-foreground",
                        )}
                        onClick={() => setRegenerateApproach(option.value)}
                      />
                    }
                  >
                    <span className="font-medium">{option.label}</span>
                    <span
                      className={cn(
                        "text-xs font-normal leading-snug",
                        selected ? "text-primary-foreground/90" : "text-muted-foreground",
                      )}
                    >
                      {option.description}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    Select this vocabulary teaching approach
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          <DialogFooter>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setRegenerateDialogOpen(false)}
                  />
                }
              >
                Cancel
              </TooltipTrigger>
              <TooltipContent>Cancel and close</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={<Button type="button" onClick={handleRegenerateConfirm} />}
              >
                Regenerate plan
              </TooltipTrigger>
              <TooltipContent>Replace this plan with a newly generated version</TooltipContent>
            </Tooltip>
          </DialogFooter>
          </TooltipProvider>
        </DialogContent>
      </Dialog>
    </>
  );
}
