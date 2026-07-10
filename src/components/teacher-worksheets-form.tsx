"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Loader2, Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";
import { generateWorksheetFromDeckAction, saveWorksheetAction, updateWorksheetAction } from "@/actions/teacher-worksheet";
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
import type { OwnerTeamAdminDeckPickerPayload } from "@/db/queries/teacher-owner-pickers";
import { ADMIN_NONE } from "@/lib/owner-team-admin-picker";
import { buildTeacherSubPath, type TeacherWorkspaceContext } from "@/lib/teacher-url";
import { deckToHomeworkDefaults } from "@/lib/homework-source-context";
import { cn } from "@/lib/utils";
import type { DeckRow } from "@/db/queries/decks";
import type { SavedWorksheetEditItem } from "@/db/queries/saved-worksheets";
import type { SavedLessonPlanPickerItem } from "@/db/queries/saved-lesson-plans";
import { getLessonPlanReferenceMaterials } from "@/lib/lesson-plan-reference-material";
import { LessonPlanSavedReferenceSummary } from "@/components/lesson-plan-saved-reference-summary";
import type { DeckWorksheetResult } from "@/lib/teacher-worksheet-schema";
import { downloadWorksheetPdf } from "@/lib/worksheet-pdf-build";
import {
  WorksheetPreviewEditor,
  cloneWorksheetResult,
} from "@/components/worksheet-preview-editor";

const DECK_NONE = "__none__";

type WorksheetFormState = {
  subject: string;
  gradeLevel: string;
  topic: string;
  worksheetType: string;
  difficultyLevel: string;
};

const EMPTY_FORM: WorksheetFormState = {
  subject: "",
  gradeLevel: "",
  topic: "",
  worksheetType: "Practice",
  difficultyLevel: "On-level",
};

