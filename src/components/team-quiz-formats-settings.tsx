"use client";

import * as React from "react";
import { ListChecks, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  generateDeckQuizVariantsAction,
  reshuffleDeckQuizFormatAssignmentsAction,
  updateDeckQuizFormatsAction,
  updateTeamQuizFormatsAction,
} from "@/actions/quiz-formats";
import type {
  QuizFormatsDeckSnapshot,
  QuizFormatsWorkspaceSnapshot,
} from "@/db/queries/quiz-formats";
import { resolveQuizFormats, type QuizFormatsSettings } from "@/lib/quiz-formats";
import {
  EMPTY_QUIZ_FORMAT_DISTRIBUTION,
  validateQuizFormatDistribution,
  type QuizFormatDistribution,
} from "@/lib/quiz-format-assignments";
import { cn } from "@/lib/utils";

const PLACEHOLDER_WORKSPACE = "Choose a team workspace…";

type TeamQuizFormatsSettingsProps = {
  workspaces: QuizFormatsWorkspaceSnapshot[];
  decksByWorkspaceId: Record<number, QuizFormatsDeckSnapshot[]>;
  defaultWorkspaceId: number;
};

type DeckSavedSnapshot = {
  inherit: boolean;
  formats: QuizFormatsSettings | null;
};

function formatsEqual(a: QuizFormatsSettings, b: QuizFormatsSettings): boolean {
  return (
    a.multipleChoice === b.multipleChoice &&
    a.trueFalse === b.trueFalse &&
    a.fillInBlank === b.fillInBlank
  );
}

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

function deckHasOverride(deck: QuizFormatsDeckSnapshot): boolean {
  return (
    deck.quizFormatMultipleChoice != null ||
    deck.quizFormatTrueFalse != null ||
    deck.quizFormatFillInBlank != null
  );
}

