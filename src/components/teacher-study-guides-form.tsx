"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Download, ExternalLink, Loader2, Pencil, RefreshCw, Save, Search, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  LessonPlanReferenceMaterialFields,
  type LessonPlanReferenceMaterial,
  type LessonPlanReferenceMaterialFieldsHandle,
} from "@/components/lesson-plan-reference-material-fields";
import { LessonPlanSavedReferenceSummary } from "@/components/lesson-plan-saved-reference-summary";
import { getLessonPlanReferenceMaterials } from "@/lib/lesson-plan-reference-material";
import { TeacherFieldLabel } from "@/components/teacher-field-label";
import { TeacherTopicFieldHelpContent } from "@/components/teacher-field-help-content";
import { TeacherToolPageShell } from "@/components/teacher-tool-page-shell";
import {
  OwnerTeamAdminResourcePicker,
  useOwnerScopedItems,
} from "@/components/owner-team-admin-resource-picker";
import type { SavedHomeworkPickerItem } from "@/db/queries/saved-homework";
import type { SavedStudyGuideEditItem } from "@/db/queries/saved-study-guides";
import type { SavedLessonPlanPickerItem } from "@/db/queries/saved-lesson-plans";
import type {
  OwnerTeamAdminHomeworkPickerPayload,
  OwnerTeamAdminLessonPlanPickerPayload,
} from "@/db/queries/teacher-owner-pickers";
import { ADMIN_NONE } from "@/lib/owner-team-admin-picker";
import { lessonPlanInputToQuizDefaults } from "@/lib/lesson-plan-quiz-context";
import { generateStudyGuideAction, saveStudyGuideAction, updateStudyGuideAction } from "@/actions/teacher-study-guide";
import { buildTeacherSubPath, type TeacherWorkspaceContext } from "@/lib/teacher-url";
import { downloadStudyGuidePdf } from "@/lib/study-guide-pdf";
import { filterHomeworkForLessonPlan, homeworkMatchesSavedLessonPlan } from "@/lib/homework-lesson-plan-link";
import type { StudyGuideResult } from "@/lib/teacher-generators";
import {
  StudyGuidePreviewEditor,
  cloneStudyGuideResult,
} from "@/components/study-guide-preview-editor";
import { savedStudyGuideResultSchema } from "@/lib/teacher-study-guide-ai-schema";

const SAVED_PLAN_NONE = "__none__";
const HOMEWORK_NONE = "__none__";

type StudyGuideFormState = {
  subject: string;
  gradeLevel: string;
  topic: string;
  savedLessonPlanId?: number;
  savedHomeworkId?: number;
};

const EMPTY_FORM: StudyGuideFormState = {
  subject: "",
  gradeLevel: "",
  topic: "",
};

