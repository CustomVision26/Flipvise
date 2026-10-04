"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { TeamAdminRecordSlider } from "@/components/team-admin-record-slider";
import {
  updateOwnerQuizDefaultAction,
  updateTeamDeckQuizDurationAction,
} from "@/actions/teams";
import {
  DEFAULT_TEAM_QUIZ_DURATION_MINUTES,
  type QuizTimerDeckSnapshot,
  type QuizTimerWorkspaceSnapshot,
} from "@/lib/team-quiz-duration";
import { cn } from "@/lib/utils";

const PRESET_MINUTES = [5, 10, 15, 20, 30, 45, 60, 90, 120] as const;

type PresetSelectProps = {
  idPrefix: string;
  durationMinutes: number;
  onDurationChange: (minutes: number) => void;
  disabled?: boolean;
};

function PresetSelect({
  idPrefix,
  durationMinutes,
  onDurationChange,
  disabled = false,
}: PresetSelectProps) {
  return (
    <div
      className={cn(
        "max-w-xs space-y-1.5",
        disabled && "pointer-events-none opacity-50",
      )}
      aria-hidden={disabled}
    >
      <Label
        htmlFor={`${idPrefix}-preset`}
        className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
      >
        Quick presets
      </Label>
      <Select
        value={String(durationMinutes)}
        disabled={disabled}
        onValueChange={(v) => {
          if (v == null) return;
          onDurationChange(Number(v));
        }}
      >
        <SelectTrigger id={`${idPrefix}-preset`} className="h-10 w-full bg-background">
          <SelectValue placeholder="Choose duration" />
        </SelectTrigger>
        <SelectContent>
          {PRESET_MINUTES.map((minutes) => (
            <SelectItem key={minutes} value={String(minutes)}>
              {minutes} minutes
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DeckTimerEditor({
  deck,
  fallbackMinutes,
  minutes,
  dirty,
  hasCustom,
  customMinutes,
  saving,
  error,
  saved,
  onDurationChange,
  onSave,
  onReset,
}: {
  deck: QuizTimerDeckSnapshot;
  fallbackMinutes: number;
  minutes: number;
  dirty: boolean;
  hasCustom: boolean;
  customMinutes: number | null;
  saving: boolean;
  error?: string;
  saved: boolean;
  onDurationChange: (minutes: number) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Set timed-quiz minutes for each deck. Matching the workspace default ({fallbackMinutes} min)
        clears a custom override.
      </p>
      <div className="space-y-3 rounded-lg border border-border/80 bg-muted/15 p-4">
        <div className="space-y-0.5">
          <p className="font-medium text-foreground">{deck.name}</p>
          <p className="text-xs text-muted-foreground">
            {hasCustom
              ? `Custom · ${customMinutes} min`
              : `Using workspace default · ${fallbackMinutes} min`}
          </p>
        </div>

        {error ? (
          <p
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        {saved ? (
          <p className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-foreground">
            Deck quiz timer updated.
          </p>
        ) : null}

        <PresetSelect
          idPrefix={`quiz-deck-${deck.id}`}
          durationMinutes={minutes}
          disabled={saving}
          onDurationChange={onDurationChange}
        />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className="h-9"
            disabled={!dirty || saving}
            onClick={onSave}
          >
            <Clock className="mr-1.5 size-3.5" aria-hidden />
            {saving ? "Saving…" : "Save deck timer"}
          </Button>
          {hasCustom ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              disabled={saving}
              onClick={onReset}
            >
              Use workspace default
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type QuizTimerDeckRow = {
  key: string;
  teamId: number;
  workspaceName: string;
  memberLabel: string;
  memberUserId: string;
  deckId: number | null;
  deckName: string;
};

function timerStatusLabel(input: {
  enforceDefault: boolean;
  globalMinutes: number;
  fallbackMinutes: number;
  customMinutes: number | null;
  hasDeck: boolean;
}): string {
  if (!input.hasDeck) return "No linked decks";
  if (input.enforceDefault) return `Locked · ${input.globalMinutes} min`;
  if (input.customMinutes != null) return `Custom · ${input.customMinutes} min`;
  return `Workspace default · ${input.fallbackMinutes} min`;
}

function buildDeckRows(
  workspaces: QuizTimerWorkspaceSnapshot[],
  decksByWorkspaceId: Record<number, QuizTimerDeckSnapshot[]>,
): QuizTimerDeckRow[] {
  const rows: QuizTimerDeckRow[] = [];
  for (const workspace of workspaces) {
    const decks = decksByWorkspaceId[workspace.id] ?? [];
    if (decks.length === 0) {
      rows.push({
        key: `${workspace.id}-none`,
        teamId: workspace.id,
        workspaceName: workspace.name,
        memberLabel: workspace.name,
        memberUserId: `ws:${workspace.id}`,
        deckId: null,
        deckName: "—",
      });
      continue;
    }
    for (const deck of decks) {
      rows.push({
        key: `${workspace.id}-${deck.id}`,
        teamId: workspace.id,
        workspaceName: workspace.name,
        memberLabel: workspace.name,
        memberUserId: `ws:${workspace.id}`,
        deckId: deck.id,
        deckName: deck.name,
      });
    }
  }
  return rows;
}

function normalizeWorkspaceList(
  workspaces: QuizTimerWorkspaceSnapshot[] | null | undefined,
): QuizTimerWorkspaceSnapshot[] {
  if (Array.isArray(workspaces)) return workspaces;
  return [];
}

function normalizeDecksByWorkspace(
  decksByWorkspaceId: Record<number, QuizTimerDeckSnapshot[]> | null | undefined,
): Record<number, QuizTimerDeckSnapshot[]> {
  if (decksByWorkspaceId == null || typeof decksByWorkspaceId !== "object") {
    return {};
  }
  return decksByWorkspaceId;
}

function buildDeckDrafts(
  decksByWorkspaceId: Record<number, QuizTimerDeckSnapshot[]>,
  workspaces: QuizTimerWorkspaceSnapshot[],
  globalDefaultMinutes: number,
  enforceDefault: boolean,
): Record<number, number> {
  const drafts: Record<number, number> = {};
  for (const workspace of workspaces) {
    const fallback = enforceDefault
      ? globalDefaultMinutes
      : (workspace.workspaceOverrideMinutes ?? globalDefaultMinutes);
    for (const deck of decksByWorkspaceId[workspace.id] ?? []) {
      drafts[deck.id] = deck.quizDurationMinutes ?? fallback;
    }
  }
  return drafts;
}

function buildCommittedDeckMinutes(
  decksByWorkspaceId: Record<number, QuizTimerDeckSnapshot[]>,
): Record<number, number | null> {
  const committed: Record<number, number | null> = {};
  for (const decks of Object.values(decksByWorkspaceId)) {
    for (const deck of decks) {
      committed[deck.id] = deck.quizDurationMinutes;
    }
  }
  return committed;
}

export type TeamQuizTimerSettingsProps = {
  workspaces?: QuizTimerWorkspaceSnapshot[];
  decksByWorkspaceId?: Record<number, QuizTimerDeckSnapshot[]>;
  defaultWorkspaceId: number;
  isSubscriberOwner: boolean;
  ownedWorkspaceCount: number;
  globalDefaultMinutes: number;
  enforceDefaultForAllWorkspaces: boolean;
};

export function TeamQuizTimerSettings({
  workspaces: workspacesProp = [],
  decksByWorkspaceId: decksByWorkspaceProp = {},
  defaultWorkspaceId: _defaultWorkspaceId,
  isSubscriberOwner,
  ownedWorkspaceCount,
  globalDefaultMinutes,
  enforceDefaultForAllWorkspaces: enforceDefaultProp,
}: TeamQuizTimerSettingsProps) {
  const workspaces = React.useMemo(
    () => normalizeWorkspaceList(workspacesProp),
    [workspacesProp],
  );
  const decksByWorkspaceId = React.useMemo(
    () => normalizeDecksByWorkspace(decksByWorkspaceProp),
    [decksByWorkspaceProp],
  );

  const [committedGlobalMinutes, setCommittedGlobalMinutes] =
    React.useState(globalDefaultMinutes);
  const [committedEnforceDefault, setCommittedEnforceDefault] = React.useState(
    enforceDefaultProp,
  );
  const [globalMinutes, setGlobalMinutes] = React.useState(globalDefaultMinutes);
  const [enforceDefault, setEnforceDefault] = React.useState(enforceDefaultProp);
  const [committedDeckMinutes, setCommittedDeckMinutes] = React.useState(() =>
    buildCommittedDeckMinutes(normalizeDecksByWorkspace(decksByWorkspaceProp)),
  );
  const [draftMinutesByDeckId, setDraftMinutesByDeckId] = React.useState(() =>
    buildDeckDrafts(
      normalizeDecksByWorkspace(decksByWorkspaceProp),
      normalizeWorkspaceList(workspacesProp),
      globalDefaultMinutes,
      enforceDefaultProp,
    ),
  );
  const [activeRowKey, setActiveRowKey] = React.useState<string | null>(null);
  const [globalBusy, setGlobalBusy] = React.useState(false);
  const [busyDeckId, setBusyDeckId] = React.useState<number | null>(null);
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [deckErrorById, setDeckErrorById] = React.useState<Record<number, string>>({});
  const [globalSaved, setGlobalSaved] = React.useState(false);
  const [savedDeckIds, setSavedDeckIds] = React.useState<Record<number, true>>({});

  React.useEffect(() => {
    setCommittedGlobalMinutes(globalDefaultMinutes);
    setCommittedEnforceDefault(enforceDefaultProp);
    setGlobalMinutes(globalDefaultMinutes);
    setEnforceDefault(enforceDefaultProp);
    setCommittedDeckMinutes(buildCommittedDeckMinutes(decksByWorkspaceId));
    setDraftMinutesByDeckId(
      buildDeckDrafts(
        decksByWorkspaceId,
        workspaces,
        globalDefaultMinutes,
        enforceDefaultProp,
      ),
    );
  }, [
    globalDefaultMinutes,
    enforceDefaultProp,
    decksByWorkspaceId,
    workspaces,
  ]);

  const rows = React.useMemo(
    () => buildDeckRows(workspaces, decksByWorkspaceId),
    [workspaces, decksByWorkspaceId],
  );

  const globalDirty =
    globalMinutes !== committedGlobalMinutes ||
    enforceDefault !== committedEnforceDefault;
  const perDeckEditingEnabled = !committedEnforceDefault;

  function workspaceFallbackMinutes(teamId: number): number {
    if (committedEnforceDefault) return committedGlobalMinutes;
    const snap = workspaces.find((w) => w.id === teamId);
    return snap?.workspaceOverrideMinutes ?? committedGlobalMinutes;
  }

  function draftMinutesForDeck(deckId: number, teamId: number): number {
    return draftMinutesByDeckId[deckId] ?? workspaceFallbackMinutes(teamId);
  }

  function isDeckDirty(deckId: number, teamId: number): boolean {
    const committed = committedDeckMinutes[deckId] ?? null;
    const draft = draftMinutesForDeck(deckId, teamId);
    const nextSave =
      draft === workspaceFallbackMinutes(teamId) ? null : draft;
    return nextSave !== committed;
  }

  function onDeckRowActivate(row: QuizTimerDeckRow) {
    setActiveRowKey((prev) => (prev === row.key ? null : row.key));
  }

  async function onSaveGlobal() {
    setGlobalError(null);
    setGlobalSaved(false);
    setGlobalBusy(true);
    try {
      await updateOwnerQuizDefaultAction({
        durationMinutes: globalMinutes,
        enforceDefaultForAllWorkspaces: enforceDefault,
      });
      setCommittedGlobalMinutes(globalMinutes);
      setCommittedEnforceDefault(enforceDefault);
      setGlobalSaved(true);
      setCommittedDeckMinutes((prev) => {
        const next = { ...prev };
        for (const decks of Object.values(decksByWorkspaceId)) {
          for (const deck of decks) {
            next[deck.id] = globalMinutes;
          }
        }
        return next;
      });
      setDraftMinutesByDeckId((prev) => {
        const next = { ...prev };
        for (const decks of Object.values(decksByWorkspaceId)) {
          for (const deck of decks) {
            next[deck.id] = globalMinutes;
          }
        }
        return next;
      });
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Could not save default quiz timer.");
    } finally {
      setGlobalBusy(false);
    }
  }

  async function onSaveDeck(teamId: number, deckId: number) {
    const minutes = draftMinutesForDeck(deckId, teamId);
    const fallback = workspaceFallbackMinutes(teamId);
    const durationMinutes = minutes === fallback ? null : minutes;
    setDeckErrorById((prev) => {
      const copy = { ...prev };
      delete copy[deckId];
      return copy;
    });
    setSavedDeckIds((prev) => {
      const copy = { ...prev };
      delete copy[deckId];
      return copy;
    });
    setBusyDeckId(deckId);
    try {
      await updateTeamDeckQuizDurationAction({ teamId, deckId, durationMinutes });
      setCommittedDeckMinutes((prev) => ({ ...prev, [deckId]: durationMinutes }));
      setSavedDeckIds((prev) => ({ ...prev, [deckId]: true }));
    } catch (e) {
      setDeckErrorById((prev) => ({
        ...prev,
        [deckId]:
          e instanceof Error ? e.message : "Could not save deck quiz timer.",
      }));
    } finally {
      setBusyDeckId(null);
    }
  }

  async function onResetDeckToWorkspaceDefault(teamId: number, deckId: number) {
    setDeckErrorById((prev) => {
      const copy = { ...prev };
      delete copy[deckId];
      return copy;
    });
    setBusyDeckId(deckId);
    try {
      await updateTeamDeckQuizDurationAction({
        teamId,
        deckId,
        durationMinutes: null,
      });
      const fallback = workspaceFallbackMinutes(teamId);
      setCommittedDeckMinutes((prev) => ({ ...prev, [deckId]: null }));
      setDraftMinutesByDeckId((prev) => ({ ...prev, [deckId]: fallback }));
      setSavedDeckIds((prev) => ({ ...prev, [deckId]: true }));
    } catch (e) {
      setDeckErrorById((prev) => ({
        ...prev,
        [deckId]:
          e instanceof Error ? e.message : "Could not reset deck quiz timer.",
      }));
    } finally {
      setBusyDeckId(null);
    }
  }

  function renderOpenPanel(row: QuizTimerDeckRow) {
    const fallback = workspaceFallbackMinutes(row.teamId);
    const decks = decksByWorkspaceId[row.teamId] ?? [];
    const deck = row.deckId != null ? decks.find((d) => d.id === row.deckId) : null;

    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Workspace
          </p>
          <p className="font-medium text-foreground">{row.workspaceName}</p>
          <p className="text-sm text-muted-foreground">
            {decks.length} linked deck{decks.length === 1 ? "" : "s"}
            {" · "}
            Workspace default {fallback} minutes
            {committedEnforceDefault ? " (locked)" : ""}
          </p>
        </div>

        {!perDeckEditingEnabled ? (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-muted-foreground">
              The subscriber has locked one quiz time ({committedGlobalMinutes} minutes) for all
              decks linked to each workspace. Per-deck times are disabled.
            </p>
            {deck ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/10 px-3 py-2.5">
                <span className="min-w-0 truncate text-sm font-medium text-foreground">
                  {deck.name}
                </span>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {committedGlobalMinutes} min
                </span>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border/80 bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">
                No decks linked to this workspace yet.
              </p>
            )}
          </div>
        ) : !deck ? (
          <p className="rounded-lg border border-dashed border-border/80 bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">
            No decks linked to this workspace yet.
          </p>
        ) : (
          <DeckTimerEditor
            deck={deck}
            fallbackMinutes={fallback}
            minutes={draftMinutesForDeck(deck.id, row.teamId)}
            dirty={isDeckDirty(deck.id, row.teamId)}
            hasCustom={(committedDeckMinutes[deck.id] ?? null) != null}
            customMinutes={committedDeckMinutes[deck.id] ?? null}
            saving={busyDeckId === deck.id}
            error={deckErrorById[deck.id]}
            saved={Boolean(savedDeckIds[deck.id])}
            onDurationChange={(nextMinutes) => {
              setDraftMinutesByDeckId((prev) => ({
                ...prev,
                [deck.id]: nextMinutes,
              }));
              setSavedDeckIds((prev) => {
                const copy = { ...prev };
                delete copy[deck.id];
                return copy;
              });
            }}
            onSave={() => void onSaveDeck(row.teamId, deck.id)}
            onReset={() => void onResetDeckToWorkspaceDefault(row.teamId, deck.id)}
          />
        )}
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border/80 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
        No workspaces available for quiz timer settings.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {isSubscriberOwner ? (
        <section className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">
              General quiz time for linked decks
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Set the general timed-quiz length for decks linked to every workspace you own (
              {ownedWorkspaceCount} total). Saving applies this minute limit to those decks. Factory
              default is {DEFAULT_TEAM_QUIZ_DURATION_MINUTES} minutes. Only you can change these
              settings.
            </p>
          </div>

          {globalError ? (
            <p
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {globalError}
            </p>
          ) : null}
          {globalSaved ? (
            <p className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-foreground">
              {enforceDefault
                ? "General quiz time applied to all decks linked to each workspace. Per-deck times are disabled."
                : "General quiz time updated on linked decks. You can still set a custom time per deck below."}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/15 px-4 py-3">
            <div className="min-w-0 space-y-0.5">
              <Label
                htmlFor="quiz-enforce-default"
                className="text-sm font-medium text-foreground"
              >
                Use one quiz time for all decks linked to each workspace
              </Label>
              <p className="text-xs text-muted-foreground">
                When on, every linked deck uses the general minutes below and per-deck timers are
                disabled. When off, owners and team admins can set a different quiz time per deck.
              </p>
            </div>
            <Switch
              id="quiz-enforce-default"
              checked={enforceDefault}
              onCheckedChange={(checked) => {
                setEnforceDefault(checked);
                setGlobalSaved(false);
              }}
            />
          </div>

          <PresetSelect
            idPrefix="quiz-global"
            durationMinutes={globalMinutes}
            onDurationChange={(minutes) => {
              setGlobalMinutes(minutes);
              setGlobalSaved(false);
            }}
          />

          <Button
            type="button"
            className="h-10 w-full sm:w-auto"
            disabled={!globalDirty || globalBusy}
            onClick={() => void onSaveGlobal()}
          >
            <Clock className="mr-2 size-4" aria-hidden />
            {globalBusy ? "Saving…" : "Save general quiz time for linked decks"}
          </Button>

          <Separator />
        </section>
      ) : null}

      <section className="space-y-6">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">Deck quiz timers</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {committedEnforceDefault
              ? "All decks linked to each workspace currently share the subscriber’s general quiz time. Click a row to review that deck."
              : isSubscriberOwner
                ? "Every linked deck is listed below. Click a row to set a timed-quiz length for that deck."
                : "Every linked deck in workspaces you manage is listed below. Click a row to set a timed-quiz length when allowed."}
          </p>
        </div>

        <TeamAdminRecordSlider
          items={rows}
          activeKey={activeRowKey}
          onActivate={onDeckRowActivate}
          layout="table"
          tableGroupByMember
          tablePageSize={10}
          tableRowNoun={{ singular: "deck", plural: "decks" }}
          tableGroupNoun={{ singular: "workspace", plural: "workspaces" }}
          tableColumns={[
            {
              id: "member",
              header: "Workspace",
              className: "min-w-[8rem]",
              cell: (row) => (
                <span className="text-sm font-medium text-foreground">
                  {row.workspaceName}
                </span>
              ),
            },
            {
              id: "deck",
              header: "Deck",
              className: "min-w-[10rem]",
              cell: (row) => (
                <span className="text-sm text-foreground">{row.deckName}</span>
              ),
            },
            {
              id: "timer",
              header: "Timer",
              className: "min-w-[10rem]",
              cell: (row) => (
                <span className="text-sm text-muted-foreground">
                  {timerStatusLabel({
                    enforceDefault: committedEnforceDefault,
                    globalMinutes: committedGlobalMinutes,
                    fallbackMinutes: workspaceFallbackMinutes(row.teamId),
                    customMinutes:
                      row.deckId != null
                        ? (committedDeckMinutes[row.deckId] ?? null)
                        : null,
                    hasDeck: row.deckId != null,
                  })}
                </span>
              ),
            },
          ]}
          searchLabel="Search workspace or deck"
          searchPlaceholder="Workspace or deck name…"
          allowedSortOptions={["member_az", "member_za", "deck_az", "deck_za"]}
          sortLabelMap={{
            member_az: "Workspace (A–Z)",
            member_za: "Workspace (Z–A)",
            deck_az: "Deck (A–Z)",
            deck_za: "Deck (Z–A)",
          }}
          deckFilterOptions={[
            ...new Set(rows.map((row) => row.deckName).filter((name) => name !== "—")),
          ].sort((a, b) => a.localeCompare(b))}
          getSearchHaystack={(row) => `${row.workspaceName} ${row.deckName}`}
          emptyMessage="No decks linked for quiz timer settings."
          noResultsMessage="No decks match your search or filters."
          renderBelowActive={(row) =>
            activeRowKey === row.key ? renderOpenPanel(row) : null
          }
        />
      </section>
    </div>
  );
}
