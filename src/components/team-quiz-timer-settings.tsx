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
  updateTeamQuizDurationAction,
} from "@/actions/teams";
import {
  DEFAULT_TEAM_QUIZ_DURATION_MINUTES,
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
): string {
  if (enforceDefaultForAllWorkspaces) {
    return `Default · ${globalDefaultMinutes} min`;
  }
  if (row.workspaceOverrideMinutes != null) {
    return `Custom · ${row.effectiveMinutes} min`;
  }
  return `Default · ${globalDefaultMinutes} min`;
}

function buildWorkspaceRows(
  workspaces: QuizTimerWorkspaceSnapshot[],
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
    ),
  }));
}

function buildWorkspaceDrafts(
  workspaces: QuizTimerWorkspaceSnapshot[],
  globalDefaultMinutes: number,
): Record<number, number> {
  const drafts: Record<number, number> = {};
  for (const workspace of workspaces) {
    drafts[workspace.id] =
      workspace.workspaceOverrideMinutes ?? globalDefaultMinutes;
  }
  return drafts;
}

function normalizeWorkspaceList(
  workspaces: QuizTimerWorkspaceSnapshot[] | null | undefined,
): QuizTimerWorkspaceSnapshot[] {
  if (Array.isArray(workspaces)) return workspaces;
  return [];
}

function buildCommittedOverrides(
  workspaces: QuizTimerWorkspaceSnapshot[],
): Record<number, number | null> {
  const committed: Record<number, number | null> = {};
  for (const workspace of normalizeWorkspaceList(workspaces)) {
    committed[workspace.id] = workspace.workspaceOverrideMinutes;
  }
  return committed;
}

function workspaceSaveValue(
  minutes: number,
  globalDefaultMinutes: number,
): number | null {
  return minutes === globalDefaultMinutes ? null : minutes;
}

export type TeamQuizTimerSettingsProps = {
  workspaces?: QuizTimerWorkspaceSnapshot[];
  defaultWorkspaceId: number;
  isSubscriberOwner: boolean;
  ownedWorkspaceCount: number;
  globalDefaultMinutes: number;
  enforceDefaultForAllWorkspaces: boolean;
};

