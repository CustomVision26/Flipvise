"use client";

import * as React from "react";
import { ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  generateDeckQuizVariantsAction,
  updateDeckQuizFormatsAction,
  updateTeamQuizFormatsAction,
} from "@/actions/quiz-formats";
import type {
  QuizFormatsDeckSnapshot,
  QuizFormatsWorkspaceSnapshot,
} from "@/db/queries/quiz-formats";
import { resolveQuizFormats, type QuizFormatsSettings } from "@/lib/quiz-formats";
import { cn } from "@/lib/utils";

const PLACEHOLDER_WORKSPACE = "Choose a team workspace…";

type TeamQuizFormatsSettingsProps = {
  workspaces: QuizFormatsWorkspaceSnapshot[];
  decksByWorkspaceId: Record<number, QuizFormatsDeckSnapshot[]>;
  defaultWorkspaceId: number;
};

function formatsFromWorkspace(w: QuizFormatsWorkspaceSnapshot): QuizFormatsSettings {
  return {
    multipleChoice: w.quizFormatMultipleChoice,
    trueFalse: w.quizFormatTrueFalse,
    fillInBlank: w.quizFormatFillInBlank,
  };
}

function formatsFromDeck(
  deck: QuizFormatsDeckSnapshot,
  workspace: QuizFormatsWorkspaceSnapshot,
): QuizFormatsSettings {
  return resolveQuizFormats(workspace, deck);
}

