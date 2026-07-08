"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, ExternalLink, Loader2, Pencil, Save, X } from "lucide-react";
import { generateHomeworkAction, saveHomeworkAction } from "@/actions/teacher-homework";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  cloneHomeworkResult,
  HomeworkPreviewEditor,
} from "@/components/homework-preview-editor";
import { TeacherFieldLabel } from "@/components/teacher-field-label";
import { TeacherTopicFieldHelpContent } from "@/components/teacher-field-help-content";
import { TeacherToolPageShell } from "@/components/teacher-tool-page-shell";
import {
  OwnerTeamAdminResourcePicker,
  useOwnerScopedItems,
} from "@/components/owner-team-admin-resource-picker";
import type { SavedLessonPlanPickerItem } from "@/db/queries/saved-lesson-plans";
import type {
  OwnerTeamAdminDeckPickerPayload,
  OwnerTeamAdminLessonPlanPickerPayload,
} from "@/db/queries/teacher-owner-pickers";
import { ADMIN_NONE } from "@/lib/owner-team-admin-picker";
import type { DeckRow } from "@/db/queries/decks";
import { deckToHomeworkDefaults } from "@/lib/homework-source-context";
import { downloadHomeworkPdf } from "@/lib/homework-pdf";
import { lessonPlanInputToQuizDefaults } from "@/lib/lesson-plan-quiz-context";
import type { HomeworkResult } from "@/lib/teacher-homework-ai-schema";
import type { HomeworkSourceType } from "@/lib/teacher-homework-ai-schema";
import {
  buildTeacherQuizzesPath,
  buildTeacherSubPath,
  type TeacherWorkspaceContext,
} from "@/lib/teacher-url";
import { buildHomeworkExamplePreview } from "@/lib/homework-example-preview";
import { toast } from "sonner";

const SOURCE_NONE = "__none__";

const DIFFICULTY_OPTIONS = [
  "On-level",
  "Beginner",
  "Intermediate",
  "Advanced",
  "Honors/Gifted",
] as const;

type HomeworkFormState = {
  subject: string;
  gradeLevel: string;
  topic: string;
  numberOfQuestions: number;
  difficultyLevel: string;
};

const EMPTY_FORM: HomeworkFormState = {
  subject: "",
  gradeLevel: "",
  topic: "",
  numberOfQuestions: 8,
  difficultyLevel: "On-level",
};