export function TeamQuizTimerSettings({
  workspaces: workspacesProp = [],
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

  const [committedGlobalMinutes, setCommittedGlobalMinutes] =
    React.useState(globalDefaultMinutes);
  const [committedEnforceDefault, setCommittedEnforceDefault] = React.useState(
    enforceDefaultProp,
  );
  const [globalMinutes, setGlobalMinutes] = React.useState(globalDefaultMinutes);
  const [enforceDefault, setEnforceDefault] = React.useState(enforceDefaultProp);
  const [committedOverrides, setCommittedOverrides] = React.useState(() =>
    buildCommittedOverrides(normalizeWorkspaceList(workspacesProp)),
  );
  const [draftMinutesByTeamId, setDraftMinutesByTeamId] = React.useState(() =>
    buildWorkspaceDrafts(normalizeWorkspaceList(workspacesProp), globalDefaultMinutes),
  );
  const [workspaceId, setWorkspaceId] = React.useState(String(defaultWorkspaceId));
  const [workspaceLocked, setWorkspaceLocked] = React.useState(false);
  const [activeRowKey, setActiveRowKey] = React.useState<string | null>(null);
  const [globalBusy, setGlobalBusy] = React.useState(false);
  const [busyTeamId, setBusyTeamId] = React.useState<number | null>(null);
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [workspaceErrorByTeamId, setWorkspaceErrorByTeamId] = React.useState<
    Record<number, string>
  >({});
  const [globalSaved, setGlobalSaved] = React.useState(false);
  const [savedTeamIds, setSavedTeamIds] = React.useState<Record<number, true>>({});

  React.useEffect(() => {
    setCommittedGlobalMinutes(globalDefaultMinutes);
    setCommittedEnforceDefault(enforceDefaultProp);
    setGlobalMinutes(globalDefaultMinutes);
    setEnforceDefault(enforceDefaultProp);
    setCommittedOverrides(buildCommittedOverrides(workspaces));
    setDraftMinutesByTeamId(buildWorkspaceDrafts(workspaces, globalDefaultMinutes));
    if (!workspaceLocked) {
      setWorkspaceId(String(defaultWorkspaceId));
    }
  }, [
    globalDefaultMinutes,
    enforceDefaultProp,
    workspaces,
    defaultWorkspaceId,
    workspaceLocked,
  ]);

  const rows = React.useMemo(
    () => buildWorkspaceRows(workspaces, committedGlobalMinutes, committedEnforceDefault),
    [workspaces, committedGlobalMinutes, committedEnforceDefault],
  );

  const workspace = workspaces.find((w) => w.id === Number(workspaceId));
  const globalDirty =
    globalMinutes !== committedGlobalMinutes ||
    enforceDefault !== committedEnforceDefault;
  const perWorkspaceEditingEnabled = !committedEnforceDefault;

  function draftMinutesForTeam(teamId: number): number {
    return draftMinutesByTeamId[teamId] ?? committedGlobalMinutes;
  }

  function isWorkspaceDirty(teamId: number): boolean {
    const committed = committedOverrides[teamId] ?? null;
    const nextSave = workspaceSaveValue(
      draftMinutesForTeam(teamId),
      committedGlobalMinutes,
    );
    return nextSave !== committed;
  }

  function onWorkspaceRowDoubleClick(row: QuizTimerWorkspaceRow) {
    setWorkspaceId(String(row.id));
    setWorkspaceLocked(true);
    setActiveRowKey(row.key);
    setWorkspaceErrorByTeamId((prev) => {
      const copy = { ...prev };
      delete copy[row.id];
      return copy;
    });
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
      if (enforceDefault) {
        setCommittedOverrides((prev) => {
          const next = { ...prev };
          for (const workspace of workspaces) {
            next[workspace.id] = null;
          }
          return next;
        });
        setDraftMinutesByTeamId((prev) => {
          const next = { ...prev };
          for (const workspace of workspaces) {
            next[workspace.id] = globalMinutes;
          }
          return next;
        });
      } else {
        setDraftMinutesByTeamId((prev) => {
          const next = { ...prev };
          for (const workspace of workspaces) {
            if (committedOverrides[workspace.id] == null) {
              next[workspace.id] = globalMinutes;
            }
          }
          return next;
        });
      }
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : "Could not save default quiz timer.");
    } finally {
      setGlobalBusy(false);
    }
  }

  async function onResetWorkspaceToDefault(teamId: number) {
    setWorkspaceErrorByTeamId((prev) => {
      const copy = { ...prev };
      delete copy[teamId];
      return copy;
    });
    setSavedTeamIds((prev) => {
      const copy = { ...prev };
      delete copy[teamId];
      return copy;
    });
    setBusyTeamId(teamId);
    try {
      await updateTeamQuizDurationAction({ teamId, durationMinutes: null });
      setCommittedOverrides((prev) => ({ ...prev, [teamId]: null }));
      setDraftMinutesByTeamId((prev) => ({
        ...prev,
        [teamId]: committedGlobalMinutes,
      }));
      setSavedTeamIds((prev) => ({ ...prev, [teamId]: true }));
    } catch (e) {
      setWorkspaceErrorByTeamId((prev) => ({
        ...prev,
        [teamId]:
          e instanceof Error ? e.message : "Could not reset workspace quiz timer.",
      }));
    } finally {
      setBusyTeamId(null);
    }
  }

  async function onSaveWorkspace(teamId: number) {
    const minutes = draftMinutesForTeam(teamId);
    const durationMinutes = workspaceSaveValue(minutes, committedGlobalMinutes);
    setWorkspaceErrorByTeamId((prev) => {
      const copy = { ...prev };
      delete copy[teamId];
      return copy;
    });
    setSavedTeamIds((prev) => {
      const copy = { ...prev };
      delete copy[teamId];
      return copy;
    });
    setBusyTeamId(teamId);
    try {
      await updateTeamQuizDurationAction({ teamId, durationMinutes });
      setCommittedOverrides((prev) => ({
        ...prev,
        [teamId]: durationMinutes,
      }));
      setSavedTeamIds((prev) => ({ ...prev, [teamId]: true }));
    } catch (e) {
      setWorkspaceErrorByTeamId((prev) => ({
        ...prev,
        [teamId]:
          e instanceof Error ? e.message : "Could not save workspace quiz timer.",
      }));
    } finally {
      setBusyTeamId(null);
    }
  }

  function renderWorkspaceControls(row: QuizTimerWorkspaceRow) {
    const minutes = draftMinutesForTeam(row.id);
    const dirty = isWorkspaceDirty(row.id);
    const error = workspaceErrorByTeamId[row.id];
    const saved = savedTeamIds[row.id];
    const hasCustomOverride = (committedOverrides[row.id] ?? null) != null;

    if (!perWorkspaceEditingEnabled) {
      return (
        <p className="text-sm leading-relaxed text-muted-foreground">
          The subscriber has locked one quiz time ({committedGlobalMinutes} minutes) for all
          workspaces. Per-workspace times are disabled.
        </p>
      );
    }

    return (
      <>
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
            Workspace quiz timer updated.
          </p>
        ) : null}

        <PresetSelect
          idPrefix={`quiz-workspace-${row.id}`}
          durationMinutes={minutes}
          onDurationChange={(nextMinutes) => {
            setDraftMinutesByTeamId((prev) => ({
              ...prev,
              [row.id]: nextMinutes,
            }));
            setSavedTeamIds((prev) => {
              const copy = { ...prev };
              delete copy[row.id];
              return copy;
            });
          }}
        />

        <p className="text-sm leading-relaxed text-muted-foreground">
          Choose a preset for this workspace. Matching the subscriber default ({committedGlobalMinutes}{" "}
          min) uses the shared default instead of a custom override.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="h-10 w-full sm:w-auto"
            disabled={!dirty || busyTeamId === row.id}
            onClick={() => void onSaveWorkspace(row.id)}
          >
            <Clock className="mr-2 size-4" aria-hidden />
            {busyTeamId === row.id ? "Saving…" : "Save workspace quiz timer"}
          </Button>
          {hasCustomOverride ? (
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full sm:w-auto"
              disabled={busyTeamId === row.id}
              onClick={() => void onResetWorkspaceToDefault(row.id)}
            >
              Use subscriber default
            </Button>
          ) : null}
        </div>
      </>
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
            <h3 className="text-sm font-semibold text-foreground">Default for all workspaces</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Set the quiz time for every workspace you own ({ownedWorkspaceCount} total). Factory
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
                ? "Default quiz timer applied to all workspaces. Per-workspace times are disabled."
                : "Default quiz timer updated. Team admins may set custom times per workspace."}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/15 px-4 py-3">
            <div className="min-w-0 space-y-0.5">
              <Label
                htmlFor="quiz-enforce-default"
                className="text-sm font-medium text-foreground"
              >
                Use one quiz time for all workspaces
              </Label>
              <p className="text-xs text-muted-foreground">
                When on, every workspace uses the default below and individual workspace times are
                disabled. When off, team admins can set a custom preset per workspace.
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
            {globalBusy ? "Saving…" : "Save default for all workspaces"}
          </Button>

          <Separator />
        </section>
      ) : null}

      <section className="space-y-6">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">Workspace quiz timers</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {committedEnforceDefault
              ? "All workspaces currently share the subscriber default quiz time."
              : isSubscriberOwner
                ? "Browse every workspace you own and set a custom quiz preset where needed."
                : "Browse workspaces you manage and set a custom quiz preset where allowed."}
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
            const minutes = draftMinutesForTeam(row.id);
            const effectiveMinutes = committedEnforceDefault
              ? committedGlobalMinutes
              : minutes;

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Workspace
                    </p>
                    <p className="font-medium text-foreground">{row.name}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Active quiz time
                    </p>
                    <p className="text-sm text-foreground">{effectiveMinutes} minutes</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Source
                    </p>
                    <p className="text-sm text-foreground">
                      {committedEnforceDefault
                        ? "Subscriber default (locked)"
                        : (committedOverrides[row.id] ?? null) != null
                          ? "Custom override"
                          : "Subscriber default"}
                    </p>
                  </div>
                </div>
                {renderWorkspaceControls(row)}
              </div>
            );
          }}
        />
      </section>
    </div>
  );
}
