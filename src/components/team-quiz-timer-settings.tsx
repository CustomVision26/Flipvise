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
const PLACEHOLDER_WORKSPACE = "Choose a team workspace…";

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

type QuizTimerWorkspaceRow = QuizTimerWorkspaceSnapshot & {
  key: string;
  memberLabel: string;
  deckName: string;
};

function workspaceStatusLabel(
  row: QuizTimerWorkspaceSnapshot,
  globalDefaultMinutes: number,
  enforceDefaultForAllWorkspaces: boolean,
  deckCount: number,
): string {
  const deckBit = `${deckCount} deck${deckCount === 1 ? "" : "s"}`;
  if (enforceDefaultForAllWorkspaces) {
    return `${deckBit} · Default · ${globalDefaultMinutes} min`;
  }
  if (row.workspaceOverrideMinutes != null) {
    return `${deckBit} · Custom · ${row.effectiveMinutes} min`;
  }
  return `${deckBit} · Default · ${globalDefaultMinutes} min`;
}

function buildWorkspaceRows(
  workspaces: QuizTimerWorkspaceSnapshot[],
  decksByWorkspaceId: Record<number, QuizTimerDeckSnapshot[]>,
  globalDefaultMinutes: number,
  enforceDefaultForAllWorkspaces: boolean,
): QuizTimerWorkspaceRow[] {
  return workspaces.map((workspace) => ({
    ...workspace,
    key: String(workspace.id),
    memberLabel: workspace.name,
    deckName: workspaceStatusLabel(
      workspace,
      globalDefaultMinutes,
      enforceDefaultForAllWorkspaces,
      decksByWorkspaceId[workspace.id]?.length ?? 0,
    ),
  }));
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
  defaultWorkspaceId,
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
  const [workspaceId, setWorkspaceId] = React.useState(String(defaultWorkspaceId));
  const [workspaceLocked, setWorkspaceLocked] = React.useState(false);
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
    if (!workspaceLocked) {
      setWorkspaceId(String(defaultWorkspaceId));
    }
  }, [
    globalDefaultMinutes,
    enforceDefaultProp,
    decksByWorkspaceId,
    workspaces,
    defaultWorkspaceId,
    workspaceLocked,
  ]);

  const rows = React.useMemo(
    () =>
      buildWorkspaceRows(
        workspaces,
        decksByWorkspaceId,
        committedGlobalMinutes,
        committedEnforceDefault,
      ),
    [workspaces, decksByWorkspaceId, committedGlobalMinutes, committedEnforceDefault],
  );

  const workspace = workspaces.find((w) => w.id === Number(workspaceId));
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

  function onWorkspaceRowDoubleClick(row: QuizTimerWorkspaceRow) {
    setWorkspaceId(String(row.id));
    setWorkspaceLocked(true);
    setActiveRowKey(row.key);
  }

  function unlockWorkspaceField() {
    setWorkspaceLocked(false);
    setActiveRowKey(null);
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

  function renderDeckTimers(row: QuizTimerWorkspaceRow) {
    const decks = decksByWorkspaceId[row.id] ?? [];
    const fallback = workspaceFallbackMinutes(row.id);

    if (!perDeckEditingEnabled) {
      return (
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-muted-foreground">
            The subscriber has locked one quiz time ({committedGlobalMinutes} minutes) for all
            decks linked to each workspace. Per-deck times are disabled.
          </p>
          {decks.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/80 bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">
              No decks linked to this workspace yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {decks.map((deck) => (
                <li
                  key={deck.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/10 px-3 py-2.5"
                >
                  <span className="min-w-0 truncate text-sm font-medium text-foreground">
                    {deck.name}
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                    {committedGlobalMinutes} min
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }

    if (decks.length === 0) {
      return (
        <p className="rounded-lg border border-dashed border-border/80 bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">
          No decks linked to this workspace yet.
        </p>
      );
    }

    return (
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Set timed-quiz minutes for each deck. Matching the workspace default ({fallback} min)
          clears a custom override.
        </p>
        {decks.map((deck) => {
          const minutes = draftMinutesForDeck(deck.id, row.id);
          const dirty = isDeckDirty(deck.id, row.id);
          const hasCustom = (committedDeckMinutes[deck.id] ?? null) != null;
          const saving = busyDeckId === deck.id;
          const error = deckErrorById[deck.id];
          const saved = savedDeckIds[deck.id];

          return (
            <div
              key={deck.id}
              className="space-y-3 rounded-lg border border-border/80 bg-muted/15 p-4"
            >
              <div className="space-y-0.5">
                <p className="font-medium text-foreground">{deck.name}</p>
                <p className="text-xs text-muted-foreground">
                  {hasCustom
                    ? `Custom · ${committedDeckMinutes[deck.id]} min`
                    : `Using workspace default · ${fallback} min`}
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
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-9"
                  disabled={!dirty || saving}
                  onClick={() => void onSaveDeck(row.id, deck.id)}
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
                    onClick={() => void onResetDeckToWorkspaceDefault(row.id, deck.id)}
                  >
                    Use workspace default
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
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
              ? "All decks linked to each workspace currently share the subscriber’s general quiz time."
              : isSubscriberOwner
                ? "Browse each workspace and set a timed-quiz length for individual decks."
                : "Browse workspaces you manage and set a timed-quiz length for individual decks when allowed."}
          </p>
        </div>

        <TeamAdminRecordSlider
          items={rows}
          activeKey={activeRowKey ?? workspaceId}
          interactiveCard
          onDoubleClick={onWorkspaceRowDoubleClick}
          searchLabel="Search workspace"
          searchPlaceholder="Workspace name…"
          allowedSortOptions={["member_az", "member_za"]}
          sortLabelMap={{
            member_az: "Workspace (A–Z)",
            member_za: "Workspace (Z–A)",
          }}
          getSearchHaystack={(row) => row.memberLabel}
          filterPanelExtraActive={workspaceLocked}
          filterPanelExtra={({ filtersOpen }) => (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label
                  htmlFor="quiz-timer-workspace"
                  className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
                >
                  Team workspace
                </Label>
                {workspaceLocked ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground"
                    onClick={unlockWorkspaceField}
                  >
                    Change workspace
                  </Button>
                ) : null}
              </div>
              <Select
                value={workspaceId}
                disabled={workspaceLocked || !filtersOpen}
                onValueChange={(v) => {
                  if (workspaceLocked || v == null) return;
                  setWorkspaceId(v);
                  setActiveRowKey(v);
                }}
              >
                <SelectTrigger
                  id="quiz-timer-workspace"
                  className="h-10 w-full bg-background disabled:cursor-default disabled:opacity-100"
                >
                  <SelectValue placeholder={PLACEHOLDER_WORKSPACE}>
                    {workspace?.name ?? PLACEHOLDER_WORKSPACE}
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
              {workspaceLocked && workspace ? (
                <p className="text-xs text-muted-foreground">
                  Set from the selected workspace record. Double-click another record to switch
                  workspace.
                </p>
              ) : null}
            </div>
          )}
          emptyMessage="No workspaces available for quiz timer settings."
          noResultsMessage="No workspaces match your search."
          renderCard={(row) => {
            const decks = decksByWorkspaceId[row.id] ?? [];
            const fallback = workspaceFallbackMinutes(row.id);

            return (
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Workspace
                  </p>
                  <p className="font-medium text-foreground">{row.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {decks.length} linked deck{decks.length === 1 ? "" : "s"}
                    {" · "}
                    Workspace default {fallback} minutes
                    {committedEnforceDefault ? " (locked)" : ""}
                  </p>
                </div>

                {renderDeckTimers(row)}
              </div>
            );
          }}
        />
      </section>
    </div>
  );
}