export function TeamQuizFormatsSettings({
  workspaces,
  decksByWorkspaceId,
  defaultWorkspaceId,
}: TeamQuizFormatsSettingsProps) {
  const [selectedId, setSelectedId] = React.useState(defaultWorkspaceId);
  const [workspaceFormatsById, setWorkspaceFormatsById] = React.useState<
    Record<number, QuizFormatsSettings>
  >(() =>
    Object.fromEntries(workspaces.map((w) => [w.id, formatsFromWorkspace(w)])),
  );
  const [deckOverrideById, setDeckOverrideById] = React.useState<
    Record<number, QuizFormatsSettings | null>
  >({});
  const [workspaceSaving, setWorkspaceSaving] = React.useState(false);
  const [deckSavingId, setDeckSavingId] = React.useState<number | null>(null);
  const [generatingDeckId, setGeneratingDeckId] = React.useState<number | null>(null);
  const [workspaceError, setWorkspaceError] = React.useState<string | null>(null);
  const [deckErrorById, setDeckErrorById] = React.useState<Record<number, string>>({});
  const [generateMessageById, setGenerateMessageById] = React.useState<
    Record<number, string>
  >({});

  const decks = React.useMemo(
    () => decksByWorkspaceId[selectedId] ?? [],
    [decksByWorkspaceId, selectedId],
  );

  React.useEffect(() => {
    setSelectedId(defaultWorkspaceId);
  }, [defaultWorkspaceId]);

  React.useEffect(() => {
    setWorkspaceFormatsById(
      Object.fromEntries(workspaces.map((w) => [w.id, formatsFromWorkspace(w)])),
    );
  }, [workspaces]);

  React.useEffect(() => {
    setDeckOverrideById((prev) => {
      const next = { ...prev };
      const workspace = workspaces.find((w) => w.id === selectedId);
      if (!workspace) return next;
      for (const deck of decks) {
        const hasOverride =
          deck.quizFormatMultipleChoice != null ||
          deck.quizFormatTrueFalse != null ||
          deck.quizFormatFillInBlank != null;
        next[deck.id] = hasOverride
          ? {
              multipleChoice: deck.quizFormatMultipleChoice ?? workspace.quizFormatMultipleChoice,
              trueFalse: deck.quizFormatTrueFalse ?? workspace.quizFormatTrueFalse,
              fillInBlank: deck.quizFormatFillInBlank ?? workspace.quizFormatFillInBlank,
            }
          : null;
      }
      return next;
    });
  }, [decks, selectedId, workspaces]);

  const selected =
    workspaces.find((w) => w.id === selectedId) ?? workspaces[0] ?? null;
  const workspaceFormats = selected
    ? (workspaceFormatsById[selected.id] ?? formatsFromWorkspace(selected))
    : null;

  function toggleWorkspaceFormat(
    key: keyof QuizFormatsSettings,
    checked: boolean,
  ) {
    if (!selected) return;
    setWorkspaceFormatsById((prev) => ({
      ...prev,
      [selected.id]: { ...prev[selected.id]!, [key]: checked },
    }));
  }

  async function saveWorkspaceFormats() {
    if (!selected || !workspaceFormats) return;
    setWorkspaceError(null);
    setWorkspaceSaving(true);
    try {
      await updateTeamQuizFormatsAction({
        teamId: selected.id,
        formats: workspaceFormats,
      });
    } catch (e) {
      setWorkspaceError(e instanceof Error ? e.message : "Could not save workspace formats.");
    } finally {
      setWorkspaceSaving(false);
    }
  }

  async function saveDeckFormats(deckId: number, inheritWorkspace: boolean) {
    if (!selected) return;
    setDeckErrorById((prev) => ({ ...prev, [deckId]: "" }));
    setDeckSavingId(deckId);
    try {
      await updateDeckQuizFormatsAction({
        teamId: selected.id,
        deckId,
        formats: inheritWorkspace ? null : deckOverrideById[deckId] ?? workspaceFormats,
      });
    } catch (e) {
      setDeckErrorById((prev) => ({
        ...prev,
        [deckId]: e instanceof Error ? e.message : "Could not save deck formats.",
      }));
    } finally {
      setDeckSavingId(null);
    }
  }

  async function generateForDeck(deckId: number) {
    if (!selected) return;
    setGeneratingDeckId(deckId);
    setGenerateMessageById((prev) => ({ ...prev, [deckId]: "" }));
    try {
      const res = await generateDeckQuizVariantsAction({
        deckId,
        teamId: selected.id,
      });
      const message =
        res.generated === 0 && res.failed > 0
          ? `Could not generate quiz content — ${res.failed} of ${res.total} cards failed. Save your format settings, then try again. If this persists, check your OpenAI API key.`
          : res.generated === 0 && res.skipped === res.total
            ? `No cards needed generation (${res.total} cards already have quiz content or are empty).`
            : `Generated quiz content for ${res.generated} of ${res.total} cards.`;
      setGenerateMessageById((prev) => ({
        ...prev,
        [deckId]: message,
      }));
    } catch (e) {
      setGenerateMessageById((prev) => ({
        ...prev,
        [deckId]: e instanceof Error ? e.message : "Generation failed.",
      }));
    } finally {
      setGeneratingDeckId(null);
    }
  }

  if (workspaces.length === 0) return null;

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <ListChecks className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">Quiz question formats</h2>
          <p className="text-sm text-muted-foreground">
            Choose which question types appear in quizzes for this workspace or individual decks.
            Enable true/false or fill-in-the-blank, then generate AI quiz sentences for each deck.
          </p>
        </div>
      </div>

      <div className="grid gap-2 max-w-md">
        <Label htmlFor="quiz-formats-workspace">Workspace</Label>
        <Select
          value={String(selectedId)}
          onValueChange={(v) => setSelectedId(Number(v))}
        >
          <SelectTrigger id="quiz-formats-workspace">
            <SelectValue placeholder={PLACEHOLDER_WORKSPACE}>
              {selected?.name ?? PLACEHOLDER_WORKSPACE}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {workspaces.map((w) => (
              <SelectItem key={w.id} value={String(w.id)}>
                <span className="truncate">{w.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selected && workspaceFormats ? (
        <>
          <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-4">
            <p className="text-sm font-medium text-foreground">Workspace defaults</p>
            <FormatCheckboxRow
              id={`ws-mc-${selected.id}`}
              label="Multiple choice"
              checked={workspaceFormats.multipleChoice}
              onCheckedChange={(c) => toggleWorkspaceFormat("multipleChoice", c === true)}
            />
            <FormatCheckboxRow
              id={`ws-tf-${selected.id}`}
              label="True / false"
              checked={workspaceFormats.trueFalse}
              onCheckedChange={(c) => toggleWorkspaceFormat("trueFalse", c === true)}
            />
            <FormatCheckboxRow
              id={`ws-fib-${selected.id}`}
              label="Fill in the blank"
              checked={workspaceFormats.fillInBlank}
              onCheckedChange={(c) => toggleWorkspaceFormat("fillInBlank", c === true)}
            />
            {workspaceError ? (
              <p className="text-sm text-destructive" role="alert">
                {workspaceError}
              </p>
            ) : null}
            <Button
              type="button"
              size="sm"
              disabled={workspaceSaving}
              onClick={() => void saveWorkspaceFormats()}
            >
              {workspaceSaving ? "Saving…" : "Save workspace formats"}
            </Button>
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Per-deck overrides</p>
            {decks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No decks linked to this workspace.</p>
            ) : (
              decks.map((deck) => {
                const inherit = deckOverrideById[deck.id] == null;
                const effective =
                  deckOverrideById[deck.id] ??
                  formatsFromDeck(deck, selected);
                const needsAi = effective.trueFalse || effective.fillInBlank;
                return (
                  <div
                    key={deck.id}
                    className="space-y-3 rounded-lg border border-border/80 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-foreground">{deck.name}</p>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Checkbox
                          checked={inherit}
                          onCheckedChange={(c) => {
                            setDeckOverrideById((prev) => ({
                              ...prev,
                              [deck.id]: c === true ? null : { ...effective },
                            }));
                          }}
                        />
                        Use workspace defaults
                      </label>
                    </div>
                    {!inherit ? (
                      <div className="space-y-2">
                        <FormatCheckboxRow
                          id={`deck-mc-${deck.id}`}
                          label="Multiple choice"
                          checked={effective.multipleChoice}
                          onCheckedChange={(c) =>
                            setDeckOverrideById((prev) => ({
                              ...prev,
                              [deck.id]: {
                                ...(prev[deck.id] ?? effective),
                                multipleChoice: c === true,
                              },
                            }))
                          }
                        />
                        <FormatCheckboxRow
                          id={`deck-tf-${deck.id}`}
                          label="True / false"
                          checked={effective.trueFalse}
                          onCheckedChange={(c) =>
                            setDeckOverrideById((prev) => ({
                              ...prev,
                              [deck.id]: {
                                ...(prev[deck.id] ?? effective),
                                trueFalse: c === true,
                              },
                            }))
                          }
                        />
                        <FormatCheckboxRow
                          id={`deck-fib-${deck.id}`}
                          label="Fill in the blank"
                          checked={effective.fillInBlank}
                          onCheckedChange={(c) =>
                            setDeckOverrideById((prev) => ({
                              ...prev,
                              [deck.id]: {
                                ...(prev[deck.id] ?? effective),
                                fillInBlank: c === true,
                              },
                            }))
                          }
                        />
                      </div>
                    ) : null}
                    {deckErrorById[deck.id] ? (
                      <p className="text-sm text-destructive">{deckErrorById[deck.id]}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={deckSavingId === deck.id}
                        onClick={() => void saveDeckFormats(deck.id, inherit)}
                      >
                        {deckSavingId === deck.id ? "Saving…" : "Save deck formats"}
                      </Button>
                      {needsAi ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={generatingDeckId === deck.id}
                          onClick={() => void generateForDeck(deck.id)}
                        >
                          {generatingDeckId === deck.id
                            ? "Generating…"
                            : "Generate AI quiz sentences"}
                        </Button>
                      ) : null}
                    </div>
                    {generateMessageById[deck.id] ? (
                      <p className="text-xs text-muted-foreground">
                        {generateMessageById[deck.id]}
                      </p>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : null}
    </section>
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
      <Label htmlFor={id} className={cn("text-sm font-normal cursor-pointer")}>
        {label}
      </Label>
    </div>
  );
}
