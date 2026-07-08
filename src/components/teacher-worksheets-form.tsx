"use client";

import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { generateWorksheetFromDeckAction } from "@/actions/teacher-worksheet";
import { Button } from "@/components/ui/button";
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
import type { TeacherWorkspaceContext } from "@/lib/teacher-url";
import { deckToHomeworkDefaults } from "@/lib/homework-source-context";
import type { DeckRow } from "@/db/queries/decks";
import type { DeckWorksheetResult } from "@/lib/teacher-worksheet-schema";
import { downloadWorksheetPdf } from "@/lib/worksheet-pdf-build";

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
  backHref = "/teacher",
  teacherWorkspace,
  initialDeckId,
}: {
  decks: DeckRow[];
  ownerDeckPicker: OwnerTeamAdminDeckPickerPayload;
  backHref?: string;
  teacherWorkspace?: TeacherWorkspaceContext;
  initialDeckId?: number;
}) {
  const initialDeck =
    initialDeckId != null ? decks.find((deck) => deck.id === initialDeckId) ?? null : null;
  const initialDeckDefaults = initialDeck ? deckToHomeworkDefaults(initialDeck) : null;

  const [selectedDeckKey, setSelectedDeckKey] = useState<string>(
    initialDeck ? String(initialDeck.id) : DECK_NONE,
  );
  const [deckId, setDeckId] = useState<number | undefined>(initialDeck?.id);
  const [form, setForm] = useState<WorksheetFormState>(
    initialDeckDefaults
      ? {
          subject: initialDeckDefaults.subject,
          gradeLevel: initialDeckDefaults.gradeLevel,
          topic: initialDeckDefaults.topic,
          worksheetType: "Practice",
          difficultyLevel: initialDeckDefaults.difficultyLevel,
        }
      : EMPTY_FORM,
  );
  const [result, setResult] = useState<DeckWorksheetResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloadingWorksheet, setIsDownloadingWorksheet] = useState(false);
  const [isDownloadingAnswerKey, setIsDownloadingAnswerKey] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

  return (
    <TeacherToolPageShell
      title="Worksheet Generator"
      description="Create worksheets with student sections and teacher answer keys from your flashcard decks."
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
        ) : null
      }
      result={
        result ? (
          <div className="space-y-4 whitespace-pre-wrap text-foreground">
            <p className="text-sm text-muted-foreground">{result.instructions}</p>
            <div>
              <p className="font-medium text-foreground">Questions ({result.items.length})</p>
              <ol className="list-decimal space-y-2 pl-5">
                {result.items.map((item) => (
                  <li key={item.questionNumber}>
                    <span>{item.prompt}</span>
                    {item.frontImageUrl ? (
                      <p className="text-xs text-muted-foreground">Includes card front image</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <p className="font-medium text-foreground">Answer key preview</p>
              <ol className="list-decimal space-y-2 pl-5">
                {result.items.map((item) => (
                  <li key={item.questionNumber}>
                    <span>{item.answer}</span>
                    {item.backImageUrl || item.answerImageUrl ? (
                      <p className="text-xs text-muted-foreground">Includes card back image</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ) : null
      }
    >
      <TooltipProvider>
        <div className="grid gap-4 sm:grid-cols-2">
          {isWorkspaceOwner ? (
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
            <Select value={selectedDeckKey} onValueChange={handleDeckChange}>
              <SelectTrigger id="worksheetDeck" className="h-10 w-full bg-background">
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
  );
}