export function TeacherHomeworkForm({
  savedLessonPlans,
  ownerLessonPlanPicker,
  ownerDeckPicker,
  decks,
  backHref = "/teacher",
  teacherWorkspace,
  initialDeckId,
  initialLessonPlanId,
  initialSourceType,
}: {
  savedLessonPlans: SavedLessonPlanPickerItem[];
  ownerLessonPlanPicker: OwnerTeamAdminLessonPlanPickerPayload;
  ownerDeckPicker: OwnerTeamAdminDeckPickerPayload;
  decks: DeckRow[];
  backHref?: string;
  teacherWorkspace?: TeacherWorkspaceContext;
  initialDeckId?: number;
  initialLessonPlanId?: number;
  initialSourceType?: HomeworkSourceType;
}) {
  const isWorkspaceOwner = ownerLessonPlanPicker.isWorkspaceOwner;
  const initialDeck =
    !isWorkspaceOwner && initialDeckId != null
      ? decks.find((deck) => deck.id === initialDeckId) ?? null
      : null;
  const initialDeckDefaults = initialDeck ? deckToHomeworkDefaults(initialDeck) : null;

  const [sourceType, setSourceType] = useState<HomeworkSourceType>(
    initialSourceType ??
      (initialLessonPlanId != null
        ? "lesson_plan"
        : initialDeck
          ? "deck"
          : "topic"),
  );
  const [selectedPlanKey, setSelectedPlanKey] = useState<string>(SOURCE_NONE);
  const [selectedDeckKey, setSelectedDeckKey] = useState<string>(
    initialDeck ? String(initialDeck.id) : SOURCE_NONE,
  );
  const [savedLessonPlanId, setSavedLessonPlanId] = useState<number | undefined>();
  const [deckId, setDeckId] = useState<number | undefined>(initialDeck?.id);
  const [form, setForm] = useState<HomeworkFormState>(
    initialDeckDefaults
      ? {
          subject: initialDeckDefaults.subject,
          gradeLevel: initialDeckDefaults.gradeLevel,
          topic: initialDeckDefaults.topic,
          numberOfQuestions: 8,
          difficultyLevel: initialDeckDefaults.difficultyLevel,
        }
      : EMPTY_FORM,
  );
  const [result, setResult] = useState<HomeworkResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [savedHomeworkId, setSavedHomeworkId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<HomeworkResult | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveLabel, setSaveLabel] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedLessonPlanAdminUserId, setSelectedLessonPlanAdminUserId] =
    useState<string>(ADMIN_NONE);
  const [selectedDeckAdminUserId, setSelectedDeckAdminUserId] =
    useState<string>(ADMIN_NONE);

  const activeLessonPlans = useOwnerScopedItems(
    isWorkspaceOwner,
    selectedLessonPlanAdminUserId,
    ownerLessonPlanPicker.lessonPlansByAdminUserId,
    savedLessonPlans,
  );
  const activeDecks = useOwnerScopedItems(
    isWorkspaceOwner,
    selectedDeckAdminUserId,
    ownerDeckPicker.itemsByAdminUserId,
    decks,
  );

  const selectedPlan =
    savedLessonPlanId != null
      ? activeLessonPlans.find((plan) => plan.id === savedLessonPlanId) ?? null
      : null;

  const selectedDeck =
    deckId != null ? activeDecks.find((deck) => deck.id === deckId) ?? null : null;

  function handleLessonPlanAdminChange(adminUserId: string) {
    setSelectedLessonPlanAdminUserId(adminUserId);
    setSelectedPlanKey(SOURCE_NONE);
    setSavedLessonPlanId(undefined);
    if (sourceType === "lesson_plan") {
      setForm(EMPTY_FORM);
    }
    setErrorMessage(null);
  }

  function handleDeckAdminChange(adminUserId: string) {
    setSelectedDeckAdminUserId(adminUserId);
    setSelectedDeckKey(SOURCE_NONE);
    setDeckId(undefined);
    if (sourceType === "deck") {
      setForm(EMPTY_FORM);
    }
    setErrorMessage(null);
  }

  function lessonPlanHaystack(plan: SavedLessonPlanPickerItem): string {
    return [plan.lessonTitle, plan.subject, plan.gradeLevel, plan.topic]
      .filter((part) => part.trim())
      .join(" ")
      .toLowerCase();
  }

  function deckHaystack(deck: DeckRow): string {
    return [deck.name, deck.description, deck.gradeLevel]
      .filter((part): part is string => Boolean(part && part.trim()))
      .join(" ")
      .toLowerCase();
  }

  function handleSourceTypeChange(value: HomeworkSourceType) {
    setSourceType(value);
    setSelectedPlanKey(SOURCE_NONE);
    setSelectedDeckKey(SOURCE_NONE);
    setSavedLessonPlanId(undefined);
    setDeckId(undefined);
    setForm(EMPTY_FORM);
    setErrorMessage(null);
  }

  function handleLessonPlanChange(value: string | null) {
    if (!value || value === SOURCE_NONE) {
      setSelectedPlanKey(SOURCE_NONE);
      setSavedLessonPlanId(undefined);
      setForm(EMPTY_FORM);
      return;
    }

    const planId = Number(value);
    const plan = activeLessonPlans.find((item) => item.id === planId);
    if (!plan) return;

    const defaults = lessonPlanInputToQuizDefaults(plan.input);
    setSelectedPlanKey(value);
    setSavedLessonPlanId(plan.id);
    setForm({
      subject: defaults.subject,
      gradeLevel: defaults.gradeLevel,
      topic: defaults.topic,
      numberOfQuestions: 8,
      difficultyLevel:
        defaults.difficultyLevel === "All" ? "On-level" : defaults.difficultyLevel,
    });
  }

  function handleDeckChange(value: string | null) {
    if (!value || value === SOURCE_NONE) {
      setSelectedDeckKey(SOURCE_NONE);
      setDeckId(undefined);
      setForm(EMPTY_FORM);
      return;
    }

    const id = Number(value);
    const deck = activeDecks.find((item) => item.id === id);
    if (!deck) return;

    const defaults = deckToHomeworkDefaults(deck);
    setSelectedDeckKey(value);
    setDeckId(deck.id);
    setForm({
      subject: defaults.subject,
      gradeLevel: defaults.gradeLevel,
      topic: defaults.topic,
      numberOfQuestions: 8,
      difficultyLevel: defaults.difficultyLevel,
    });
  }

  useEffect(() => {
    if (!initialDeckId || !isWorkspaceOwner) return;
    const adminWithDeck = ownerDeckPicker.teamAdmins.find((admin) =>
      (ownerDeckPicker.itemsByAdminUserId[admin.userId] ?? []).some(
        (item) => item.id === initialDeckId,
      ),
    );
    if (!adminWithDeck) return;

    const deck = ownerDeckPicker.itemsByAdminUserId[adminWithDeck.userId]?.find(
      (item) => item.id === initialDeckId,
    );
    if (!deck) return;

    const defaults = deckToHomeworkDefaults(deck);
    setSourceType(initialSourceType ?? "deck");
    setSelectedDeckAdminUserId(adminWithDeck.userId);
    setSelectedDeckKey(String(initialDeckId));
    setDeckId(deck.id);
    setForm({
      subject: defaults.subject,
      gradeLevel: defaults.gradeLevel,
      topic: defaults.topic,
      numberOfQuestions: 8,
      difficultyLevel: defaults.difficultyLevel,
    });
  }, [initialDeckId, initialSourceType, isWorkspaceOwner, ownerDeckPicker]);

  useEffect(() => {
    if (!initialLessonPlanId) return;

    if (isWorkspaceOwner) {
      const adminWithPlan = ownerLessonPlanPicker.teamAdmins.find((admin) =>
        (ownerLessonPlanPicker.lessonPlansByAdminUserId[admin.userId] ?? []).some(
          (item) => item.id === initialLessonPlanId,
        ),
      );
      if (!adminWithPlan) return;

      const plan = ownerLessonPlanPicker.lessonPlansByAdminUserId[adminWithPlan.userId]?.find(
        (item) => item.id === initialLessonPlanId,
      );
      if (!plan) return;

      const defaults = lessonPlanInputToQuizDefaults(plan.input);
      setSourceType("lesson_plan");
      setSelectedLessonPlanAdminUserId(adminWithPlan.userId);
      setSelectedPlanKey(String(initialLessonPlanId));
      setSavedLessonPlanId(plan.id);
      setForm({
        subject: defaults.subject,
        gradeLevel: defaults.gradeLevel,
        topic: defaults.topic,
        numberOfQuestions: 8,
        difficultyLevel:
          defaults.difficultyLevel === "All" ? "On-level" : defaults.difficultyLevel,
      });
      return;
    }

    const plan = savedLessonPlans.find((item) => item.id === initialLessonPlanId);
    if (!plan) return;

    const defaults = lessonPlanInputToQuizDefaults(plan.input);
    setSourceType("lesson_plan");
    setSelectedPlanKey(String(initialLessonPlanId));
    setSavedLessonPlanId(plan.id);
    setForm({
      subject: defaults.subject,
      gradeLevel: defaults.gradeLevel,
      topic: defaults.topic,
      numberOfQuestions: 8,
      difficultyLevel:
        defaults.difficultyLevel === "All" ? "On-level" : defaults.difficultyLevel,
    });
  }, [initialLessonPlanId, isWorkspaceOwner, ownerLessonPlanPicker, savedLessonPlans]);

  const lessonBuilderHref = teacherWorkspace
    ? buildTeacherSubPath(
        "/lesson-builder",
        teacherWorkspace.teamId,
        teacherWorkspace.teamMemberId,
      )
    : "/teacher/lesson-builder";
  const quizzesHref = teacherWorkspace
    ? buildTeacherQuizzesPath(
        teacherWorkspace.teamId,
        teacherWorkspace.teamMemberId,
      )
    : "/teacher/quizzes";

  async function handleGenerate() {
    setIsGenerating(true);
    setErrorMessage(null);

    try {
      if (sourceType === "lesson_plan" && savedLessonPlanId == null) {
        throw new Error("Select a saved lesson plan.");
      }
      if (sourceType === "deck" && deckId == null) {
        throw new Error("Select a deck.");
      }

      const homework = await generateHomeworkAction({
        sourceType,
        savedLessonPlanId,
        deckId,
        subject: form.subject,
        gradeLevel: form.gradeLevel,
        topic: form.topic,
        numberOfQuestions: form.numberOfQuestions,
        difficultyLevel: form.difficultyLevel,
        teamId: teacherWorkspace?.teamId ?? undefined,
      });
      setResult(homework);
      setShowResult(true);
      setSavedHomeworkId(null);
      setIsEditing(false);
      setEditDraft(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Homework generation failed. Please try again.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  const generateTooltip =
    sourceType === "lesson_plan"
      ? "Generate homework from the selected lesson plan."
      : sourceType === "deck"
        ? "Generate homework from the selected deck's flashcards."
        : "Generate homework from the topic fields below.";

  const submitDisabled =
    (sourceType === "lesson_plan" && savedLessonPlanId == null) ||
    (sourceType === "deck" && deckId == null);

  const examplePreview = useMemo(
    () => buildHomeworkExamplePreview(form),
    [form.subject, form.gradeLevel, form.topic, form.difficultyLevel],
  );

  const resourcesHref = teacherWorkspace
    ? buildTeacherSubPath(
        "/resources",
        teacherWorkspace.teamId,
        teacherWorkspace.teamMemberId,
      )
    : "/teacher/resources";

  function startEditing() {
    if (!result) return;
    setEditDraft(cloneHomeworkResult(result));
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setEditDraft(null);
  }

  function finishEditing() {
    if (!editDraft) return;
    if (editDraft.questions.length !== editDraft.answerKey.length) {
      toast.error("Questions and answers must match in count.");
      return;
    }
    setResult(editDraft);
    setSavedHomeworkId(null);
    setIsEditing(false);
    setEditDraft(null);
    toast.success("Homework updated", {
      description: "Your edits are ready to save or download.",
    });
  }

  function openSaveDialog() {
    if (!result) return;
    setSaveLabel(result.assignmentTitle);
    setSaveDialogOpen(true);
  }

  async function handleSaveHomework() {
    if (!result || !saveLabel.trim()) return;
    setIsSaving(true);
    try {
      const saved = await saveHomeworkAction({
        label: saveLabel.trim(),
        sourceType,
        savedLessonPlanId,
        deckId,
        input: {
          sourceType,
          savedLessonPlanId,
          deckId,
          subject: form.subject,
          gradeLevel: form.gradeLevel,
          topic: form.topic,
          numberOfQuestions: form.numberOfQuestions,
          difficultyLevel: form.difficultyLevel,
          teamId: teacherWorkspace?.teamId ?? undefined,
        },
        result,
      });
      setSavedHomeworkId(saved.id);
      setSaveDialogOpen(false);
      toast.success("Homework saved", {
        description: (
          <span>
            {saved.label} was saved
            {saved.pdfUrl ? " with PDF" : ""}.
            {saved.sourceLessonPlanTitle ? (
              <>
                {" "}
                Linked to lesson plan: <strong>{saved.sourceLessonPlanTitle}</strong>.
              </>
            ) : null}
            {saved.sourceDeckName ? (
              <>
                {" "}
                Linked to deck: <strong>{saved.sourceDeckName}</strong>.
              </>
            ) : null}{" "}
            View it in the{" "}
            <Link href={resourcesHref} className="underline underline-offset-2">
              Resource Library
            </Link>
            .
          </span>
        ),
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save homework.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDownloadPdf() {
    if (!result) return;
    setIsDownloading(true);
    try {
      await downloadHomeworkPdf(result);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <>
    <TeacherToolPageShell
      title="Homework Generator"
      description="Create homework assignments with answer keys."
      showResult={showResult && result != null}
      isGenerating={isGenerating}
      generateLabel="Generate"
      submittingLabel="Generating…"
      generateWithAiIcon
      generateTooltip={generateTooltip}
      errorMessage={errorMessage}
      onGenerate={handleGenerate}
      submitDisabled={submitDisabled}
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
                  variant="outline"
                  size="sm"
                  disabled={isSaving || savedHomeworkId !== null}
                  onClick={openSaveDialog}
                >
                  {isSaving ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Save className="size-4" aria-hidden />
                  )}
                  {savedHomeworkId !== null ? "Saved" : "Save Homework"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isDownloading}
                  onClick={handleDownloadPdf}
                >
                  {isDownloading ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Download className="size-4" aria-hidden />
                  )}
                  Download PDF
                </Button>
              </>
            )}
          </>
        ) : null
      }
      result={
        result ? (
          <HomeworkPreviewEditor
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
          <div className="space-y-2 sm:col-span-2">
            <TeacherFieldLabel
              htmlFor="homeworkSourceType"
              label="Generate from"
              help={
                <>
                  <p className="mb-2">
                    Choose where the homework content should come from.
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>
                      <strong>Custom topic</strong> — use the subject, grade, and topic
                      fields only.
                    </li>
                    <li>
                      <strong>Lesson plan</strong> — base homework on a plan from the AI
                      Lesson Builder.
                    </li>
                    <li>
                      <strong>Deck</strong> — base homework on flashcards in one of your
                      decks.
                    </li>
                  </ul>
                </>
              }
            />
            <ToggleGroup
              id="homeworkSourceType"
              value={[sourceType]}
              onValueChange={(next) => {
                const value = next[0] as HomeworkSourceType | undefined;
                if (value) {
                  handleSourceTypeChange(value);
                }
              }}
              variant="outline"
              spacing={0}
              className="flex w-full"
            >
              <ToggleGroupItem value="topic" className="h-10 flex-1 px-3">
                Custom topic
              </ToggleGroupItem>
              <ToggleGroupItem value="lesson_plan" className="h-10 flex-1 px-3">
                Lesson plan
              </ToggleGroupItem>
              <ToggleGroupItem value="deck" className="h-10 flex-1 px-3">
                Deck
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {sourceType === "lesson_plan" ? (
            isWorkspaceOwner ? (
              <OwnerTeamAdminResourcePicker
                ownerPicker={ownerLessonPlanPicker}
                itemsByAdminUserId={ownerLessonPlanPicker.lessonPlansByAdminUserId}
                selectedAdminUserId={selectedLessonPlanAdminUserId}
                onAdminChange={handleLessonPlanAdminChange}
                selectedItemKey={selectedPlanKey}
                onItemChange={handleLessonPlanChange}
                noneValue={SOURCE_NONE}
                noneLabel="Select a lesson plan"
                placeholder="Select a lesson plan"
                resourceLabel="Saved lesson plan"
                resourceSelectId="homeworkLessonPlan"
                adminSelectId="homeworkTeamAdmin"
                getItemKey={(plan) => String(plan.id)}
                getItemLabel={(plan) => `${plan.lessonTitle} (${plan.subject} · ${plan.gradeLevel})`}
                getItemHaystack={lessonPlanHaystack}
                searchPlaceholder="Search lesson plans by title, subject, grade, or topic…"
                resourceHelp="Pick a plan saved from the AI Lesson Builder. Subject, grade, topic, and difficulty will auto-fill."
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
                htmlFor="homeworkLessonPlan"
                label="Saved lesson plan"
                help="Pick a plan saved from the AI Lesson Builder. Subject, grade, topic, and difficulty will auto-fill."
              />
              <Select value={selectedPlanKey} onValueChange={handleLessonPlanChange}>
                <SelectTrigger id="homeworkLessonPlan" className="h-10 w-full bg-background">
                  <SelectValue placeholder="Select a lesson plan">
                    {selectedPlan?.lessonTitle ?? "Select a lesson plan"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SOURCE_NONE} disabled>
                    Select a lesson plan
                  </SelectItem>
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
            )
          ) : null}

          {sourceType === "deck" ? (
            isWorkspaceOwner ? (
              <OwnerTeamAdminResourcePicker
                ownerPicker={ownerDeckPicker}
                itemsByAdminUserId={ownerDeckPicker.itemsByAdminUserId}
                selectedAdminUserId={selectedDeckAdminUserId}
                onAdminChange={handleDeckAdminChange}
                selectedItemKey={selectedDeckKey}
                onItemChange={handleDeckChange}
                noneValue={SOURCE_NONE}
                noneLabel="Select a deck"
                placeholder="Select a deck"
                resourceLabel="Deck"
                resourceSelectId="homeworkDeck"
                adminSelectId="homeworkDeckTeamAdmin"
                getItemKey={(deck) => String(deck.id)}
                getItemLabel={(deck) => deck.name}
                getItemHaystack={deckHaystack}
                searchPlaceholder="Search decks by name, subject, or description…"
                resourceHelp="Pick one of the team admin's decks. Homework questions will be based on the flashcards in that deck."
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
                htmlFor="homeworkDeck"
                label="Deck"
                help="Pick one of your decks. Homework questions will be based on the flashcards in that deck."
              />
              <Select value={selectedDeckKey} onValueChange={handleDeckChange}>
                <SelectTrigger id="homeworkDeck" className="h-10 w-full bg-background">
                  <SelectValue placeholder="Select a deck">
                    {selectedDeck?.name ?? "Select a deck"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SOURCE_NONE} disabled>
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
                  No decks available yet. Create a deck from the{" "}
                  <Link href="/dashboard" className="underline underline-offset-2">
                    dashboard
                  </Link>{" "}
                  or{" "}
                  <Link href={quizzesHref} className="underline underline-offset-2">
                    Quiz Generator
                  </Link>
                  .
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
          ) : null}

          <div className="space-y-2">
            <TeacherFieldLabel
              htmlFor="subject"
              label="Subject"
              help={
                <>
                  <p className="mb-1 font-semibold">Example:</p>
                  <p>Science, Mathematics, English Language Arts</p>
                </>
              }
            />
            <Input
              id="subject"
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
                  <p className="mb-1 font-semibold">Example:</p>
                  <p>Grade 5, Grade 8, Year 1</p>
                </>
              }
            />
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
            <TeacherFieldLabel
              htmlFor="numberOfQuestions"
              label="Number of Questions"
              help="How many homework questions to generate (1–30)."
            />
            <Input
              id="numberOfQuestions"
              type="number"
              min={1}
              max={30}
              value={form.numberOfQuestions}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  numberOfQuestions: Math.min(30, Math.max(1, Number(e.target.value) || 1)),
                }))
              }
              required
            />
          </div>
          <div className="space-y-2">
            <TeacherFieldLabel
              htmlFor="difficultyLevel"
              label="Difficulty Level"
              help="Match this to your class readiness — On-level is the default classroom pace."
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
                {DIFFICULTY_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {examplePreview ? (
            <Card className="border-border/70 bg-muted/20 sm:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-foreground">
                  Example question
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="leading-relaxed text-foreground">{examplePreview.question}</p>
                <p className="leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">Sample answer: </span>
                  {examplePreview.answer}
                </p>
                <p className="text-xs text-muted-foreground">{examplePreview.note}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </TooltipProvider>
    </TeacherToolPageShell>

    <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Save homework</DialogTitle>
          <DialogDescription>
            Choose a label so you can find this assignment later in your Resource
            Library. The source you generated from is stored with the homework.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <TeacherFieldLabel
            htmlFor="homeworkSaveLabel"
            label="Label"
            help="Use a name your future self will recognize, e.g. “Week 3 Geometry homework”."
          />
          <Input
            id="homeworkSaveLabel"
            value={saveLabel}
            onChange={(event) => setSaveLabel(event.target.value)}
            placeholder="e.g. Honors Geometry — Angles homework"
            maxLength={255}
          />
          {sourceType === "lesson_plan" && selectedPlan ? (
            <p className="text-xs text-muted-foreground">
              From lesson plan: <span className="text-foreground">{selectedPlan.lessonTitle}</span>
            </p>
          ) : null}
          {sourceType === "deck" && selectedDeck ? (
            <p className="text-xs text-muted-foreground">
              From deck: <span className="text-foreground">{selectedDeck.name}</span>
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
            onClick={handleSaveHomework}
            disabled={isSaving || !saveLabel.trim()}
          >
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              "Save with PDF"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