export function TeacherStudyGuidesForm({
  savedLessonPlans = [],
  savedHomework = [],
  ownerLessonPlanPicker,
  ownerHomeworkPicker,
  hasAdvancedSourceImport = false,
  initialLessonPlanId,
  initialHomeworkId,
  initialSavedStudyGuide,
  backHref = "/teacher",
  teacherWorkspace,
}: {
  savedLessonPlans?: SavedLessonPlanPickerItem[];
  savedHomework?: SavedHomeworkPickerItem[];
  ownerLessonPlanPicker: OwnerTeamAdminLessonPlanPickerPayload;
  ownerHomeworkPicker: OwnerTeamAdminHomeworkPickerPayload;
  hasAdvancedSourceImport?: boolean;
  initialLessonPlanId?: number;
  initialHomeworkId?: number;
  initialSavedStudyGuide?: SavedStudyGuideEditItem;
  backHref?: string;
  teacherWorkspace?: TeacherWorkspaceContext;
}) {
  const isEditingExistingStudyGuide = initialSavedStudyGuide != null;
  const referenceFieldsRef = useRef<LessonPlanReferenceMaterialFieldsHandle>(null);
  const [referenceMaterials, setReferenceMaterials] = useState<
    LessonPlanReferenceMaterial[]
  >(initialSavedStudyGuide?.input.referenceMaterials ?? []);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [form, setForm] = useState<StudyGuideFormState>(
    initialSavedStudyGuide
      ? {
          subject: initialSavedStudyGuide.input.subject,
          gradeLevel: initialSavedStudyGuide.input.gradeLevel,
          topic: initialSavedStudyGuide.input.topic,
          savedLessonPlanId: initialSavedStudyGuide.input.savedLessonPlanId,
          savedHomeworkId: initialSavedStudyGuide.input.savedHomeworkId,
        }
      : EMPTY_FORM,
  );
  const [selectedPlanKey, setSelectedPlanKey] = useState<string>(
    initialSavedStudyGuide?.savedLessonPlanId != null
      ? String(initialSavedStudyGuide.savedLessonPlanId)
      : SAVED_PLAN_NONE,
  );
  const [selectedHomeworkKey, setSelectedHomeworkKey] = useState<string>(
    initialSavedStudyGuide?.savedHomeworkId != null
      ? String(initialSavedStudyGuide.savedHomeworkId)
      : HOMEWORK_NONE,
  );
  const [result, setResult] = useState<StudyGuideResult | null>(
    initialSavedStudyGuide?.result ?? null,
  );
  const [showResult, setShowResult] = useState(isEditingExistingStudyGuide);
  const [isGenerating, setIsGenerating] = useState(false);
  const [regenerationSeed, setRegenerationSeed] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [savedStudyGuideId, setSavedStudyGuideId] = useState<number | null>(
    isEditingExistingStudyGuide ? initialSavedStudyGuide.id : null,
  );
  const [editingStudyGuideId, setEditingStudyGuideId] = useState<number | null>(
    isEditingExistingStudyGuide ? initialSavedStudyGuide.id : null,
  );
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveLabel, setSaveLabel] = useState(initialSavedStudyGuide?.label ?? "");
  const [isEditing, setIsEditing] = useState(isEditingExistingStudyGuide);
  const [editDraft, setEditDraft] = useState<StudyGuideResult | null>(
    initialSavedStudyGuide ? cloneStudyGuideResult(initialSavedStudyGuide.result) : null,
  );
  const [selectedAdminUserId, setSelectedAdminUserId] = useState<string>(ADMIN_NONE);
  const [homeworkSearchQuery, setHomeworkSearchQuery] = useState("");

  const isWorkspaceOwner = ownerLessonPlanPicker.isWorkspaceOwner;
  const activeLessonPlans = useOwnerScopedItems(
    isWorkspaceOwner,
    selectedAdminUserId,
    ownerLessonPlanPicker.lessonPlansByAdminUserId,
    savedLessonPlans,
  );
  const activeHomework = useOwnerScopedItems(
    isWorkspaceOwner,
    selectedAdminUserId,
    ownerHomeworkPicker.itemsByAdminUserId,
    savedHomework,
  );

  const allLessonPlans = useMemo(() => {
    if (!isWorkspaceOwner) {
      return savedLessonPlans;
    }
    const merged = Object.values(ownerLessonPlanPicker.lessonPlansByAdminUserId).flat();
    const byId = new Map(merged.map((plan) => [plan.id, plan]));
    for (const plan of savedLessonPlans) {
      byId.set(plan.id, plan);
    }
    return [...byId.values()];
  }, [
    isWorkspaceOwner,
    savedLessonPlans,
    ownerLessonPlanPicker.lessonPlansByAdminUserId,
  ]);

  const homeworkPool = useMemo(() => {
    if (!isWorkspaceOwner) {
      return activeHomework;
    }
    const merged = Object.values(ownerHomeworkPicker.itemsByAdminUserId).flat();
    const byId = new Map(merged.map((item) => [item.id, item]));
    return [...byId.values()];
  }, [isWorkspaceOwner, activeHomework, ownerHomeworkPicker.itemsByAdminUserId]);

  const selectedPlan =
    form.savedLessonPlanId != null
      ? allLessonPlans.find((plan) => plan.id === form.savedLessonPlanId) ?? null
      : null;

  const homeworkForPlan = useMemo(
    () => filterHomeworkForLessonPlan(homeworkPool, selectedPlan, form.savedLessonPlanId),
    [homeworkPool, selectedPlan, form.savedLessonPlanId],
  );

  const filteredHomeworkForPlan = useMemo(() => {
    const query = homeworkSearchQuery.trim().toLowerCase();
    if (!query) return homeworkForPlan;
    return homeworkForPlan.filter((item) =>
      [item.label, item.assignmentTitle, item.subject, item.topic]
        .filter((part) => part.trim())
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [homeworkForPlan, homeworkSearchQuery]);

  const selectedHomework =
    form.savedHomeworkId != null
      ? homeworkForPlan.find((item) => item.id === form.savedHomeworkId) ?? null
      : null;

  const lessonBuilderHref = teacherWorkspace
    ? buildTeacherSubPath(
        "/lesson-builder",
        teacherWorkspace.teamId,
        teacherWorkspace.teamMemberId,
      )
    : "/teacher/lesson-builder";

  const homeworkHref = teacherWorkspace
    ? buildTeacherSubPath(
        "/homework",
        teacherWorkspace.teamId,
        teacherWorkspace.teamMemberId,
      )
    : "/teacher/homework";

  const homeworkHrefForSelectedPlan =
    form.savedLessonPlanId != null
      ? `${homeworkHref}?lessonPlanId=${form.savedLessonPlanId}&sourceType=lesson_plan`
      : homeworkHref;

  const resourcesHref = teacherWorkspace
    ? buildTeacherSubPath(
        "/resources",
        teacherWorkspace.teamId,
        teacherWorkspace.teamMemberId,
      )
    : "/teacher/resources";

  function handleAdminChange(adminUserId: string) {
    setSelectedAdminUserId(adminUserId);
    setHomeworkSearchQuery("");
    setSelectedPlanKey(SAVED_PLAN_NONE);
    setSelectedHomeworkKey(HOMEWORK_NONE);
    setForm(EMPTY_FORM);
  }

  function lessonPlanHaystack(plan: SavedLessonPlanPickerItem): string {
    return [plan.lessonTitle, plan.subject, plan.gradeLevel, plan.topic]
      .filter((part) => part.trim())
      .join(" ")
      .toLowerCase();
  }

  function handleSavedPlanChange(value: string | null) {
    if (!value || value === SAVED_PLAN_NONE) {
      setSelectedPlanKey(SAVED_PLAN_NONE);
      setSelectedHomeworkKey(HOMEWORK_NONE);
      setHomeworkSearchQuery("");
      setReferenceMaterials([]);
      setForm(EMPTY_FORM);
      return;
    }

    const planId = Number(value);
    const plan = activeLessonPlans.find((item) => item.id === planId);
    if (!plan) return;

    const defaults = lessonPlanInputToQuizDefaults(plan.input);
    setSelectedPlanKey(value);
    setSelectedHomeworkKey(HOMEWORK_NONE);
    setHomeworkSearchQuery("");
    setReferenceMaterials(getLessonPlanReferenceMaterials(plan.input));
    setForm({
      savedLessonPlanId: plan.id,
      subject: defaults.subject,
      gradeLevel: defaults.gradeLevel,
      topic: defaults.topic,
    });
  }

  function handleHomeworkChange(value: string | null) {
    if (!value || value === HOMEWORK_NONE) {
      setSelectedHomeworkKey(HOMEWORK_NONE);
      setForm((current) => ({
        ...current,
        savedHomeworkId: undefined,
      }));
      return;
    }

    const homeworkId = Number(value);
    const homework = homeworkForPlan.find((item) => item.id === homeworkId);
    if (!homework) return;

    setSelectedHomeworkKey(value);
    setForm((current) => ({
      ...current,
      savedHomeworkId: homework.id,
    }));
  }

  useEffect(() => {
    if (initialSavedStudyGuide) return;
    if (initialHomeworkId) {
      const homework =
        homeworkPool.find((item) => item.id === initialHomeworkId) ??
        activeHomework.find((item) => item.id === initialHomeworkId);
      if (homework) {
        const linkedPlanId = homework.savedLessonPlanId ?? homework.inputSavedLessonPlanId;
        const plan =
          linkedPlanId != null
            ? allLessonPlans.find((item) => item.id === linkedPlanId) ?? null
            : allLessonPlans.find((item) =>
                homeworkMatchesSavedLessonPlan(homework, item),
              ) ?? null;
        if (plan) {
          const defaults = lessonPlanInputToQuizDefaults(plan.input);
          if (isWorkspaceOwner) {
            const adminWithPlan = ownerLessonPlanPicker.teamAdmins.find((admin) =>
              (ownerLessonPlanPicker.lessonPlansByAdminUserId[admin.userId] ?? []).some(
                (item) => item.id === plan.id,
              ),
            );
            if (adminWithPlan) {
              setSelectedAdminUserId(adminWithPlan.userId);
            }
          }
          setSelectedPlanKey(String(plan.id));
          setSelectedHomeworkKey(String(homework.id));
          setReferenceMaterials(getLessonPlanReferenceMaterials(plan.input));
          setForm({
            savedLessonPlanId: plan.id,
            savedHomeworkId: homework.id,
            subject: defaults.subject,
            gradeLevel: defaults.gradeLevel,
            topic: defaults.topic,
          });
          return;
        }
      }
    }

    if (!initialLessonPlanId) return;
    const exists = activeLessonPlans.some((plan) => plan.id === initialLessonPlanId);
    if (exists) {
      if (isWorkspaceOwner) {
        const adminWithPlan = ownerLessonPlanPicker.teamAdmins.find((admin) =>
          (ownerLessonPlanPicker.lessonPlansByAdminUserId[admin.userId] ?? []).some(
            (item) => item.id === initialLessonPlanId,
          ),
        );
        if (adminWithPlan) {
          setSelectedAdminUserId(adminWithPlan.userId);
        }
      }
      handleSavedPlanChange(String(initialLessonPlanId));
    }
  }, [
    initialHomeworkId,
    initialLessonPlanId,
    activeHomework,
    homeworkPool,
    allLessonPlans,
    activeLessonPlans,
    isWorkspaceOwner,
    ownerLessonPlanPicker,
    initialSavedStudyGuide,
  ]);

  async function runGeneration(isRegenerate = false) {
    setIsGenerating(true);
    setErrorMessage(null);
    setReferenceError(null);

    const seed = isRegenerate ? regenerationSeed + 1 : 0;
    if (isRegenerate) {
      setRegenerationSeed(seed);
    } else {
      setRegenerationSeed(0);
    }

    try {
      const resolvedReferences = isRegenerate
        ? referenceMaterials
        : ((await referenceFieldsRef.current?.resolveReferences()) ?? referenceMaterials);

      if (!isRegenerate && resolvedReferences.length > 0) {
        setReferenceMaterials(resolvedReferences);
      }

      const studyGuide = await generateStudyGuideAction({
        subject: form.subject,
        gradeLevel: form.gradeLevel,
        topic: form.topic,
        savedLessonPlanId: form.savedLessonPlanId,
        savedHomeworkId: form.savedHomeworkId,
        referenceMaterials:
          resolvedReferences.length > 0 ? resolvedReferences : undefined,
        teamId: teacherWorkspace?.teamId ?? undefined,
      });

      setResult(studyGuide);
      setShowResult(true);
      setSavedStudyGuideId(null);
      setIsEditing(false);
      setEditDraft(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Study guide generation failed. Please try again.";
      setErrorMessage(message);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleGenerate() {
    await runGeneration(false);
  }

  function handleRegenerate() {
    void runGeneration(true);
  }

  function openSaveDialog() {
    if (!result) return;
    setSaveLabel(`${form.topic.trim() || "Topic"} Study Guide`);
    setSaveDialogOpen(true);
  }

  function startEditing() {
    if (!result) return;
    setEditDraft(cloneStudyGuideResult(result));
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setEditDraft(null);
  }

  function finishEditing() {
    if (!editDraft) return;
    const parsed = savedStudyGuideResultSchema.safeParse(editDraft);
    if (!parsed.success) {
      toast.error("Each section needs at least one item and a non-empty summary.");
      return;
    }
    setResult(parsed.data);
    setSavedStudyGuideId(null);
    setIsEditing(false);
    setEditDraft(null);
    toast.success("Study guide updated", {
      description: "Your edits are ready to save or download.",
    });
  }

  async function handleSaveStudyGuide() {
    if (!result || !saveLabel.trim()) return;
    await persistStudyGuide(saveLabel.trim());
  }

  async function handleSaveChanges() {
    if (!result || editingStudyGuideId == null) return;
    const label = saveLabel.trim() || initialSavedStudyGuide?.label;
    if (!label) {
      toast.error("Study guide label is missing.");
      return;
    }

    let planToSave = isEditing && editDraft ? editDraft : result;
    if (isEditing && editDraft) {
      const parsed = savedStudyGuideResultSchema.safeParse(editDraft);
      if (!parsed.success) {
        toast.error("Each section needs at least one item and a non-empty summary.");
        return;
      }
      setResult(parsed.data);
      setIsEditing(false);
      setEditDraft(null);
    }

    await persistStudyGuide(label, editingStudyGuideId);
  }

  async function persistStudyGuide(label: string, studyGuideId?: number) {
    if (!result) return;
    setIsSaving(true);
    try {
      const resolvedReferences =
        referenceMaterials.length > 0
          ? referenceMaterials
          : ((await referenceFieldsRef.current?.resolveReferences()) ?? []);

      const payload = {
        label,
        input: {
          subject: form.subject,
          gradeLevel: form.gradeLevel,
          topic: form.topic,
          savedLessonPlanId: form.savedLessonPlanId,
          savedHomeworkId: form.savedHomeworkId,
          referenceMaterials:
            resolvedReferences.length > 0 ? resolvedReferences : undefined,
          teamId: teacherWorkspace?.teamId ?? undefined,
        },
        result,
      };

      const saved =
        studyGuideId != null
          ? await updateStudyGuideAction({ studyGuideId, ...payload })
          : await saveStudyGuideAction(payload);

      setSavedStudyGuideId(saved.id);
      setEditingStudyGuideId(saved.id);
      setSaveLabel(saved.label);
      setSaveDialogOpen(false);
      toast.success(
        studyGuideId != null && initialSavedStudyGuide?.id === saved.id
          ? "Study guide updated"
          : "Study guide saved",
        {
        description: (
          <span>
            {saved.label} was {studyGuideId != null ? "updated in" : "saved to"} your{" "}
            <Link href={resourcesHref} className="underline underline-offset-2">
              Resource Library
            </Link>
            {saved.pdfUrl ? " with PDF" : ""}.
            {saved.sourceLessonPlanTitle ? (
              <>
                {" "}
                Linked to lesson plan: <strong>{saved.sourceLessonPlanTitle}</strong>.
              </>
            ) : null}
            {saved.sourceHomeworkLabel ? (
              <>
                {" "}
                Linked to homework: <strong>{saved.sourceHomeworkLabel}</strong>.
              </>
            ) : null}
          </span>
        ),
      },
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save study guide.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDownloadPdf() {
    if (!result) return;
    setIsDownloading(true);
    try {
      await downloadStudyGuidePdf(result, {
        subject: form.subject,
        gradeLevel: form.gradeLevel,
        topic: form.topic,
      });
    } finally {
      setIsDownloading(false);
    }
  }

  const selectedPlanLabel = selectedPlan
    ? `${selectedPlan.lessonTitle} (${selectedPlan.subject} · ${selectedPlan.gradeLevel})`
    : null;

  const selectedHomeworkLabel = selectedHomework?.label ?? null;

  return (
    <>
    <TeacherToolPageShell
      title={isEditingExistingStudyGuide ? "Edit Study Guide" : "Study Guide Generator"}
      description={
        isEditingExistingStudyGuide
          ? `Update ${initialSavedStudyGuide.label} and save changes back to your Resource Library.`
          : "Build study guides with summaries, vocabulary, and practice questions."
      }
      backHref={backHref}
      showResult={showResult}
      onGenerate={handleGenerate}
      isGenerating={isGenerating}
      generateWithAiIcon
      generateLabel="Generate"
      submittingLabel="Generating…"
      errorMessage={errorMessage ?? referenceError}
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
                  className="gap-2"
                  disabled={isGenerating || isSaving}
                  onClick={startEditing}
                >
                  <Pencil className="size-4" aria-hidden />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={isSaving}
                  onClick={() =>
                    editingStudyGuideId != null
                      ? void handleSaveChanges()
                      : openSaveDialog()
                  }
                >
                  {isSaving ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Save className="size-4" aria-hidden />
                  )}
                  {editingStudyGuideId != null ? "Save changes" : "Save"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={isGenerating}
                  onClick={handleRegenerate}
                >
                  {isGenerating ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <RefreshCw className="size-4" aria-hidden />
                  )}
                  Regenerate AI
                </Button>
              </>
            )}
          </>
        ) : null
      }
      result={
        result ? (
          <StudyGuidePreviewEditor
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
          {isWorkspaceOwner ? (
            <OwnerTeamAdminResourcePicker
              ownerPicker={ownerLessonPlanPicker}
              itemsByAdminUserId={ownerLessonPlanPicker.lessonPlansByAdminUserId}
              selectedAdminUserId={selectedAdminUserId}
              onAdminChange={handleAdminChange}
              selectedItemKey={selectedPlanKey}
              onItemChange={handleSavedPlanChange}
              noneValue={SAVED_PLAN_NONE}
              noneLabel="No saved lesson plan"
              placeholder="No saved lesson plan"
              resourceLabel="Saved lesson plan (optional)"
              resourceSelectId="studyGuideLessonPlan"
              adminSelectId="studyGuideTeamAdmin"
              getItemKey={(plan) => String(plan.id)}
              getItemLabel={(plan) => `${plan.lessonTitle} (${plan.subject} · ${plan.gradeLevel})`}
              getItemHaystack={lessonPlanHaystack}
              searchPlaceholder="Search lesson plans by title, subject, grade, or topic…"
              resourceHelp={
                <>
                  <p className="mb-1 font-semibold">Example:</p>
                  <p>
                    Select a plan saved from the AI Lesson Builder. Subject, grade,
                    and topic will auto-fill for your study guide.
                  </p>
                </>
              }
              resourceFooter={
                selectedPlan?.pdfUrl ? (
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
                ) : null
              }
            />
          ) : (
          <div className="space-y-2 sm:col-span-2">
            <TeacherFieldLabel
              htmlFor="studyGuideLessonPlan"
              label="Saved lesson plan (optional)"
              help={
                <>
                  <p className="mb-1 font-semibold">Example:</p>
                  <p>
                    Select a plan saved from the AI Lesson Builder. Subject, grade,
                    and topic will auto-fill for your study guide.
                  </p>
                </>
              }
            />
            <Select value={selectedPlanKey} onValueChange={handleSavedPlanChange}>
              <SelectTrigger id="studyGuideLessonPlan" className="h-10 w-full bg-background">
                <SelectValue placeholder="Select a saved lesson plan">
                  {selectedPlanLabel ?? "No saved lesson plan"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SAVED_PLAN_NONE}>No saved lesson plan</SelectItem>
                {activeLessonPlans.map((plan) => (
                  <SelectItem key={plan.id} value={String(plan.id)}>
                    {plan.lessonTitle} ({plan.subject} · {plan.gradeLevel})
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
          </div>
          )}

          {form.savedLessonPlanId != null ? (
            <div className="space-y-2 sm:col-span-2">
              <TeacherFieldLabel
                htmlFor="studyGuideHomework"
                label="Homework assignment (optional)"
                help="If you generated homework from this lesson plan, select it to align the study guide with those questions."
              />
              {homeworkForPlan.length > 0 ? (
                <>
                  {isWorkspaceOwner ? (
                    <div className="relative">
                      <Search
                        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden
                      />
                      <Input
                        value={homeworkSearchQuery}
                        onChange={(e) => setHomeworkSearchQuery(e.target.value)}
                        placeholder="Search homework by label, title, subject, or topic…"
                        className="pl-9"
                        aria-label="Search homework assignments"
                      />
                    </div>
                  ) : null}
                  <Select value={selectedHomeworkKey} onValueChange={handleHomeworkChange}>
                    <SelectTrigger id="studyGuideHomework" className="h-10 w-full bg-background">
                      <SelectValue placeholder="Select homework">
                        {selectedHomeworkLabel ?? "No homework selected"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={HOMEWORK_NONE}>No homework selected</SelectItem>
                      {(isWorkspaceOwner ? filteredHomeworkForPlan : homeworkForPlan).map(
                        (homework) => (
                          <SelectItem key={homework.id} value={String(homework.id)}>
                            {homework.label} ({homework.assignmentTitle})
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                  {isWorkspaceOwner &&
                  homeworkForPlan.length > 0 &&
                  filteredHomeworkForPlan.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No homework matches your search.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No saved homework for this lesson plan. Generate homework in the{" "}
                  <Link href={homeworkHrefForSelectedPlan} className="underline underline-offset-2">
                    Homework Generator
                  </Link>{" "}
                  using this lesson plan as the source.
                </p>
              )}
            </div>
          ) : null}

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

          {(isEditingExistingStudyGuide && referenceMaterials.length > 0) ||
          (form.savedLessonPlanId != null &&
            getLessonPlanReferenceMaterials(selectedPlan?.input).length > 0) ? (
            <LessonPlanSavedReferenceSummary
              references={
                referenceMaterials.length > 0
                  ? referenceMaterials
                  : getLessonPlanReferenceMaterials(selectedPlan?.input)
              }
            />
          ) : (
            <LessonPlanReferenceMaterialFields
              ref={referenceFieldsRef}
              hasAdvancedSourceImport={hasAdvancedSourceImport}
              disabled={isGenerating}
              value={referenceMaterials}
              onChange={setReferenceMaterials}
              onError={setReferenceError}
            />
          )}
        </div>
      </TooltipProvider>
    </TeacherToolPageShell>

    <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Save study guide</DialogTitle>
          <DialogDescription>
            Choose a label so you can find this study guide later in your Resource
            Library. A PDF copy is stored when upload is available.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <TeacherFieldLabel
            htmlFor="studyGuideSaveLabel"
            label="Label"
            help='Use a name your future self will recognize, e.g. "PEP 2026 Jamaica geography guide".'
          />
          <Input
            id="studyGuideSaveLabel"
            value={saveLabel}
            onChange={(event) => setSaveLabel(event.target.value)}
            placeholder="e.g. Grade 6 — Geography of Jamaica study guide"
            maxLength={255}
          />
          {selectedPlan ? (
            <p className="text-xs text-muted-foreground">
              From lesson plan: <span className="text-foreground">{selectedPlan.lessonTitle}</span>
            </p>
          ) : null}
          {selectedHomework ? (
            <p className="text-xs text-muted-foreground">
              From homework: <span className="text-foreground">{selectedHomework.label}</span>
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
            disabled={isSaving || !saveLabel.trim()}
            onClick={() => void handleSaveStudyGuide()}
          >
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              "Save study guide"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  );
}
