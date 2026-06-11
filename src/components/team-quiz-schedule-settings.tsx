"use client";

import * as React from "react";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateDeckQuizStartScheduleAction,
  updateTeamQuizStartScheduleAction,
} from "@/actions/quiz-schedule";
import type {
  QuizScheduleDeckSnapshot,
  QuizScheduleWorkspaceSnapshot,
} from "@/db/queries/quiz-schedule";
import {
  formatQuizStartSchedule,
  toDatetimeLocalValue,
} from "@/lib/quiz-start-schedule";
import { cn } from "@/lib/utils";

const PLACEHOLDER_WORKSPACE = "Choose a team workspace…";
const PLACEHOLDER_DECK = "Choose a deck…";

type TeamQuizScheduleSettingsProps = {
  workspaces: QuizScheduleWorkspaceSnapshot[];
  decksByWorkspaceId: Record<number, QuizScheduleDeckSnapshot[]>;
  defaultWorkspaceId: number;
};

type ScheduleDraft = {
  enabled: boolean;
  startAtLocal: string;
};

function buildWorkspaceDrafts(
  workspaces: QuizScheduleWorkspaceSnapshot[],
): Record<number, ScheduleDraft> {
  return Object.fromEntries(
    workspaces.map((workspace) => [
      workspace.id,
      {
        enabled: workspace.quizStartScheduleEnabled,
        startAtLocal: toDatetimeLocalValue(workspace.quizStartAt),
      },
    ]),
  );
}

function buildDeckDrafts(decks: QuizScheduleDeckSnapshot[]): Record<number, ScheduleDraft> {
  return Object.fromEntries(
    decks.map((deck) => [
      deck.id,
      {
        enabled: deck.quizStartScheduleEnabled,
        startAtLocal: toDatetimeLocalValue(deck.quizStartAt),
      },
    ]),
  );
}