function initialDeckSavedSnapshot(
  deck: QuizFormatsDeckSnapshot,
  workspace: QuizFormatsWorkspaceSnapshot,
): DeckSavedSnapshot {
  const inherit = !deckHasOverride(deck);
  return {
    inherit,
    formats: inherit
      ? null
      : {
          multipleChoice:
            deck.quizFormatMultipleChoice ?? workspace.quizFormatMultipleChoice,
          trueFalse: deck.quizFormatTrueFalse ?? workspace.quizFormatTrueFalse,
          fillInBlank:
            deck.quizFormatFillInBlank ?? workspace.quizFormatFillInBlank,
        },
  };
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
  const [savedWorkspaceFormatsById, setSavedWorkspaceFormatsById] = React.useState<
    Record<number, QuizFormatsSettings>
  >(() =>
    Object.fromEntries(workspaces.map((w) => [w.id, formatsFromWorkspace(w)])),
  );
  const [deckOverrideById, setDeckOverrideById] = React.useState<
    Record<number, QuizFormatsSettings | null>
  >({});
  const [savedDeckSnapshotsById, setSavedDeckSnapshotsById] = React.useState<
    Record<number, DeckSavedSnapshot>
  >({});
  const [localContentReadyById, setLocalContentReadyById] = React.useState<
    Record<number, boolean>
  >({});
  const [localHasAssignmentsById, setLocalHasAssignmentsById] = React.useState<
    Record<number, boolean>
  >({});
  const [reshuffleTooltipOpenById, setReshuffleTooltipOpenById] = React.useState<
    Record<number, boolean>
  >({});
  const [reshuffledAtById, setReshuffledAtById] = React.useState<Record<number, string>>({});
  const [distributionByDeckId, setDistributionByDeckId] = React.useState<
    Record<number, QuizFormatDistribution>
  >({});
  const [workspaceSaving, setWorkspaceSaving] = React.useState(false);
  const [deckSavingId, setDeckSavingId] = React.useState<number | null>(null);
  const [generatingDeckId, setGeneratingDeckId] = React.useState<number | null>(null);
  const [reshufflingDeckId, setReshufflingDeckId] = React.useState<number | null>(null);
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
    setSavedWorkspaceFormatsById(
      Object.fromEntries(workspaces.map((w) => [w.id, formatsFromWorkspace(w)])),
    );
  }, [workspaces]);

  React.useEffect(() => {
    setDeckOverrideById((prev) => {
      const next = { ...prev };
      const workspace = workspaces.find((w) => w.id === selectedId);
      if (!workspace) return next;
      for (const deck of decks) {
        const hasOverride = deckHasOverride(deck);
        next[deck.id] = hasOverride
          ? {
              multipleChoice:
                deck.quizFormatMultipleChoice ?? workspace.quizFormatMultipleChoice,
              trueFalse: deck.quizFormatTrueFalse ?? workspace.quizFormatTrueFalse,
              fillInBlank:
                deck.quizFormatFillInBlank ?? workspace.quizFormatFillInBlank,
            }
          : null;
      }
      return next;
    });

    const workspace = workspaces.find((w) => w.id === selectedId);
    if (!workspace) return;

    setSavedDeckSnapshotsById((prev) => {
      const next = { ...prev };
      for (const deck of decks) {
        next[deck.id] = initialDeckSavedSnapshot(deck, workspace);
      }
      return next;
    });

    setLocalContentReadyById((prev) => {
      const next = { ...prev };
      for (const deck of decks) {
        next[deck.id] = deck.aiQuizContentReady;
      }
      return next;
    });

    setLocalHasAssignmentsById((prev) => {
      const next = { ...prev };
      for (const deck of decks) {
        next[deck.id] = deck.hasQuizFormatAssignments;
      }
      return next;
    });

    setReshuffledAtById((prev) => {
      const next = { ...prev };
      for (const deck of decks) {
        if (deck.quizFormatShuffledAt) {
          next[deck.id] = deck.quizFormatShuffledAt;
        }
      }
      return next;
    });

    setDistributionByDeckId((prev) => {
      const next = { ...prev };
      for (const deck of decks) {
        next[deck.id] = deck.savedDistribution ?? prev[deck.id] ?? {
          ...EMPTY_QUIZ_FORMAT_DISTRIBUTION,
        };
      }
      return next;
    });
  }, [decks, selectedId, workspaces]);

  const selected =
    workspaces.find((w) => w.id === selectedId) ?? workspaces[0] ?? null;
  const workspaceFormats = selected
    ? (workspaceFormatsById[selected.id] ?? formatsFromWorkspace(selected))
    : null;
  const workspaceDirty =
    selected && workspaceFormats
      ? !formatsEqual(
          workspaceFormats,
          savedWorkspaceFormatsById[selected.id] ?? formatsFromWorkspace(selected),
        )
      : false;

  function isDeckDirty(deck: QuizFormatsDeckSnapshot): boolean {
    const saved = savedDeckSnapshotsById[deck.id];
    if (!saved) return false;
    const inherit = deckOverrideById[deck.id] == null;
    if (inherit !== saved.inherit) return true;
    if (inherit) return false;
    const current = deckOverrideById[deck.id];
    if (!current || !saved.formats) return false;
    return !formatsEqual(current, saved.formats);
  }

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
      setSavedWorkspaceFormatsById((prev) => ({
        ...prev,
        [selected.id]: { ...workspaceFormats },
      }));
      setLocalContentReadyById((prev) => {
        const next = { ...prev };
        for (const deck of decks) {
          if (deckOverrideById[deck.id] == null) {
            next[deck.id] = false;
          }
        }
        return next;
      });
      setLocalHasAssignmentsById((prev) => {
        const next = { ...prev };
        for (const deck of decks) {
          if (deckOverrideById[deck.id] == null) {
            next[deck.id] = false;
          }
        }
        return next;
      });
      setDistributionByDeckId((prev) => {
        const next = { ...prev };
        for (const deck of decks) {
          if (deckOverrideById[deck.id] == null) {
            next[deck.id] = { ...EMPTY_QUIZ_FORMAT_DISTRIBUTION };
          }
        }
        return next;
      });
    } catch (e) {
      setWorkspaceError(e instanceof Error ? e.message : "Could not save workspace formats.");
    } finally {
      setWorkspaceSaving(false);
    }
  }

  async function saveDeckFormats(deckId: number, inherit: boolean) {
    if (!selected) return;
    const deck = decks.find((d) => d.id === deckId);
    if (!deck) return;
    const effective =
      deckOverrideById[deckId] ?? formatsFromDeck(deck, selected);

    setDeckErrorById((prev) => ({ ...prev, [deckId]: "" }));
    setDeckSavingId(deckId);
    try {
      await updateDeckQuizFormatsAction({
        teamId: selected.id,
        deckId,
        formats: inherit ? null : deckOverrideById[deckId] ?? workspaceFormats,
      });
      setSavedDeckSnapshotsById((prev) => ({
        ...prev,
        [deckId]: {
          inherit,
          formats: inherit ? null : { ...effective },
        },
      }));
      setLocalContentReadyById((prev) => ({ ...prev, [deckId]: false }));
      setLocalHasAssignmentsById((prev) => ({ ...prev, [deckId]: false }));
      setGenerateMessageById((prev) => ({ ...prev, [deckId]: "" }));
      setDistributionByDeckId((prev) => ({
        ...prev,
        [deckId]: { ...EMPTY_QUIZ_FORMAT_DISTRIBUTION },
      }));
    } catch (e) {
      setDeckErrorById((prev) => ({
        ...prev,
        [deckId]: e instanceof Error ? e.message : "Could not save deck formats.",
      }));
    } finally {
      setDeckSavingId(null);
    }
  }

  function getDeckDistribution(deckId: number): QuizFormatDistribution {
    return distributionByDeckId[deckId] ?? { ...EMPTY_QUIZ_FORMAT_DISTRIBUTION };
  }

  function setDeckDistributionField(
    deckId: number,
    key: keyof QuizFormatDistribution,
    raw: string,
  ) {
    const parsed = raw === "" ? 0 : Number.parseInt(raw, 10);
    const value = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    setDistributionByDeckId((prev) => ({
      ...prev,
      [deckId]: {
        ...(prev[deckId] ?? EMPTY_QUIZ_FORMAT_DISTRIBUTION),
        [key]: value,
      },
    }));
  }

  async function generateForDeck(deckId: number, distribution: QuizFormatDistribution) {
    if (!selected) return;
    setGeneratingDeckId(deckId);
    setGenerateMessageById((prev) => ({ ...prev, [deckId]: "" }));
    try {
      const res = await generateDeckQuizVariantsAction({
        deckId,
        teamId: selected.id,
        distribution,
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
      setLocalContentReadyById((prev) => ({
        ...prev,
        [deckId]: res.contentReady,
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

  async function reshuffleForDeck(deckId: number, distribution: QuizFormatDistribution) {
    if (!selected) return;
    setReshufflingDeckId(deckId);
    setDeckErrorById((prev) => ({ ...prev, [deckId]: "" }));
    try {
      const result = await reshuffleDeckQuizFormatAssignmentsAction({
        deckId,
        teamId: selected.id,
        distribution,
      });
      setLocalHasAssignmentsById((prev) => ({ ...prev, [deckId]: true }));
      setReshuffledAtById((prev) => ({ ...prev, [deckId]: result.shuffledAt }));
      setReshuffleTooltipOpenById((prev) => ({ ...prev, [deckId]: true }));
      window.setTimeout(() => {
        setReshuffleTooltipOpenById((prev) => ({ ...prev, [deckId]: false }));
      }, 4000);
    } catch (e) {
      setDeckErrorById((prev) => ({
        ...prev,
        [deckId]: e instanceof Error ? e.message : "Could not reshuffle formats.",
      }));
    } finally {
      setReshufflingDeckId(null);
    }
  }

  if (workspaces.length === 0) return null;

  return (
    <TooltipProvider>
      <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <ListChecks className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">Quiz question formats</h2>
            <p className="text-sm text-muted-foreground">
              Choose which question types appear in quizzes for this workspace or individual decks.
              Save your format choices, set how many questions of each type (must match the deck card
              total), generate AI sentences when needed, then reshuffle how formats are assigned to
              each card.
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
              {workspaceDirty ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={workspaceSaving}
                  onClick={() => void saveWorkspaceFormats()}
                >
                  {workspaceSaving ? "Saving…" : "Save workspace formats"}
                </Button>
              ) : null}
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
                    deckOverrideById[deck.id] ?? formatsFromDeck(deck, selected);
                  const dirty = isDeckDirty(deck);
                  const needsAi = effective.trueFalse || effective.fillInBlank;
                  const contentReady =
                    localContentReadyById[deck.id] ?? deck.aiQuizContentReady;
                  const distribution = getDeckDistribution(deck.id);
                  const distributionValidation = validateQuizFormatDistribution(
                    effective,
                    distribution,
                    deck.eligibleCardCount,
                  );
                  const distributionValid = distributionValidation.valid;
                  const reshuffleFormatTypes =
                    (distribution.multipleChoice > 0 ? 1 : 0) +
                    (distribution.trueFalse > 0 ? 1 : 0) +
                    (distribution.fillInBlank > 0 ? 1 : 0);
                  const showSave = dirty;
                  const showDistribution = !showSave && deck.eligibleCardCount > 0;
                  const showGenerate =
                    !showSave && needsAi && !contentReady && distributionValid;
                  const showReshuffle =
                    !showSave &&
                    distributionValid &&
                    reshuffleFormatTypes >= 2 &&
                    (!needsAi || contentReady);
                  const hasAssignments =
                    localHasAssignmentsById[deck.id] ?? deck.hasQuizFormatAssignments;
                  const distributionSum =
                    distribution.multipleChoice +
                    distribution.trueFalse +
                    distribution.fillInBlank;

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
                      {showDistribution ? (
                        <div className="space-y-2 rounded-md border border-border/60 bg-muted/15 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-medium text-foreground">
                              Questions per format
                            </p>
                            <p
                              className={cn(
                                "text-xs tabular-nums",
                                distributionValid
                                  ? "text-muted-foreground"
                                  : "text-destructive",
                              )}
                            >
                              {distributionSum} / {deck.eligibleCardCount} cards
                            </p>
                          </div>
                          {effective.multipleChoice ? (
                            <FormatCountRow
                              id={`deck-mc-count-${deck.id}`}
                              label="Multiple choice"
                              value={distribution.multipleChoice}
                              onChange={(v) =>
                                setDeckDistributionField(deck.id, "multipleChoice", v)
                              }
                            />
                          ) : null}
                          {effective.trueFalse ? (
                            <FormatCountRow
                              id={`deck-tf-count-${deck.id}`}
                              label="True / false"
                              value={distribution.trueFalse}
                              onChange={(v) =>
                                setDeckDistributionField(deck.id, "trueFalse", v)
                              }
                            />
                          ) : null}
                          {effective.fillInBlank ? (
                            <FormatCountRow
                              id={`deck-fib-count-${deck.id}`}
                              label="Fill in the blank"
                              value={distribution.fillInBlank}
                              onChange={(v) =>
                                setDeckDistributionField(deck.id, "fillInBlank", v)
                              }
                            />
                          ) : null}
                          {!distributionValid ? (
                            <p className="text-xs text-destructive" role="alert">
                              {!distributionValidation.valid
                                ? distributionValidation.error
                                : null}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Counts must add up to {deck.eligibleCardCount} before generating AI
                              content or reshuffling.
                            </p>
                          )}
                        </div>
                      ) : null}
                      {deckErrorById[deck.id] ? (
                        <p className="text-sm text-destructive">{deckErrorById[deck.id]}</p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        {showSave ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={deckSavingId === deck.id}
                            onClick={() => void saveDeckFormats(deck.id, inherit)}
                          >
                            {deckSavingId === deck.id ? "Saving…" : "Save deck formats"}
                          </Button>
                        ) : null}
                        {showGenerate ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={generatingDeckId === deck.id || !distributionValid}
                            onClick={() => void generateForDeck(deck.id, distribution)}
                          >
                            {generatingDeckId === deck.id
                              ? "Generating…"
                              : "Generate AI quiz sentences"}
                          </Button>
                        ) : null}
                        {showReshuffle ? (
                          <Tooltip
                            open={reshuffleTooltipOpenById[deck.id] ?? false}
                            onOpenChange={(open) => {
                              setReshuffleTooltipOpenById((prev) => ({
                                ...prev,
                                [deck.id]: open,
                              }));
                            }}
                          >
                            <TooltipTrigger
                              render={(props) => (
                                <Button
                                  {...props}
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  className={cn("gap-1.5", props.className)}
                                  disabled={reshufflingDeckId === deck.id || !distributionValid}
                                  onClick={(event) => {
                                    props.onClick?.(event);
                                    void reshuffleForDeck(deck.id, distribution);
                                  }}
                                >
                                  <Shuffle className="h-3.5 w-3.5" aria-hidden />
                                  {reshufflingDeckId === deck.id
                                    ? "Reshuffling…"
                                    : "Reshuffle format questions"}
                                </Button>
                              )}
                            />
                            <TooltipContent side="top" className="max-w-xs text-center">
                              {hasAssignments
                                ? "Quiz question formats were reshuffled for this deck. Members will see the new mix on their next quiz."
                                : "Quiz question formats reshuffled for this deck."}
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
                      </div>
                      {generateMessageById[deck.id] ? (
                        <p className="text-xs text-muted-foreground">
                          {generateMessageById[deck.id]}
                        </p>
                      ) : null}
                      {(reshuffledAtById[deck.id] ?? deck.quizFormatShuffledAt) &&
                      hasAssignments &&
                      !dirty ? (
                        <p className="text-xs text-muted-foreground">
                          Last reshuffled{" "}
                          {new Date(
                            reshuffledAtById[deck.id] ?? deck.quizFormatShuffledAt ?? "",
                          ).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
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
    </TooltipProvider>
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

function FormatCountRow({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id} className="text-sm font-normal text-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={value === 0 ? "" : String(value)}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-20 text-right tabular-nums"
        aria-label={`${label} question count`}
      />
    </div>
  );
}
