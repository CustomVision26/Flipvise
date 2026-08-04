"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  updateTeamAiRecallSessionCardCountAction,
  updateTeamDeckAiRecallSessionCardCountAction,
} from "@/actions/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import type { AiRecallSessionCardsSettingsProps } from "@/components/ai-recall-session-cards-settings-types";

export type {
  AiRecallSessionCardDeckRow,
  AiRecallSessionCardsSettingsProps,
} from "@/components/ai-recall-session-cards-settings-types";

type WorkspaceMode = "all" | "fixed";
type DeckMode = "inherit" | "all" | "fixed";

function workspaceModeFromCount(count: number | null): WorkspaceMode {
  return count == null ? "all" : "fixed";
}

function deckModeFromCount(count: number | null): DeckMode {
  if (count == null) return "inherit";
  if (count === 0) return "all";
  return "fixed";
}

function workspaceLabel(count: number | null): string {
  return count == null ? "All cards" : `${count} cards`;
}

export function AiRecallSessionCardsSettings({
  teamId,
  initialWorkspaceCardCount,
  decks,
}: AiRecallSessionCardsSettingsProps) {
  const router = useRouter();
  const [workspaceMode, setWorkspaceMode] = React.useState<WorkspaceMode>(
    workspaceModeFromCount(initialWorkspaceCardCount),
  );
  const [workspaceCount, setWorkspaceCount] = React.useState(
    String(initialWorkspaceCardCount ?? 10),
  );
  const [workspacePending, setWorkspacePending] = React.useState(false);

  const [deckModes, setDeckModes] = React.useState<Record<number, DeckMode>>(
    () =>
      Object.fromEntries(
        decks.map((d) => [d.id, deckModeFromCount(d.aiRecallSessionCardCount)]),
      ),
  );
  const [deckCounts, setDeckCounts] = React.useState<Record<number, string>>(
    () =>
      Object.fromEntries(
        decks.map((d) => [
          d.id,
          String(
            d.aiRecallSessionCardCount != null && d.aiRecallSessionCardCount > 0
              ? d.aiRecallSessionCardCount
              : 10,
          ),
        ]),
      ),
  );
  const [busyDeckId, setBusyDeckId] = React.useState<number | null>(null);

  React.useEffect(() => {
    setWorkspaceMode(workspaceModeFromCount(initialWorkspaceCardCount));
    setWorkspaceCount(String(initialWorkspaceCardCount ?? 10));
  }, [initialWorkspaceCardCount]);

  React.useEffect(() => {
    setDeckModes(
      Object.fromEntries(
        decks.map((d) => [d.id, deckModeFromCount(d.aiRecallSessionCardCount)]),
      ),
    );
    setDeckCounts(
      Object.fromEntries(
        decks.map((d) => [
          d.id,
          String(
            d.aiRecallSessionCardCount != null && d.aiRecallSessionCardCount > 0
              ? d.aiRecallSessionCardCount
              : 10,
          ),
        ]),
      ),
    );
  }, [decks]);

  async function saveWorkspace() {
    setWorkspacePending(true);
    try {
      const nextCount =
        workspaceMode === "all"
          ? null
          : (() => {
              const n = Number.parseInt(workspaceCount, 10);
              if (!Number.isFinite(n) || n < 1 || n > 100) {
                throw new Error("Enter a number between 1 and 100.");
              }
              return n;
            })();
      await updateTeamAiRecallSessionCardCountAction({
        teamId,
        cardCount: nextCount,
      });
      toast.success(
        nextCount == null
          ? "Workspace default: all cards in each deck."
          : `Workspace default: ${nextCount} card${nextCount === 1 ? "" : "s"} per session.`,
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save setting");
    } finally {
      setWorkspacePending(false);
    }
  }

  async function saveDeck(deckId: number) {
    const mode = deckModes[deckId] ?? "inherit";
    setBusyDeckId(deckId);
    try {
      const nextCount =
        mode === "inherit"
          ? null
          : mode === "all"
            ? 0
            : (() => {
                const n = Number.parseInt(deckCounts[deckId] ?? "10", 10);
                if (!Number.isFinite(n) || n < 1 || n > 100) {
                  throw new Error("Enter a number between 1 and 100.");
                }
                return n;
              })();
      await updateTeamDeckAiRecallSessionCardCountAction({
        teamId,
        deckId,
        cardCount: nextCount,
      });
      toast.success(
        mode === "inherit"
          ? "Deck now uses the workspace default."
          : mode === "all"
            ? "Deck override: all cards."
            : `Deck override: ${nextCount} cards per session.`,
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save deck setting");
    } finally {
      setBusyDeckId(null);
    }
  }

  const workspaceEffectiveLabel = workspaceLabel(
    workspaceMode === "all"
      ? null
      : Number.parseInt(workspaceCount, 10) || initialWorkspaceCardCount,
  );

  return (
    <div className="space-y-4">
      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle>Workspace default</CardTitle>
          <CardDescription>
            Applies to every linked deck that does not have its own override.
            Members still shuffle within the chosen subset.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={workspaceMode}
            onValueChange={(v) => setWorkspaceMode(v as WorkspaceMode)}
            className="gap-3"
            disabled={workspacePending}
          >
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="all" id="ai-recall-ws-all" />
              <span>All cards in the deck</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <RadioGroupItem
                value="fixed"
                id="ai-recall-ws-fixed"
                className="mt-1"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-2">
                Fixed number of cards
                <span className="space-y-1">
                  <Label htmlFor="ai-recall-ws-count" className="text-xs">
                    Cards per session
                  </Label>
                  <Input
                    id="ai-recall-ws-count"
                    type="number"
                    min={1}
                    max={100}
                    disabled={workspaceMode === "all" || workspacePending}
                    value={workspaceCount}
                    onChange={(e) => setWorkspaceCount(e.target.value)}
                    className="w-28"
                  />
                </span>
              </span>
            </label>
          </RadioGroup>
          <Button
            type="button"
            disabled={workspacePending}
            onClick={() => void saveWorkspace()}
          >
            {workspacePending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : null}
            Save workspace default
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle>Per-deck overrides</CardTitle>
          <CardDescription>
            Optional. Leave a deck on workspace default, or set all cards / a
            fixed count for that deck only. Current workspace default:{" "}
            {workspaceEffectiveLabel}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {decks.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/80 bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">
              No decks linked to this workspace yet.
            </p>
          ) : (
            <ul className="space-y-4">
              {decks.map((deck, index) => {
                const mode = deckModes[deck.id] ?? "inherit";
                const pending = busyDeckId === deck.id;
                return (
                  <li key={deck.id} className="space-y-3">
                    {index > 0 ? <Separator className="bg-border/60" /> : null}
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 truncate text-sm font-medium">
                        {deck.name}
                      </p>
                      {mode === "inherit" ? (
                        <Badge variant="outline" className="text-[10px]">
                          Workspace default
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          Override
                        </Badge>
                      )}
                    </div>
                    <RadioGroup
                      value={mode}
                      onValueChange={(v) =>
                        setDeckModes((prev) => ({
                          ...prev,
                          [deck.id]: v as DeckMode,
                        }))
                      }
                      className="gap-2"
                      disabled={pending}
                    >
                      <label className="flex items-center gap-2 text-sm">
                        <RadioGroupItem
                          value="inherit"
                          id={`ai-recall-deck-${deck.id}-inherit`}
                        />
                        <span>
                          Use workspace default ({workspaceEffectiveLabel})
                        </span>
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <RadioGroupItem
                          value="all"
                          id={`ai-recall-deck-${deck.id}-all`}
                        />
                        <span>All cards in this deck</span>
                      </label>
                      <label className="flex items-start gap-2 text-sm">
                        <RadioGroupItem
                          value="fixed"
                          id={`ai-recall-deck-${deck.id}-fixed`}
                          className="mt-1"
                        />
                        <span className="flex min-w-0 flex-1 flex-col gap-2">
                          Fixed number of cards
                          <Input
                            type="number"
                            min={1}
                            max={100}
                            disabled={mode !== "fixed" || pending}
                            value={deckCounts[deck.id] ?? "10"}
                            onChange={(e) =>
                              setDeckCounts((prev) => ({
                                ...prev,
                                [deck.id]: e.target.value,
                              }))
                            }
                            className="w-28"
                            aria-label={`Cards per session for ${deck.name}`}
                          />
                        </span>
                      </label>
                    </RadioGroup>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => void saveDeck(deck.id)}
                    >
                      {pending ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      ) : null}
                      Save deck
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
