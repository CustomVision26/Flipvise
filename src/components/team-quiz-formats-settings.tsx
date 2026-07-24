"use client";

import * as React from "react";
import { ListChecks, Send, Shuffle } from "lucide-react";
import { QuizFormatPreviewButton } from "@/components/quiz-format-preview-dialog";
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
import {
  shuffleDeckQuizCardOrdersAction,
  shuffleWorkspaceQuizCardOrdersAction,
} from "@/actions/quiz-card-orders";
import type {
  QuizFormatsDeckSnapshot,
  QuizFormatsWorkspaceSnapshot,
} from "@/db/queries/quiz-formats";
import { resolveQuizFormats, type QuizFormatsSettings } from "@/lib/quiz-formats";
import {
  EMPTY_QUIZ_FORMAT_DISTRIBUTION,
  explainQuizFormatContentBlock,
  explainQuizFormatReshuffleBlock,
  quizFormatDistributionsEqual,
  validateQuizFormatDistribution,
  type QuizFormatDistribution,
} from "@/lib/quiz-format-assignments";
import { cn } from "@/lib/utils";

const PLACEHOLDER_WORKSPACE = "Choose a team workspace…";

type TeamQuizFormatsSettingsProps = {
  workspaces: QuizFormatsWorkspaceSnapshot[];
  decksByWorkspaceId: Record<number, QuizFormatsDeckSnapshot[]>;
  defaultWorkspaceId: number;
  /** When true, renders as a subsection without the outer card border. */
  embedded?: boolean;
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

function aiGenerationStillNeeded(reason: string | null): boolean {
  return Boolean(reason && /Generate AI quiz sentences/i.test(reason));
}

function fallbackFormatReadyCounts(
  deck: QuizFormatsDeckSnapshot,
): QuizFormatsDeckSnapshot["formatReadyCounts"] {
  if (deck.formatReadyCounts) {
    return deck.formatReadyCounts;
  }

  // Legacy snapshots may omit per-format counts — infer from deck readiness flags.
  const total = deck.eligibleCardCount;
  if (deck.aiQuizContentReady) {
    return {
      multipleChoice: total,
      trueFalse: total,
      fillInBlank: total,
      total,
    };
  }

  return {
    multipleChoice: total,
    trueFalse: 0,
    fillInBlank: 0,
    total,
  };
}

export function TeamQuizFormatsSettings({
  workspaces,
  decksByWorkspaceId,
  defaultWorkspaceId,
  embedded = false,
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
  const [localFormatCountsById, setLocalFormatCountsById] = React.useState<
    Record<number, QuizFormatsDeckSnapshot["formatReadyCounts"]>
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
  const [cardOrderShuffledAtById, setCardOrderShuffledAtById] = React.useState<
    Record<number, string>
  >({});
  const [cardOrderViewerCountById, setCardOrderViewerCountById] = React.useState<
    Record<number, number>
  >({});
  const [distributionByDeckId, setDistributionByDeckId] = React.useState<
    Record<number, QuizFormatDistribution>
  >({});
  const [localAppliedDistributionById, setLocalAppliedDistributionById] = React.useState<
    Record<number, QuizFormatDistribution | null>
  >({});
  const [workspaceSaving, setWorkspaceSaving] = React.useState(false);
  const [deckSavingId, setDeckSavingId] = React.useState<number | null>(null);
  const [generatingDeckId, setGeneratingDeckId] = React.useState<number | null>(null);
  const [reshufflingDeckId, setReshufflingDeckId] = React.useState<number | null>(null);
  const [cardOrderShufflingDeckId, setCardOrderShufflingDeckId] = React.useState<number | null>(
    null,
  );
  const [workspaceCardOrderShuffling, setWorkspaceCardOrderShuffling] = React.useState(false);
  const [workspaceCardOrderMessage, setWorkspaceCardOrderMessage] = React.useState<string | null>(
    null,
  );
  const [workspaceError, setWorkspaceError] = React.useState<string | null>(null);
  const [deckErrorById, setDeckErrorById] = React.useState<Record<number, string>>({});
  const [generateMessageById, setGenerateMessageById] = React.useState<
    Record<number, string>
  >({});
  const autoApplyInFlightRef = React.useRef<Set<number>>(new Set());

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

    setLocalFormatCountsById((prev) => {
      const next = { ...prev };
      for (const deck of decks) {
        next[deck.id] = fallbackFormatReadyCounts(deck);
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

    setCardOrderShuffledAtById((prev) => {
      const next = { ...prev };
      for (const deck of decks) {
        if (deck.quizCardOrderShuffledAt) {
          next[deck.id] = deck.quizCardOrderShuffledAt;
        }
      }
      return next;
    });
    setCardOrderViewerCountById((prev) => {
      const next = { ...prev };
      for (const deck of decks) {
        next[deck.id] = deck.quizCardOrderViewerCount;
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

    setLocalAppliedDistributionById((prev) => {
      const next = { ...prev };
      for (const deck of decks) {
        next[deck.id] = deck.savedDistribution ?? null;
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
      setLocalAppliedDistributionById((prev) => ({ ...prev, [deckId]: null }));
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
    setDeckErrorById((prev) => ({ ...prev, [deckId]: "" }));
    setDistributionByDeckId((prev) => ({
      ...prev,
      [deckId]: {
        ...(prev[deckId] ?? EMPTY_QUIZ_FORMAT_DISTRIBUTION),
        [key]: value,
      },
    }));
  }

  async function applyDistributionForDeck(
    deckId: number,
    distribution: QuizFormatDistribution,
  ): Promise<{ ok: true; shuffledAt: string } | { ok: false; error: string }> {
    if (!selected) return { ok: false, error: "No workspace selected." };
    try {
      const result = await reshuffleDeckQuizFormatAssignmentsAction({
        deckId,
        teamId: selected.id,
        distribution,
      });
      setLocalHasAssignmentsById((prev) => ({ ...prev, [deckId]: true }));
      setLocalAppliedDistributionById((prev) => ({ ...prev, [deckId]: { ...distribution } }));
      setReshuffledAtById((prev) => ({ ...prev, [deckId]: result.shuffledAt }));
      setReshuffleTooltipOpenById((prev) => ({ ...prev, [deckId]: true }));
      window.setTimeout(() => {
        setReshuffleTooltipOpenById((prev) => ({ ...prev, [deckId]: false }));
      }, 4000);
      return { ok: true, shuffledAt: result.shuffledAt };
    } catch (e) {
      const error = e instanceof Error ? e.message : "Could not apply question counts.";
      return { ok: false, error };
    }
  }

  async function generateForDeck(deckId: number, distribution: QuizFormatDistribution) {
    if (!selected) return;
    setGeneratingDeckId(deckId);
    setGenerateMessageById((prev) => ({ ...prev, [deckId]: "" }));
    setDeckErrorById((prev) => ({ ...prev, [deckId]: "" }));
    try {
      const res = await generateDeckQuizVariantsAction({
        deckId,
        teamId: selected.id,
        distribution,
      });
      let message =
        res.generated === 0 && res.failed > 0
          ? `Could not generate quiz content — ${res.failed} of ${res.total} cards failed. Save your format settings, then try again. If this persists, check your OpenAI API key.`
          : res.generated === 0 && res.skipped === res.total
            ? `No cards needed generation (${res.total} cards already have quiz content or are empty).`
            : res.contentReady
              ? `Generated quiz content for ${res.generated} of ${res.total} cards.`
              : res.contentBlockReason
                ? `Generated quiz content for ${res.generated} of ${res.total} cards. ${res.contentBlockReason}`
                : `Generated quiz content for ${res.generated} of ${res.total} cards.`;
      setLocalContentReadyById((prev) => ({
        ...prev,
        [deckId]: res.contentReady,
      }));
      if (res.formatReadyCounts) {
        setLocalFormatCountsById((prev) => ({
          ...prev,
          [deckId]: res.formatReadyCounts,
        }));
      }

      const deck = decks.find((d) => d.id === deckId);
      const effectiveFormats =
        deckOverrideById[deckId] ??
        (deck && selected ? formatsFromDeck(deck, selected) : null);
      const refreshedCounts =
        res.formatReadyCounts ??
        localFormatCountsById[deckId] ??
        (deck ? fallbackFormatReadyCounts(deck) : null);
      const canPublishAfterGenerate =
        effectiveFormats &&
        refreshedCounts &&
        explainQuizFormatReshuffleBlock(
          effectiveFormats,
          refreshedCounts,
          distribution,
        ) === null;
      if (canPublishAfterGenerate) {
        setLocalContentReadyById((prev) => ({ ...prev, [deckId]: true }));
      }

      if (canPublishAfterGenerate || res.contentReady) {
        const applyResult = await applyDistributionForDeck(deckId, distribution);
        if (applyResult.ok) {
          message = `${message} Question counts published — members will see this mix in quiz.`;
        } else {
          setDeckErrorById((prev) => ({ ...prev, [deckId]: applyResult.error }));
          message = `${message} ${applyResult.error}`;
        }
      }

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

  async function reshuffleForDeck(deckId: number, distribution: QuizFormatDistribution) {
    if (!selected) return;
    setReshufflingDeckId(deckId);
    setDeckErrorById((prev) => ({ ...prev, [deckId]: "" }));
    try {
      const result = await applyDistributionForDeck(deckId, distribution);
      if (!result.ok) {
        setDeckErrorById((prev) => ({ ...prev, [deckId]: result.error }));
      }
    } finally {
      setReshufflingDeckId(null);
    }
  }

  async function shuffleCardOrderForDeck(deckId: number) {
    if (!selected) return;
    setCardOrderShufflingDeckId(deckId);
    setDeckErrorById((prev) => {
      const copy = { ...prev };
      delete copy[deckId];
      return copy;
    });
    try {
      const result = await shuffleDeckQuizCardOrdersAction({
        teamId: selected.id,
        deckId,
      });
      setCardOrderShuffledAtById((prev) => ({ ...prev, [deckId]: result.shuffledAt }));
      setCardOrderViewerCountById((prev) => ({ ...prev, [deckId]: result.viewerCount }));
    } catch (e) {
      setDeckErrorById((prev) => ({
        ...prev,
        [deckId]: e instanceof Error ? e.message : "Could not shuffle card order.",
      }));
    } finally {
      setCardOrderShufflingDeckId(null);
    }
  }

  async function shuffleCardOrderForWorkspace() {
    if (!selected) return;
    setWorkspaceCardOrderShuffling(true);
    setWorkspaceCardOrderMessage(null);
    setWorkspaceError(null);
    try {
      const result = await shuffleWorkspaceQuizCardOrdersAction({ teamId: selected.id });
      setWorkspaceCardOrderMessage(
        `Shuffled ${result.deckCount} deck${result.deckCount === 1 ? "" : "s"} · ${result.viewerCount} unique order${result.viewerCount === 1 ? "" : "s"}.`,
      );
      const nextAt: Record<number, string> = {};
      for (const deck of decks) {
        nextAt[deck.id] = result.shuffledAt;
      }
      setCardOrderShuffledAtById((prev) => ({ ...prev, ...nextAt }));
    } catch (e) {
      setWorkspaceError(
        e instanceof Error ? e.message : "Could not shuffle card order for this workspace.",
      );
    } finally {
      setWorkspaceCardOrderShuffling(false);
    }
  }

  function formatShuffleTime(iso: string): string {
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  }

  React.useEffect(() => {
    if (!selected) return;
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (const deck of decks) {
      const saved = savedDeckSnapshotsById[deck.id];
      if (!saved) continue;

      const inherit = deckOverrideById[deck.id] == null;
      if (inherit !== saved.inherit) continue;
      if (!inherit) {
        const current = deckOverrideById[deck.id];
        if (!current || !saved.formats || !formatsEqual(current, saved.formats)) continue;
      }

      const effective =
        deckOverrideById[deck.id] ?? formatsFromDeck(deck, selected);

      const distribution = distributionByDeckId[deck.id] ?? {
        ...EMPTY_QUIZ_FORMAT_DISTRIBUTION,
      };
      const validation = validateQuizFormatDistribution(
        effective,
        distribution,
        deck.eligibleCardCount,
      );
      if (!validation.valid) continue;

      const formatReadyCounts =
        localFormatCountsById[deck.id] ?? fallbackFormatReadyCounts(deck);
      const publishBlockReason = explainQuizFormatReshuffleBlock(
        effective,
        formatReadyCounts,
        distribution,
      );
      if (publishBlockReason !== null) continue;

      const applied =
        localAppliedDistributionById[deck.id] ?? deck.savedDistribution ?? null;
      if (quizFormatDistributionsEqual(distribution, applied)) continue;

      if (autoApplyInFlightRef.current.has(deck.id)) continue;
      if (generatingDeckId === deck.id || reshufflingDeckId === deck.id) continue;

      const timer = setTimeout(() => {
        if (autoApplyInFlightRef.current.has(deck.id)) return;
        autoApplyInFlightRef.current.add(deck.id);
        setReshufflingDeckId(deck.id);
        void applyDistributionForDeck(deck.id, distribution)
          .then((result) => {
            if (!result.ok) {
              setDeckErrorById((prev) => ({ ...prev, [deck.id]: result.error }));
              return;
            }
            setDeckErrorById((prev) => ({ ...prev, [deck.id]: "" }));
          })
          .finally(() => {
            autoApplyInFlightRef.current.delete(deck.id);
            setReshufflingDeckId((current) => (current === deck.id ? null : current));
          });
      }, 800);
      timers.push(timer);
    }

    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [
    decks,
    selected,
    deckOverrideById,
    savedDeckSnapshotsById,
    distributionByDeckId,
    localAppliedDistributionById,
    localFormatCountsById,
    generatingDeckId,
    reshufflingDeckId,
  ]);

  if (workspaces.length === 0) return null;

  const header = (
    <div className="flex items-start gap-3">
      <ListChecks className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="space-y-1">
        <h2
          className={cn(
            "font-semibold text-foreground",
            embedded ? "text-sm" : "text-base",
          )}
        >
          Quiz question formats
        </h2>
        {embedded ? null : (
          <p className="text-sm text-muted-foreground">
            Choose which question types appear in quizzes for this workspace or individual decks.
            Save your format choices, set how many questions of each type (must match the deck card
            total), generate AI sentences when needed, then publish to quiz so members see that exact
            mix.
          </p>
        )}
      </div>
    </div>
  );

  const body = (
    <>
      {header}

      <div className="grid max-w-md gap-2">
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
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-3">
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
                </div>
                <div className="flex w-full max-w-[14rem] flex-col items-stretch gap-1.5 sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={workspaceCardOrderShuffling || decks.length === 0}
                    onClick={() => void shuffleCardOrderForWorkspace()}
                  >
                    <Shuffle className="size-3.5" aria-hidden />
                    {workspaceCardOrderShuffling ? "Shuffling…" : "Shuffle card order"}
                  </Button>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Gives each assignee a unique quiz card sequence on every linked deck.
                  </p>
                  {workspaceCardOrderMessage ? (
                    <p className="text-[11px] font-medium text-emerald-400" role="status">
                      {workspaceCardOrderMessage}
                    </p>
                  ) : null}
                </div>
              </div>
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
                  const distribution = getDeckDistribution(deck.id);
                  const distributionValidation = validateQuizFormatDistribution(
                    effective,
                    distribution,
                    deck.eligibleCardCount,
                  );
                  const distributionValid = distributionValidation.valid;
                  const formatReadyCounts =
                    localFormatCountsById[deck.id] ?? fallbackFormatReadyCounts(deck);
                  const contentBlockReason = distributionValid
                    ? explainQuizFormatContentBlock(
                        effective,
                        formatReadyCounts,
                        distribution,
                      )
                    : null;
                  const publishBlockReason = distributionValid
                    ? explainQuizFormatReshuffleBlock(
                        effective,
                        formatReadyCounts,
                        distribution,
                      )
                    : distributionValidation.error;
                  const aiContentNeeded = aiGenerationStillNeeded(contentBlockReason);
                  const showSave = dirty;
                  const showDistribution = deck.eligibleCardCount > 0;
                  const distributionLocked = showSave;
                  const showGenerate =
                    !showSave && distributionValid && aiContentNeeded;
                  const canPublish =
                    !showSave && distributionValid && publishBlockReason === null;
                  const showPublishButton = showDistribution && !distributionLocked;
                  const hasAssignments =
                    localHasAssignmentsById[deck.id] ?? deck.hasQuizFormatAssignments;
                  const distributionSum =
                    distribution.multipleChoice +
                    distribution.trueFalse +
                    distribution.fillInBlank;
                  const appliedDistribution =
                    localAppliedDistributionById[deck.id] ?? deck.savedDistribution ?? null;
                  const distributionApplied = quizFormatDistributionsEqual(
                    distribution,
                    appliedDistribution,
                  );
                  const canPreview =
                    !showSave &&
                    distributionValid &&
                    (canPublish || distributionApplied) &&
                    selected != null;

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
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-2">
                          {!inherit ? (
                            <>
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
                            </>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Using workspace format defaults. Shuffle still applies a unique card
                              order per assignee for this deck.
                            </p>
                          )}
                        </div>
                        <div className="flex w-full max-w-[14rem] flex-col items-stretch gap-1.5 sm:w-auto">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            disabled={
                              cardOrderShufflingDeckId === deck.id ||
                              workspaceCardOrderShuffling ||
                              deck.eligibleCardCount === 0
                            }
                            onClick={() => void shuffleCardOrderForDeck(deck.id)}
                          >
                            <Shuffle className="size-3.5" aria-hidden />
                            {cardOrderShufflingDeckId === deck.id
                              ? "Shuffling…"
                              : cardOrderShuffledAtById[deck.id]
                                ? "Reshuffle order"
                                : "Shuffle card order"}
                          </Button>
                          {cardOrderShuffledAtById[deck.id] ? (
                            <p className="text-[11px] font-medium text-emerald-400" role="status">
                              Shuffle in effect
                              {(cardOrderViewerCountById[deck.id] ?? 0) > 0
                                ? ` · ${cardOrderViewerCountById[deck.id]} viewer${cardOrderViewerCountById[deck.id] === 1 ? "" : "s"}`
                                : ""}
                              <span className="mt-0.5 block font-normal text-muted-foreground">
                                {formatShuffleTime(cardOrderShuffledAtById[deck.id]!)}
                              </span>
                            </p>
                          ) : (
                            <p className="text-[11px] leading-snug text-muted-foreground">
                              Unique question order per member.
                            </p>
                          )}
                        </div>
                      </div>
                      {showDistribution ? (
                        <div className="space-y-2 rounded-md border border-border/60 bg-muted/15 p-3">
                          {distributionLocked ? (
                            <p className="text-xs text-amber-400/90" role="status">
                              Save deck formats above before setting question counts.
                            </p>
                          ) : null}
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
                              disabled={distributionLocked}
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
                              disabled={distributionLocked}
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
                              disabled={distributionLocked}
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
                              content or publishing to quiz.
                            </p>
                          )}
                          {distributionValid && contentBlockReason && showGenerate ? (
                            <p className="text-xs text-amber-400/90" role="status">
                              {contentBlockReason}
                            </p>
                          ) : null}
                          {distributionValid && !distributionApplied && showPublishButton ? (
                            <p className="text-xs text-amber-400/90" role="status">
                              These counts are not published yet. Click Publish to quiz so members
                              see this exact mix.
                            </p>
                          ) : null}
                          {distributionValid && showPublishButton && !canPublish && publishBlockReason && publishBlockReason !== contentBlockReason ? (
                            <p className="text-xs text-amber-400/90" role="status">
                              {publishBlockReason}
                            </p>
                          ) : null}
                        </div>
                      ) : deck.eligibleCardCount === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Add cards with front and back text before configuring question counts.
                        </p>
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
                            variant="outline"
                            disabled={generatingDeckId === deck.id || !distributionValid}
                            onClick={() => void generateForDeck(deck.id, distribution)}
                          >
                            {generatingDeckId === deck.id
                              ? "Generating…"
                              : "Generate AI quiz sentences"}
                          </Button>
                        ) : null}
                        {canPreview ? (
                          <QuizFormatPreviewButton
                            deckId={deck.id}
                            teamId={selected!.id}
                            deckName={deck.name}
                            distribution={distribution}
                          />
                        ) : null}
                        {showPublishButton ? (
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
                                  variant={distributionApplied ? "secondary" : "default"}
                                  className={cn("gap-1.5", props.className)}
                                  disabled={
                                    reshufflingDeckId === deck.id ||
                                    !canPublish ||
                                    !distributionValid
                                  }
                                  onClick={(event) => {
                                    props.onClick?.(event);
                                    void reshuffleForDeck(deck.id, distribution);
                                  }}
                                >
                                  <Send className="h-3.5 w-3.5" aria-hidden />
                                  {reshufflingDeckId === deck.id
                                    ? "Publishing…"
                                    : distributionApplied
                                      ? "Republish to quiz"
                                      : "Publish to quiz"}
                                </Button>
                              )}
                            />
                            <TooltipContent side="top" className="max-w-xs text-center">
                              {publishBlockReason
                                ? publishBlockReason
                                : distributionApplied
                                  ? "Update the published quiz mix for members on their next quiz session."
                                  : "Publish these question counts so members see this exact mix in quiz."}
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
                      distributionApplied &&
                      !dirty ? (
                        <p className="text-xs text-muted-foreground">
                          Published to quiz{" "}
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
    </>
  );

  return (
    <TooltipProvider>
      {embedded ? (
        <div className="space-y-4">{body}</div>
      ) : (
        <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
          {body}
        </section>
      )}
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
  disabled = false,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label
        htmlFor={id}
        className={cn(
          "text-sm font-normal text-foreground",
          disabled && "text-muted-foreground",
        )}
      >
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        disabled={disabled}
        value={value === 0 ? "" : String(value)}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-20 text-right tabular-nums"
        aria-label={`${label} question count`}
      />
    </div>
  );
}
