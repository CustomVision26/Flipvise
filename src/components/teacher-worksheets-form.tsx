"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Download, ExternalLink, Loader2, Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";
import { generateWorksheetFromDeckAction, saveWorksheetAction, updateWorksheetAction } from "@/actions/teacher-worksheet";
import { userFacingServerActionError } from "@/lib/server-action-client-error";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TeacherFieldLabel } from "@/components/teacher-field-label";
import { TeacherTopicFieldHelpContent } from "@/components/teacher-field-help-content";
import { TeacherToolPageShell } from "@/components/teacher-tool-page-shell";
import {
  OwnerTeamAdminResourcePicker,
  useOwnerScopedItems,
} from "@/components/owner-team-admin-resource-picker";
import type { OwnerTeamAdminLessonPlanPickerPayload } from "@/db/queries/teacher-owner-pickers";
import { ADMIN_NONE } from "@/lib/owner-team-admin-picker";
import { buildTeacherSubPath, type TeacherWorkspaceContext } from "@/lib/teacher-url";
import { cn } from "@/lib/utils";
import type { SavedWorksheetEditItem } from "@/db/queries/saved-worksheets";
import type { SavedLessonPlanPickerItem } from "@/db/queries/saved-lesson-plans";
import { getLessonPlanReferenceMaterials } from "@/lib/lesson-plan-reference-material";
import { LessonPlanSavedReferenceSummary } from "@/components/lesson-plan-saved-reference-summary";
import { LessonPlanDayScopeDialog } from "@/components/lesson-plan-day-scope-dialog";
import {
  getLessonPlanDayScopeOptions,
  shouldPromptLessonPlanDayScope,
  type LessonPlanDayScope,
} from "@/lib/lesson-plan-day-scope";
import { lessonPlanInputToQuizDefaults } from "@/lib/lesson-plan-quiz-context";
import type { DeckWorksheetResult } from "@/lib/teacher-worksheet-schema";
import {
  TEACHER_WORKSHEET_DEFAULT_QUESTION_COUNT,
  TEACHER_WORKSHEET_MAX_QUESTIONS,
} from "@/lib/teacher-worksheet-schema";
import { downloadWorksheetPdf } from "@/lib/worksheet-pdf-build";
import {
  WorksheetPreviewEditor,
  cloneWorksheetResult,
} from "@/components/worksheet-preview-editor";

const PLAN_NONE = "__none__";

type WorksheetFormState = {
  subject: string;
  gradeLevel: string;
  topic: string;
  worksheetType: string;
  difficultyLevel: string;
  numberOfQuestions: string;
};

const EMPTY_FORM: WorksheetFormState = {
  subject: "",
  gradeLevel: "",
  topic: "",
  worksheetType: "Practice",
  difficultyLevel: "On-level",
  numberOfQuestions: String(TEACHER_WORKSHEET_DEFAULT_QUESTION_COUNT),
};