function ScheduleCard({
  title,
  description,
  enabled,
  startAtLocal,
  saving,
  saved,
  error,
  onEnabledChange,
  onStartAtChange,
  onSave,
  idPrefix,
}: {
  title: string;
  description: string;
  enabled: boolean;
  startAtLocal: string;
  saving: boolean;
  saved: boolean;
  error: string | null;
  onEnabledChange: (checked: boolean) => void;
  onStartAtChange: (value: string) => void;
  onSave: () => void;
  idPrefix: string;
}) {
  return (
    <div className="space-y-4 rounded-lg border border-border/80 bg-muted/15 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <CalendarClock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <p className="font-medium text-foreground">{title}</p>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          <p
            className={cn(
              "text-xs font-medium",
              enabled ? "text-emerald-400" : "text-muted-foreground",
            )}
          >
            {enabled
              ? startAtLocal
                ? `Starts ${formatQuizStartSchedule(startAtLocal)}`
                : "Choose a start date and time"
              : "Scheduling off"}
          </p>
        </div>
        <Switch
          id={`${idPrefix}-enabled`}
          checked={enabled}
          disabled={saving}
          onCheckedChange={onEnabledChange}
          aria-label={`Use scheduled start for ${title}`}
        />
      </div>

      <div
        className={cn(
          "max-w-md space-y-1.5",
          !enabled && "pointer-events-none opacity-50",
        )}
        aria-hidden={!enabled}
      >
        <Label
          htmlFor={`${idPrefix}-start-at`}
          className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
        >
          Start date & time
        </Label>
        <Input
          id={`${idPrefix}-start-at`}
          type="datetime-local"
          value={startAtLocal}
          disabled={!enabled || saving}
          onChange={(event) => onStartAtChange(event.target.value)}
          className="h-10 bg-background"
        />
        <p className="text-xs text-muted-foreground">
          Uses your local timezone. Members cannot start the quiz before this moment.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={saving} onClick={onSave}>
          {saving ? "Saving…" : "Save schedule"}
        </Button>
        {saved ? (
          <p className="text-xs font-medium text-emerald-400">Schedule saved.</p>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TeamQuizScheduleSettings({
  workspaces,
  decksByWorkspaceId,
  defaultWorkspaceId,
}: TeamQuizScheduleSettingsProps) {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = React.useState(defaultWorkspaceId);
  const decks = React.useMemo(
    () => decksByWorkspaceId[selectedWorkspaceId] ?? [],
    [decksByWorkspaceId, selectedWorkspaceId],
  );
  const [selectedDeckId, setSelectedDeckId] = React.useState<number | null>(null);
  const [workspaceDrafts, setWorkspaceDrafts] = React.useState(() =>
    buildWorkspaceDrafts(workspaces),
  );
  const [deckDrafts, setDeckDrafts] = React.useState<Record<number, ScheduleDraft>>({});
  const [workspaceSaving, setWorkspaceSaving] = React.useState(false);
  const [deckSaving, setDeckSaving] = React.useState(false);
  const [workspaceError, setWorkspaceError] = React.useState<string | null>(null);
  const [deckError, setDeckError] = React.useState<string | null>(null);
  const [workspaceSaved, setWorkspaceSaved] = React.useState(false);
  const [deckSaved, setDeckSaved] = React.useState(false);

  React.useEffect(() => {
    setSelectedWorkspaceId(defaultWorkspaceId);
  }, [defaultWorkspaceId]);

  React.useEffect(() => {
    setWorkspaceDrafts(buildWorkspaceDrafts(workspaces));
  }, [workspaces]);

  React.useEffect(() => {
    setDeckDrafts((prev) => ({ ...prev, ...buildDeckDrafts(decks) }));
    setSelectedDeckId((current) => {
      if (current != null && decks.some((deck) => deck.id === current)) return current;
      return decks[0]?.id ?? null;
    });
  }, [decks]);

  const selectedWorkspace =
    workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ??
    workspaces[0] ??
    null;
  const workspaceDraft = selectedWorkspace
    ? workspaceDrafts[selectedWorkspace.id]
    : null;

  const selectedDeck =
    decks.find((deck) => deck.id === selectedDeckId) ?? decks[0] ?? null;
  const deckDraft = selectedDeck ? deckDrafts[selectedDeck.id] : null;

  async function saveWorkspaceSchedule() {
    if (!selectedWorkspace || !workspaceDraft) return;
    setWorkspaceError(null);
    setWorkspaceSaved(false);
    setWorkspaceSaving(true);
    try {
      await updateTeamQuizStartScheduleAction({
        teamId: selectedWorkspace.id,
        enabled: workspaceDraft.enabled,
        startAtLocal: workspaceDraft.startAtLocal || undefined,
      });
      setWorkspaceSaved(true);
    } catch (error) {
      setWorkspaceError(
        error instanceof Error ? error.message : "Could not save workspace schedule.",
      );
    } finally {
      setWorkspaceSaving(false);
    }
  }

  async function saveDeckSchedule() {
    if (!selectedWorkspace || !selectedDeck || !deckDraft) return;
    setDeckError(null);
    setDeckSaved(false);
    setDeckSaving(true);
    try {
      await updateDeckQuizStartScheduleAction({
        teamId: selectedWorkspace.id,
        deckId: selectedDeck.id,
        enabled: deckDraft.enabled,
        startAtLocal: deckDraft.startAtLocal || undefined,
      });
      setDeckSaved(true);
    } catch (error) {
      setDeckError(error instanceof Error ? error.message : "Could not save deck schedule.");
    } finally {
      setDeckSaving(false);
    }
  }

  if (workspaces.length === 0) return null;

  return (
    <div className="space-y-8">
      <section className="space-y-5">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">Workspace quiz start</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Set one start date and time for every quiz in the selected workspace. Deck schedules
            override this when enabled.
          </p>
        </div>

        <div className="max-w-md space-y-1.5">
          <Label
            htmlFor="quiz-schedule-workspace"
            className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
          >
            Workspace
          </Label>
          <Select
            value={String(selectedWorkspaceId)}
            onValueChange={(value) => {
              if (value != null) {
                setSelectedWorkspaceId(Number(value));
                setWorkspaceSaved(false);
              }
            }}
          >
            <SelectTrigger id="quiz-schedule-workspace" className="h-10 w-full bg-background">
              <SelectValue placeholder={PLACEHOLDER_WORKSPACE}>
                {selectedWorkspace?.name ?? PLACEHOLDER_WORKSPACE}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {workspaces.map((workspace) => (
                <SelectItem key={workspace.id} value={String(workspace.id)}>
                  <span className="truncate">{workspace.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedWorkspace && workspaceDraft ? (
          <ScheduleCard
            idPrefix={`workspace-${selectedWorkspace.id}`}
            title={selectedWorkspace.name}
            description="When on, members cannot start any quiz in this workspace until the scheduled time."
            enabled={workspaceDraft.enabled}
            startAtLocal={workspaceDraft.startAtLocal}
            saving={workspaceSaving}
            saved={workspaceSaved}
            error={workspaceError}
            onEnabledChange={(checked) => {
              setWorkspaceDrafts((prev) => ({
                ...prev,
                [selectedWorkspace.id]: {
                  ...prev[selectedWorkspace.id],
                  enabled: checked,
                },
              }));
              setWorkspaceSaved(false);
            }}
            onStartAtChange={(value) => {
              setWorkspaceDrafts((prev) => ({
                ...prev,
                [selectedWorkspace.id]: {
                  ...prev[selectedWorkspace.id],
                  startAtLocal: value,
                },
              }));
              setWorkspaceSaved(false);
            }}
            onSave={() => void saveWorkspaceSchedule()}
          />
        ) : null}
      </section>

      <Separator />

      <section className="space-y-5">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">Deck quiz start</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Override the workspace schedule for a single deck quiz. When off, the workspace schedule
            applies.
          </p>
        </div>

        {decks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/80 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
            No decks in this workspace yet.
          </p>
        ) : (
          <>
            <div className="max-w-md space-y-1.5">
              <Label
                htmlFor="quiz-schedule-deck"
                className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
              >
                Deck
              </Label>
              <Select
                value={selectedDeck ? String(selectedDeck.id) : undefined}
                onValueChange={(value) => {
                  if (value != null) {
                    setSelectedDeckId(Number(value));
                    setDeckSaved(false);
                  }
                }}
              >
                <SelectTrigger id="quiz-schedule-deck" className="h-10 w-full bg-background">
                  <SelectValue placeholder={PLACEHOLDER_DECK}>
                    {selectedDeck?.name ?? PLACEHOLDER_DECK}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {decks.map((deck) => (
                    <SelectItem key={deck.id} value={String(deck.id)}>
                      <span className="truncate">{deck.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedDeck && deckDraft ? (
              <ScheduleCard
                idPrefix={`deck-${selectedDeck.id}`}
                title={selectedDeck.name}
                description="When on, members cannot start this deck's quiz until the scheduled time."
                enabled={deckDraft.enabled}
                startAtLocal={deckDraft.startAtLocal}
                saving={deckSaving}
                saved={deckSaved}
                error={deckError}
                onEnabledChange={(checked) => {
                  setDeckDrafts((prev) => ({
                    ...prev,
                    [selectedDeck.id]: {
                      ...prev[selectedDeck.id],
                      enabled: checked,
                    },
                  }));
                  setDeckSaved(false);
                }}
                onStartAtChange={(value) => {
                  setDeckDrafts((prev) => ({
                    ...prev,
                    [selectedDeck.id]: {
                      ...prev[selectedDeck.id],
                      startAtLocal: value,
                    },
                  }));
                  setDeckSaved(false);
                }}
                onSave={() => void saveDeckSchedule()}
              />
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