export function TeacherWorksheetsForm({
  decks,
  ownerDeckPicker,
  savedLessonPlans,
  backHref = "/teacher",
  teacherWorkspace,
  initialDeckId,
  initialSavedWorksheet,
}: {
  decks: DeckRow[];
  ownerDeckPicker: OwnerTeamAdminDeckPickerPayload;
  savedLessonPlans: SavedLessonPlanPickerItem[];
  backHref?: string;
  teacherWorkspace?: TeacherWorkspaceContext;
  initialDeckId?: number;
  initialSavedWorksheet?: SavedWorksheetEditItem;
}) {
  const isEditingExistingWorksheet = initialSavedWorksheet != null;
  const resolvedInitialDeckId = initialSavedWorksheet?.deckId ?? initialDeckId;
  const initialDeck =
    resolvedInitialDeckId != null
      ? decks.find((deck) => deck.id === resolvedInitialDeckId) ?? null
      : null;

  const initialDeckDefaults = initialDeck ? deckToHomeworkDefaults(initialDeck) : null;

  const [selectedDeckKey, setSelectedDeckKey] = useState<string>(
    resolvedInitialDeckId != null ? String(resolvedInitialDeckId) : DECK_NONE,
  );
  const [deckId, setDeckId] = useState<number | undefined>(resolvedInitialDeckId ?? undefined);
  const [form, setForm] = useState<WorksheetFormState>(
    initialSavedWorksheet
      ? {
          subject: initialSavedWorksheet.input.subject,
          gradeLevel: initialSavedWorksheet.input.gradeLevel,
          topic: initialSavedWorksheet.input.topic,
          worksheetType: initialSavedWorksheet.input.worksheetType,
          difficultyLevel: initialSavedWorksheet.input.difficultyLevel,
        }
      : initialDeckDefaults
        ? {
            subject: initialDeckDefaults.subject,
            gradeLevel: initialDeckDefaults.gradeLevel,
            topic: initialDeckDefaults.topic,
            worksheetType: "Practice",
            difficultyLevel: initialDeckDefaults.difficultyLevel,
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
  const [saveLabel, setSaveLabel] = useState(initialSavedWorksheet?.label ?? "");
  const [selectedAdminUserId, setSelectedAdminUserId] = useState<string>(ADMIN_NONE);

  const isWorkspaceOwner = ownerDeckPicker.isWorkspaceOwner;
  const activeDecks = useOwnerScopedItems(
    isWorkspaceOwner,
    selectedAdminUserId,
    ownerDeckPicker.itemsByAdminUserId,
    decks,
  );

  const selectedDeck =
    deckId != null ? activeDecks.find((deck) => deck.id === deckId) ?? null : null;

  const linkedLessonPlan =
    deckId != null
      ? savedLessonPlans.find((plan) => plan.deckId === deckId) ?? null
      : null;
  const linkedLessonPlanReferences =
    initialSavedWorksheet?.input.referenceMaterials ??
    getLessonPlanReferenceMaterials(linkedLessonPlan?.input);

  const resourcesHref = teacherWorkspace
    ? buildTeacherSubPath(
        "/resources",
        teacherWorkspace.teamId,
        teacherWorkspace.teamMemberId,
      )
    : "/teacher/resources";

  function handleAdminChange(adminUserId: string) {
    setSelectedAdminUserId(adminUserId);
    setSelectedDeckKey(DECK_NONE);
    setDeckId(undefined);
    setForm(EMPTY_FORM);
  }

  function deckHaystack(deck: DeckRow): string {
    return [deck.name, deck.description, deck.gradeLevel]
      .filter((part): part is string => Boolean(part && part.trim()))
      .join(" ")
      .toLowerCase();
  }

  useEffect(() => {
    if (!initialDeckId || !isWorkspaceOwner) return;
    const adminWithDeck = ownerDeckPicker.teamAdmins.find((admin) =>
      (ownerDeckPicker.itemsByAdminUserId[admin.userId] ?? []).some(
        (item) => item.id === initialDeckId,
      ),
    );
    if (!adminWithDeck) return;
    setSelectedAdminUserId(adminWithDeck.userId);
    handleDeckChange(String(initialDeckId));
  }, [initialDeckId, isWorkspaceOwner, ownerDeckPicker]);

  function handleDeckChange(value: string | null) {
    if (!value || value === DECK_NONE) {
      setSelectedDeckKey(DECK_NONE);
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
      worksheetType: "Practice",
      difficultyLevel: defaults.difficultyLevel,
    });
  }

  async function handleGenerate() {
    setIsGenerating(true);
    setErrorMessage(null);

    try {
      if (deckId == null) {
        throw new Error("Select a deck.");
      }

      const worksheet = await generateWorksheetFromDeckAction({
        deckId,
        subject: form.subject,
        gradeLevel: form.gradeLevel,
        topic: form.topic,
        worksheetType: form.worksheetType,
        difficultyLevel: form.difficultyLevel,
      });

      setResult(worksheet);
      setShowResult(true);
      setSavedWorksheetId(null);
      setIsEditing(false);
      setEditDraft(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Worksheet generation failed. Please try again.",
      );
    } finally {
      setIsGenerating(false);
    }
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
    setSaveLabel(result.worksheetTitle);
    setSaveDialogOpen(true);
  }

  async function handleSaveWorksheet() {
    if (!result || !saveLabel.trim() || deckId == null) return;
    await persistWorksheet(saveLabel.trim());
  }

  async function handleSaveChanges() {
    if (!result || editingWorksheetId == null || deckId == null) return;
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

  async function persistWorksheet(label: string, worksheetId?: number) {
    if (!result || deckId == null) return;
    setIsSaving(true);
    try {
      const payload = {
        label,
        input: {
          deckId,
          subject: form.subject,
          gradeLevel: form.gradeLevel,
          topic: form.topic,
          worksheetType: form.worksheetType,
          difficultyLevel: form.difficultyLevel,
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
            . From deck: <strong>{saved.sourceDeckName}</strong>.
          </span>
        ),
      },
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save worksheet.",
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
          : "Create worksheets with student sections and teacher answer keys from your flashcard decks."
      }
      showResult={showResult && result != null}
      isGenerating={isGenerating}
      generateLabel="Generate"
      submittingLabel="Generating…"
      generateTooltip="Build a student worksheet and answer key from the selected deck."
      errorMessage={errorMessage}
      onGenerate={handleGenerate}
      submitDisabled={deckId == null}
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
              <Label htmlFor="worksheetDeckReadonly">Deck</Label>
              <Input
                id="worksheetDeckReadonly"
                disabled
                value={initialSavedWorksheet.sourceDeckName}
              />
            </div>
          ) : isWorkspaceOwner ? (
            <OwnerTeamAdminResourcePicker
              ownerPicker={ownerDeckPicker}
              itemsByAdminUserId={ownerDeckPicker.itemsByAdminUserId}
              selectedAdminUserId={selectedAdminUserId}
              onAdminChange={handleAdminChange}
              selectedItemKey={selectedDeckKey}
              onItemChange={handleDeckChange}
              noneValue={DECK_NONE}
              noneLabel="Select a deck"
              placeholder="Select a deck"
              resourceLabel="Deck"
              resourceSelectId="worksheetDeck"
              adminSelectId="worksheetTeamAdmin"
              getItemKey={(deck) => String(deck.id)}
              getItemLabel={(deck) => deck.name}
              getItemHaystack={deckHaystack}
              searchPlaceholder="Search decks by name, subject, or description…"
              resourceHelp="Pick one of the team admin's decks. Subject, grade, topic, and difficulty will auto-fill from the deck."
            />
          ) : (
          <div className="space-y-2 sm:col-span-2">
            <TeacherFieldLabel
              htmlFor="worksheetDeck"
              label="Deck"
              help="Pick one of your decks. Subject, grade, topic, and difficulty will auto-fill from the deck."
            />
            <Select value={selectedDeckKey} onValueChange={handleDeckChange} disabled={isEditingExistingWorksheet}>
              <SelectTrigger id="worksheetDeck" className={cn("h-10 w-full bg-background", isEditingExistingWorksheet && "opacity-60")}>
                <SelectValue placeholder="Select a deck">
                  {selectedDeck?.name ?? "Select a deck"}
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
                No decks available. Create a deck first, then return here to generate a worksheet.
              </p>
            ) : null}
            <LessonPlanSavedReferenceSummary
              references={linkedLessonPlanReferences}
              description="Reference materials saved with the lesson plan for this deck are included in the worksheet instructions."
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
          {selectedDeck ? (
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
    </>
  );
}