export function TeacherWorksheetsForm({
  ownerLessonPlanPicker,
  savedLessonPlans,
  backHref = "/teacher",
  teacherWorkspace,
  initialDeckId,
  initialSavedWorksheet,
}: {
  ownerLessonPlanPicker: OwnerTeamAdminLessonPlanPickerPayload;
  savedLessonPlans: SavedLessonPlanPickerItem[];
  backHref?: string;
  teacherWorkspace?: TeacherWorkspaceContext;
  initialDeckId?: number;
  initialSavedWorksheet?: SavedWorksheetEditItem;
}) {
  const isEditingExistingWorksheet = initialSavedWorksheet != null;
  const initialSavedPlanId = initialSavedWorksheet?.input.savedLessonPlanId;

  const [selectedPlanKey, setSelectedPlanKey] = useState<string>(
    initialSavedPlanId != null ? String(initialSavedPlanId) : PLAN_NONE,
  );
  const [savedLessonPlanId, setSavedLessonPlanId] = useState<number | undefined>(
    initialSavedPlanId ?? undefined,
  );
  const [generationDayScope, setGenerationDayScope] = useState<LessonPlanDayScope>(
    initialSavedWorksheet?.input.dayScope ?? "all",
  );
  const [form, setForm] = useState<WorksheetFormState>(
    initialSavedWorksheet
      ? {
          subject: initialSavedWorksheet.input.subject,
          gradeLevel: initialSavedWorksheet.input.gradeLevel,
          topic: initialSavedWorksheet.input.topic,
          worksheetType: initialSavedWorksheet.input.worksheetType,
          difficultyLevel: initialSavedWorksheet.input.difficultyLevel,
          numberOfQuestions: String(
            initialSavedWorksheet.input.numberOfQuestions ??
              initialSavedWorksheet.result.items.length ??
              TEACHER_WORKSHEET_DEFAULT_QUESTION_COUNT,
          ),
        }
      : EMPTY_FORM,
  );
  const [result, setResult] = useState<DeckWorksheetResult | null>(
    initialSavedWorksheet?.result ?? null,
  );
  const [showResult, setShowResult] = useState(isEditingExistingWorksheet);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloadingWorksheet, setIsDownloadingWorksheet] = useState(false);
  const [isDownloadingAnswerKey, setIsDownloadingAnswerKey] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(isEditingExistingWorksheet);
  const [editDraft, setEditDraft] = useState<DeckWorksheetResult | null>(
    initialSavedWorksheet ? cloneWorksheetResult(initialSavedWorksheet.result) : null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [savedWorksheetId, setSavedWorksheetId] = useState<number | null>(
    isEditingExistingWorksheet ? initialSavedWorksheet.id : null,
  );
  const [editingWorksheetId, setEditingWorksheetId] = useState<number | null>(
    isEditingExistingWorksheet ? initialSavedWorksheet.id : null,
  );
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [dayScopeDialogOpen, setDayScopeDialogOpen] = useState(false);
  const [saveLabel, setSaveLabel] = useState(initialSavedWorksheet?.label ?? "");
  const [selectedAdminUserId, setSelectedAdminUserId] = useState<string>(ADMIN_NONE);

  const isWorkspaceOwner = ownerLessonPlanPicker.isWorkspaceOwner;
  const activeLessonPlans = useOwnerScopedItems(
    isWorkspaceOwner,
    selectedAdminUserId,
    ownerLessonPlanPicker.lessonPlansByAdminUserId,
    savedLessonPlans,
  );

  const allLessonPlans = useMemo(() => {
    if (!isWorkspaceOwner) return savedLessonPlans;
    const byId = new Map<number, SavedLessonPlanPickerItem>();
    for (const plan of Object.values(
      ownerLessonPlanPicker.lessonPlansByAdminUserId,
    ).flat()) {
      byId.set(plan.id, plan);
    }
    for (const plan of savedLessonPlans) {
      byId.set(plan.id, plan);
    }
    return [...byId.values()];
  }, [
    isWorkspaceOwner,
    savedLessonPlans,
    ownerLessonPlanPicker.lessonPlansByAdminUserId,
  ]);

  const selectedPlan =
    savedLessonPlanId != null
      ? allLessonPlans.find((plan) => plan.id === savedLessonPlanId) ??
        activeLessonPlans.find((plan) => plan.id === savedLessonPlanId) ??
        null
      : null;

  const dayScopeOptions = useMemo(
    () => getLessonPlanDayScopeOptions(selectedPlan?.result),
    [selectedPlan],
  );
  const simpleDayScopeOptions = useMemo(
    () =>
      dayScopeOptions.map((option) => ({
        value: option.value,
        label: option.label,
        scope: option.scope,
      })),
    [dayScopeOptions],
  );

  const linkedLessonPlanReferences =
    initialSavedWorksheet?.input.referenceMaterials ??
    getLessonPlanReferenceMaterials(selectedPlan?.input);

  const resourcesHref = teacherWorkspace
    ? buildTeacherSubPath(
        "/resources",
        teacherWorkspace.teamId,
        teacherWorkspace.teamMemberId,
      )
    : "/teacher/resources";
  const lessonBuilderHref = teacherWorkspace
    ? buildTeacherSubPath(
        "/lesson-builder",
        teacherWorkspace.teamId,
        teacherWorkspace.teamMemberId,
      )
    : "/teacher/lesson-builder";
  const didApplyInitialPlan = useRef(false);

  function handleAdminChange(adminUserId: string) {
    setSelectedAdminUserId(adminUserId);
    setSelectedPlanKey(PLAN_NONE);
    setSavedLessonPlanId(undefined);
    setForm(EMPTY_FORM);
  }

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

  function applyLessonPlan(plan: SavedLessonPlanPickerItem) {
    const defaults = lessonPlanInputToQuizDefaults(plan.input);
    setSelectedPlanKey(String(plan.id));
    setSavedLessonPlanId(plan.id);
    setGenerationDayScope("all");
    setForm({
      subject: defaults.subject,
      gradeLevel: defaults.gradeLevel,
      topic: defaults.topic,
      worksheetType: "Practice",
      difficultyLevel: defaults.difficultyLevel,
      numberOfQuestions: String(TEACHER_WORKSHEET_DEFAULT_QUESTION_COUNT),
    });
  }

  function handleLessonPlanChange(value: string | null) {
    if (!value || value === PLAN_NONE) {
      setSelectedPlanKey(PLAN_NONE);
      setSavedLessonPlanId(undefined);
      setForm(EMPTY_FORM);
      return;
    }

    const plan = activeLessonPlans.find((item) => item.id === Number(value));
    if (!plan) return;
    applyLessonPlan(plan);
  }

  useEffect(() => {
    if (didApplyInitialPlan.current) return;
    const planId =
      initialSavedPlanId ??
      (initialDeckId != null
        ? allLessonPlans.find((plan) => plan.deckId === initialDeckId)?.id
        : undefined);
    if (planId == null) return;
    const plan = allLessonPlans.find((item) => item.id === planId);
    if (!plan) return;
    didApplyInitialPlan.current = true;
    if (isWorkspaceOwner) {
      const adminWithPlan = ownerLessonPlanPicker.teamAdmins.find((admin) =>
        (ownerLessonPlanPicker.lessonPlansByAdminUserId[admin.userId] ?? []).some(
          (item) => item.id === plan.id,
        ),
      );
      if (adminWithPlan) setSelectedAdminUserId(adminWithPlan.userId);
    }
    if (initialSavedWorksheet) {
      setSelectedPlanKey(String(plan.id));
      setSavedLessonPlanId(plan.id);
      return;
    }
    applyLessonPlan(plan);
  }, [
    allLessonPlans,
    initialDeckId,
    initialSavedPlanId,
    initialSavedWorksheet,
    isWorkspaceOwner,
    ownerLessonPlanPicker,
  ]);

  function parseNumberOfQuestions(value: string): number {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      return TEACHER_WORKSHEET_DEFAULT_QUESTION_COUNT;
    }
    return Math.min(
      TEACHER_WORKSHEET_MAX_QUESTIONS,
      Math.max(1, parsed),
    );
  }

  async function runGenerate(dayScope: LessonPlanDayScope = "all") {
    setIsGenerating(true);
    setErrorMessage(null);
    setDayScopeDialogOpen(false);

    try {
      if (savedLessonPlanId == null) {
        throw new Error("Select a saved lesson plan.");
      }

      setGenerationDayScope(dayScope);
      const generated = await generateWorksheetFromDeckAction({
        deckId: selectedPlan?.deckId ?? undefined,
        savedLessonPlanId,
        dayScope: dayScopeOptions.length > 0 ? dayScope : "all",
        teamId: teacherWorkspace?.teamId ?? undefined,
        subject: form.subject,
        gradeLevel: form.gradeLevel,
        topic: form.topic,
        worksheetType: form.worksheetType,
        difficultyLevel: form.difficultyLevel,
        numberOfQuestions: parseNumberOfQuestions(form.numberOfQuestions),
      });

      if (!generated.ok) {
        setErrorMessage(generated.error);
        return;
      }

      setResult(generated.worksheet);
      setShowResult(true);
      setSavedWorksheetId(null);
      setIsEditing(false);
      setEditDraft(null);
    } catch (error) {
      setErrorMessage(
        userFacingServerActionError(
          error,
          "Worksheet generation failed. Please try again.",
        ),
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function handleGenerate() {
    if (savedLessonPlanId == null) {
      setErrorMessage("Select a saved lesson plan.");
      return;
    }
    if (shouldPromptLessonPlanDayScope(selectedPlan?.result)) {
      setDayScopeDialogOpen(true);
      return;
    }
    void runGenerate("all");
  }

  function handleDayScopeConfirm(scope: LessonPlanDayScope) {
    void runGenerate(scope);
  }

  async function handleDownloadWorksheet() {
    if (!result) return;
    setIsDownloadingWorksheet(true);
    try {
      await downloadWorksheetPdf(result, "worksheet");
    } finally {
      setIsDownloadingWorksheet(false);
    }
  }

  async function handleDownloadAnswerKey() {
    if (!result) return;
    setIsDownloadingAnswerKey(true);
    try {
      await downloadWorksheetPdf(result, "answer_key");
    } finally {
      setIsDownloadingAnswerKey(false);
    }
  }

  function startEditing() {
    if (!result) return;
    setEditDraft(cloneWorksheetResult(result));
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setEditDraft(null);
  }

  function finishEditing() {
    if (!editDraft) return;
    if (!editDraft.instructions.trim()) {
      toast.error("Instructions cannot be empty.");
      return;
    }
    if (editDraft.items.some((item) => !item.prompt.trim() || !item.answer.trim())) {
      toast.error("Every question needs both a prompt and an answer.");
      return;
    }
    setResult(editDraft);
    setSavedWorksheetId(null);
    setIsEditing(false);
    setEditDraft(null);
    toast.success("Worksheet updated", {
      description: "Your edits are ready to save or download.",
    });
  }

  function openSaveDialog() {
    if (!result) return;
    if (saveDeckId == null) {
      toast.error("This lesson plan is not linked to a deck, so the worksheet cannot be saved yet.");
      return;
    }
    setSaveLabel(result.worksheetTitle);
    setSaveDialogOpen(true);
  }

  async function handleSaveWorksheet() {
    if (!result || !saveLabel.trim() || saveDeckId == null) return;
    await persistWorksheet(saveLabel.trim());
  }

  async function handleSaveChanges() {
    if (!result || editingWorksheetId == null || saveDeckId == null) return;
    const label = saveLabel.trim() || initialSavedWorksheet?.label;
    if (!label) {
      toast.error("Worksheet label is missing.");
      return;
    }

    let planToSave = isEditing && editDraft ? editDraft : result;
    if (isEditing && editDraft) {
      if (!editDraft.instructions.trim()) {
        toast.error("Instructions cannot be empty.");
        return;
      }
      if (editDraft.items.some((item) => !item.prompt.trim() || !item.answer.trim())) {
        toast.error("Every question needs both a prompt and an answer.");
        return;
      }
      setResult(planToSave);
      setIsEditing(false);
      setEditDraft(null);
    }

    await persistWorksheet(label, editingWorksheetId);
  }

  const saveDeckId = selectedPlan?.deckId ?? initialSavedWorksheet?.deckId;

  async function persistWorksheet(label: string, worksheetId?: number) {
    if (!result || saveDeckId == null) return;
    setIsSaving(true);
    try {
      const payload = {
        label,
        input: {
          deckId: saveDeckId,
          savedLessonPlanId,
          dayScope: generationDayScope,
          teamId: teacherWorkspace?.teamId ?? undefined,
          subject: form.subject,
          gradeLevel: form.gradeLevel,
          topic: form.topic,
          worksheetType: form.worksheetType,
          difficultyLevel: form.difficultyLevel,
          numberOfQuestions: parseNumberOfQuestions(form.numberOfQuestions),
        },
        result,
      };

      const saved =
        worksheetId != null
          ? await updateWorksheetAction({
              worksheetId,
              ...payload,
              teamId: teacherWorkspace?.teamId ?? undefined,
            })
          : await saveWorksheetAction(payload);

      setSavedWorksheetId(saved.id);
      setEditingWorksheetId(saved.id);
      setSaveLabel(saved.label);
      setSaveDialogOpen(false);
      toast.success(
        worksheetId != null && initialSavedWorksheet?.id === saved.id
          ? "Worksheet updated"
          : "Worksheet saved",
        {
        description: (
          <span>
            {saved.label} was {worksheetId != null ? "updated in" : "saved to"} your{" "}
            <Link href={resourcesHref} className="underline underline-offset-2">
              Resource Library
            </Link>
            {saved.worksheetPdfUrl && saved.answerKeyPdfUrl
              ? " with worksheet and answer key PDFs"
              : saved.worksheetPdfUrl || saved.answerKeyPdfUrl
                ? " with PDF"
                : ""}
            . From lesson plan: <strong>{selectedPlan?.lessonTitle ?? saved.sourceDeckName}</strong>.
          </span>
        ),
      },
      );
    } catch (error) {
      toast.error(
        userFacingServerActionError(error, "Could not save worksheet."),
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
    <TeacherToolPageShell
      title={isEditingExistingWorksheet ? "Edit Worksheet" : "Worksheet Generator"}
      description={
        isEditingExistingWorksheet
          ? `Update ${initialSavedWorksheet.label} and save changes back to your Resource Library.`
          : "Create worksheets with student sections and teacher answer keys from a saved lesson plan."
      }
      showResult={showResult && result != null}
      isGenerating={isGenerating}
      generateLabel="Generate"
      submittingLabel="Generating…"
      generateTooltip="Choose All Days or one day, then build the worksheet with AI from that part of the lesson plan."
      errorMessage={errorMessage}
      onGenerate={handleGenerate}
      submitDisabled={savedLessonPlanId == null}
      backHref={backHref}
      previewActions={
        result ? (
          <>
            {isEditing ? (
              <>
                <Button type="button" variant="outline" size="sm" onClick={cancelEditing}>
                  <X className="size-4" aria-hidden />
                  Cancel
                </Button>
                <Button type="button" size="sm" onClick={finishEditing}>
                  Done editing
                </Button>
              </>
            ) : (
              <>
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
                <Button
                  type="button"
                  size="sm"
                  disabled={isSaving}
                  onClick={() =>
                    editingWorksheetId != null
                      ? void handleSaveChanges()
                      : openSaveDialog()
                  }
                >
                  {isSaving ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Save className="size-4" aria-hidden />
                  )}
                  {editingWorksheetId != null ? "Save changes" : "Save"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isDownloadingWorksheet}
                  onClick={handleDownloadWorksheet}
                >
                  {isDownloadingWorksheet ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Download className="size-4" aria-hidden />
                  )}
                  Worksheet PDF
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isDownloadingAnswerKey}
                  onClick={handleDownloadAnswerKey}
                >
                  {isDownloadingAnswerKey ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Download className="size-4" aria-hidden />
                  )}
                  Answer Key PDF
                </Button>
              </>
            )}
          </>
        ) : null
      }
      result={
        result ? (
          <WorksheetPreviewEditor
            result={result}
            isEditing={isEditing}
            editDraft={editDraft}
            onEditDraftChange={setEditDraft}
          />
        ) : null
      }
    >
      <TooltipProvider>
        <div className="grid gap-4 sm:grid-cols-2">
          {isEditingExistingWorksheet ? (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="worksheetPlanReadonly">Saved lesson plan</Label>
              <Input
                id="worksheetPlanReadonly"
                disabled
                value={selectedPlan?.optionLabel ?? initialSavedWorksheet.sourceDeckName}
              />
            </div>
          ) : isWorkspaceOwner ? (
            <OwnerTeamAdminResourcePicker
              ownerPicker={ownerLessonPlanPicker}
              itemsByAdminUserId={ownerLessonPlanPicker.lessonPlansByAdminUserId}
              selectedAdminUserId={selectedAdminUserId}
              onAdminChange={handleAdminChange}
              selectedItemKey={selectedPlanKey}
              onItemChange={handleLessonPlanChange}
              noneValue={PLAN_NONE}
              noneLabel="Select a lesson plan"
              placeholder="Select a lesson plan"
              resourceLabel="Saved lesson plan"
              resourceSelectId="worksheetLessonPlan"
              adminSelectId="worksheetTeamAdmin"
              getItemKey={(plan) => String(plan.id)}
              getItemLabel={(plan) => plan.optionLabel}
              getItemHaystack={lessonPlanHaystack}
              searchPlaceholder="Search lesson plans by title, subject, grade, or topic…"
              resourceHelp="Pick a lesson plan saved by the workspace owner or a team admin. Subject, grade, topic, and difficulty fill in from that plan."
              resourceFooter={
                <>
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
                  <LessonPlanSavedReferenceSummary
                    references={linkedLessonPlanReferences}
                    description="Reference materials saved with this lesson plan are included in the worksheet instructions."
                  />
                </>
              }
            />
          ) : (
          <div className="space-y-2 sm:col-span-2">
            <TeacherFieldLabel
              htmlFor="worksheetLessonPlan"
              label="Saved lesson plan"
              help="Pick a plan saved from the AI Lesson Builder. Subject, grade, topic, and difficulty will auto-fill."
            />
            <Select value={selectedPlanKey} onValueChange={handleLessonPlanChange}>
              <SelectTrigger id="worksheetLessonPlan" className="h-10 w-full bg-background">
                <SelectValue placeholder="Select a lesson plan">
                  {selectedPlan?.optionLabel ?? "Select a lesson plan"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PLAN_NONE} disabled>
                  Select a lesson plan
                </SelectItem>
                {activeLessonPlans.map((plan) => (
                  <SelectItem key={plan.id} value={String(plan.id)}>
                    {plan.optionLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeLessonPlans.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No saved lesson plans yet. Save one in the{" "}
                <Link href={lessonBuilderHref} className="underline underline-offset-2">
                  AI Lesson Builder
                </Link>{" "}
                first.
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
            <LessonPlanSavedReferenceSummary
              references={linkedLessonPlanReferences}
              description="Reference materials saved with this lesson plan are included in the worksheet instructions."
            />
          </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gradeLevel">Grade Level</Label>
            <Input
              id="gradeLevel"
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
              value={form.topic}
              onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="worksheetType">Worksheet Type</Label>
            <Input
              id="worksheetType"
              value={form.worksheetType}
              onChange={(e) =>
                setForm((f) => ({ ...f, worksheetType: e.target.value }))
              }
              required
            />
          </div>
          <div className="space-y-2">
            <TeacherFieldLabel
              htmlFor="numberOfQuestions"
              label="Number of Questions"
              help="How many practice questions to include (1–50). AI writes them from the part of the lesson plan you choose."
            />
            <Input
              id="numberOfQuestions"
              type="number"
              min={1}
              max={TEACHER_WORKSHEET_MAX_QUESTIONS}
              value={form.numberOfQuestions}
              onChange={(e) =>
                setForm((f) => ({ ...f, numberOfQuestions: e.target.value }))
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="difficultyLevel">Difficulty Level</Label>
            <Input
              id="difficultyLevel"
              value={form.difficultyLevel}
              onChange={(e) =>
                setForm((f) => ({ ...f, difficultyLevel: e.target.value }))
              }
              required
            />
          </div>
        </div>
      </TooltipProvider>
    </TeacherToolPageShell>

    <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Save worksheet</DialogTitle>
          <DialogDescription>
            Choose a label so you can find this worksheet later in your Resource
            Library. Both the student worksheet and answer key PDFs are saved.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <TeacherFieldLabel
            htmlFor="worksheetSaveLabel"
            label="Label"
            help="Use a name your future self will recognize, e.g. “Week 3 Jamaica geography worksheet”."
          />
          <Input
            id="worksheetSaveLabel"
            value={saveLabel}
            onChange={(event) => setSaveLabel(event.target.value)}
            placeholder="e.g. Geography of Jamaica practice worksheet"
            maxLength={255}
          />
          {selectedPlan ? (
            <p className="text-xs text-muted-foreground">
              From lesson plan: <span className="text-foreground">{selectedPlan.lessonTitle}</span>
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setSaveDialogOpen(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSaveWorksheet}
            disabled={isSaving || !saveLabel.trim()}
          >
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              "Save with PDFs"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <LessonPlanDayScopeDialog
      open={dayScopeDialogOpen}
      onOpenChange={setDayScopeDialogOpen}
      options={simpleDayScopeOptions}
      onConfirm={handleDayScopeConfirm}
      confirmLabel="Generate"
      title="Which part of the lesson plan?"
      description="Choose All Days or one day. The worksheet is generated only from that choice."
      infoTooltip="All Days covers the whole plan. One day uses only that day's lesson."
    />
    </>
  );
}
