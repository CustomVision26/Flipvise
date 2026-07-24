"use client";

import * as React from "react";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  updateDeckQuizSecurityAction,
  updateTeamQuizSecurityAction,
} from "@/actions/quiz-security";
import type {
  QuizSecurityDeckSnapshot,
  QuizSecurityWorkspaceSnapshot,
} from "@/db/queries/quiz-security";
import {
  nextDeckQuizSecurityAudienceExplicit,
  nextDeckQuizSecurityExplicit,
  resolveQuizSecurityAudience,
  resolveQuizSecurityEnabled,
} from "@/lib/quiz-security-resolve";
import { cn } from "@/lib/utils";

const PLACEHOLDER_WORKSPACE = "Choose a team workspace…";

type AudienceState = {
  applyToMembers: boolean;
  applyToTeamAdmins: boolean;
};

type DeckAudienceStored = {
  applyToMembers: boolean | null;
  applyToTeamAdmins: boolean | null;
};

type TeamQuizSecuritySettingsProps = {
  workspaces: QuizSecurityWorkspaceSnapshot[];
  decksByWorkspaceId: Record<number, QuizSecurityDeckSnapshot[]>;
  defaultWorkspaceId: number;
};

function SecurityAudienceCheckboxes({
  idPrefix,
  value,
  disabled,
  onChange,
}: {
  idPrefix: string;
  value: AudienceState;
  disabled?: boolean;
  onChange: (next: AudienceState) => void;
}) {
  return (
    <div className="space-y-2 pt-1">
      <p className="text-xs font-medium text-muted-foreground">
        Apply security to
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Plan owner is always restricted when security is on.
      </p>
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${idPrefix}-team-admin`}
            checked={value.applyToTeamAdmins}
            disabled={disabled}
            onCheckedChange={(checked) =>
              onChange({
                ...value,
                applyToTeamAdmins: checked === true,
              })
            }
          />
          <Label
            htmlFor={`${idPrefix}-team-admin`}
            className="text-sm font-normal text-foreground"
          >
            Team Admin
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${idPrefix}-member`}
            checked={value.applyToMembers}
            disabled={disabled}
            onCheckedChange={(checked) =>
              onChange({
                ...value,
                applyToMembers: checked === true,
              })
            }
          />
          <Label
            htmlFor={`${idPrefix}-member`}
            className="text-sm font-normal text-foreground"
          >
            Member
          </Label>
        </div>
      </div>
    </div>
  );
}

export function TeamQuizSecuritySettings({
  workspaces,
  decksByWorkspaceId,
  defaultWorkspaceId,
}: TeamQuizSecuritySettingsProps) {
  const [selectedId, setSelectedId] = React.useState(defaultWorkspaceId);
  const [workspaceEnabledById, setWorkspaceEnabledById] = React.useState<Record<number, boolean>>(
    () => Object.fromEntries(workspaces.map((w) => [w.id, w.quizSecurityEnabled])),
  );
  const [workspaceAudienceById, setWorkspaceAudienceById] = React.useState<
    Record<number, AudienceState>
  >(() =>
    Object.fromEntries(
      workspaces.map((w) => [
        w.id,
        {
          applyToMembers: w.quizSecurityApplyToMembers,
          applyToTeamAdmins: w.quizSecurityApplyToTeamAdmins,
        },
      ]),
    ),
  );
  const [deckEnabledById, setDeckEnabledById] = React.useState<
    Record<number, boolean | null>
  >({});
  const [deckAudienceById, setDeckAudienceById] = React.useState<
    Record<number, DeckAudienceStored>
  >({});
  const [workspaceSaving, setWorkspaceSaving] = React.useState(false);
  const [deckSavingId, setDeckSavingId] = React.useState<number | null>(null);
  const [workspaceError, setWorkspaceError] = React.useState<string | null>(null);
  const [deckErrorById, setDeckErrorById] = React.useState<Record<number, string>>({});

  const decks = React.useMemo(
    () => decksByWorkspaceId[selectedId] ?? [],
    [decksByWorkspaceId, selectedId],
  );

  React.useEffect(() => {
    setSelectedId(defaultWorkspaceId);
  }, [defaultWorkspaceId]);

  React.useEffect(() => {
    setWorkspaceEnabledById(
      Object.fromEntries(workspaces.map((w) => [w.id, w.quizSecurityEnabled])),
    );
    setWorkspaceAudienceById(
      Object.fromEntries(
        workspaces.map((w) => [
          w.id,
          {
            applyToMembers: w.quizSecurityApplyToMembers,
            applyToTeamAdmins: w.quizSecurityApplyToTeamAdmins,
          },
        ]),
      ),
    );
  }, [workspaces]);

  React.useEffect(() => {
    setDeckEnabledById((prev) => {
      const next = { ...prev };
      for (const deck of decks) {
        next[deck.id] = deck.quizSecurityEnabled;
      }
      return next;
    });
    setDeckAudienceById((prev) => {
      const next = { ...prev };
      for (const deck of decks) {
        next[deck.id] = {
          applyToMembers: deck.quizSecurityApplyToMembers,
          applyToTeamAdmins: deck.quizSecurityApplyToTeamAdmins,
        };
      }
      return next;
    });
  }, [decks]);

  const selected =
    workspaces.find((w) => w.id === selectedId) ?? workspaces[0] ?? null;
  const workspaceEnabled = selected ? Boolean(workspaceEnabledById[selected.id]) : false;
  const workspaceAudience: AudienceState = selected
    ? (workspaceAudienceById[selected.id] ?? {
        applyToMembers: true,
        applyToTeamAdmins: false,
      })
    : { applyToMembers: true, applyToTeamAdmins: false };

  async function persistWorkspaceSettings(
    enabled: boolean,
    audience: AudienceState,
  ) {
    if (!selected) return;
    const previousEnabled = workspaceEnabledById[selected.id];
    const previousAudience = workspaceAudienceById[selected.id];

    setWorkspaceError(null);
    setWorkspaceEnabledById((prev) => ({ ...prev, [selected.id]: enabled }));
    setWorkspaceAudienceById((prev) => ({ ...prev, [selected.id]: audience }));
    setWorkspaceSaving(true);
    try {
      await updateTeamQuizSecurityAction({
        teamId: selected.id,
        enabled,
        applyToMembers: audience.applyToMembers,
        applyToTeamAdmins: audience.applyToTeamAdmins,
      });
    } catch (e) {
      setWorkspaceEnabledById((prev) => ({
        ...prev,
        [selected.id]: previousEnabled,
      }));
      if (previousAudience) {
        setWorkspaceAudienceById((prev) => ({
          ...prev,
          [selected.id]: previousAudience,
        }));
      }
      setWorkspaceError(e instanceof Error ? e.message : "Could not update quiz security.");
    } finally {
      setWorkspaceSaving(false);
    }
  }

  async function handleWorkspaceToggle(checked: boolean) {
    await persistWorkspaceSettings(checked, workspaceAudience);
  }

  async function handleWorkspaceAudienceChange(audience: AudienceState) {
    await persistWorkspaceSettings(workspaceEnabled, audience);
  }

  async function persistDeckSettings(
    deckId: number,
    enabledExplicit: boolean | null,
    audienceStored: DeckAudienceStored,
  ) {
    if (!selected) return;
    const previousEnabled = deckEnabledById[deckId] ?? null;
    const previousAudience = deckAudienceById[deckId] ?? {
      applyToMembers: null,
      applyToTeamAdmins: null,
    };

    setDeckErrorById((prev) => {
      const copy = { ...prev };
      delete copy[deckId];
      return copy;
    });
    setDeckEnabledById((prev) => ({ ...prev, [deckId]: enabledExplicit }));
    setDeckAudienceById((prev) => ({ ...prev, [deckId]: audienceStored }));
    setDeckSavingId(deckId);

    try {
      await updateDeckQuizSecurityAction({
        teamId: selected.id,
        deckId,
        enabled: enabledExplicit,
        applyToMembers: audienceStored.applyToMembers,
        applyToTeamAdmins: audienceStored.applyToTeamAdmins,
      });
    } catch (e) {
      setDeckEnabledById((prev) => ({ ...prev, [deckId]: previousEnabled }));
      setDeckAudienceById((prev) => ({ ...prev, [deckId]: previousAudience }));
      setDeckErrorById((prev) => ({
        ...prev,
        [deckId]: e instanceof Error ? e.message : "Could not update deck quiz security.",
      }));
    } finally {
      setDeckSavingId(null);
    }
  }

  async function handleDeckToggle(deckId: number, checked: boolean) {
    const nextExplicit = nextDeckQuizSecurityExplicit(workspaceEnabled, checked);
    const storedAudience = deckAudienceById[deckId] ?? {
      applyToMembers: null,
      applyToTeamAdmins: null,
    };
    await persistDeckSettings(deckId, nextExplicit, storedAudience);
  }

  async function handleDeckAudienceChange(deckId: number, audience: AudienceState) {
    const enabledExplicit = deckEnabledById[deckId] ?? null;
    const audienceStored = nextDeckQuizSecurityAudienceExplicit(
      workspaceAudience,
      audience,
    );
    await persistDeckSettings(deckId, enabledExplicit, audienceStored);
  }

  async function resetDeckToWorkspaceDefault(deckId: number) {
    await persistDeckSettings(deckId, null, {
      applyToMembers: null,
      applyToTeamAdmins: null,
    });
  }

  if (workspaces.length === 0) return null;

  return (
    <div className="space-y-8">
      <section className="space-y-5">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">Workspace security</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Turn quiz security on or off for every deck in the selected workspace unless a deck has
            its own setting.
          </p>
        </div>

        <div className="max-w-md space-y-1.5">
          <Label
            htmlFor="quiz-security-workspace"
            className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
          >
            Workspace
          </Label>
          <Select
            value={String(selectedId)}
            onValueChange={(v) => {
              if (v != null) setSelectedId(Number(v));
            }}
          >
            <SelectTrigger id="quiz-security-workspace" className="h-10 w-full bg-background">
              <SelectValue placeholder={PLACEHOLDER_WORKSPACE}>
                {selected?.name ?? PLACEHOLDER_WORKSPACE}
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

        {selected ? (
          <div className="flex items-start justify-between gap-4 rounded-lg border border-border/80 bg-muted/15 p-4">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <Shield className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <p className="font-medium text-foreground">{selected.name}</p>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                When on, selected roles cannot leave the quiz UI until they submit. Leaving locks
                the session until you grant access or terminate it.
              </p>
              <p
                className={cn(
                  "text-xs font-medium",
                  workspaceEnabled ? "text-emerald-400" : "text-muted-foreground",
                )}
              >
                {workspaceEnabled ? "Enabled for this workspace" : "Disabled for this workspace"}
              </p>
              {workspaceEnabled ? (
                <SecurityAudienceCheckboxes
                  idPrefix={`workspace-${selected.id}`}
                  value={workspaceAudience}
                  disabled={workspaceSaving}
                  onChange={(audience) => void handleWorkspaceAudienceChange(audience)}
                />
              ) : null}
            </div>
            <Switch
              id={`quiz-security-${selected.id}`}
              checked={workspaceEnabled}
              disabled={workspaceSaving}
              onCheckedChange={handleWorkspaceToggle}
              aria-label={`Quiz security for ${selected.name}`}
            />
          </div>
        ) : null}

        {workspaceError ? (
          <p className="text-sm text-destructive" role="alert">
            {workspaceError}
          </p>
        ) : null}
      </section>

      <Separator />

      <section className="space-y-5">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">Deck security</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Set quiz security for individual decks in{" "}
            <span className="font-medium text-foreground">{selected?.name ?? "this workspace"}</span>
            . Decks without a custom setting use the workspace default above.
          </p>
        </div>

        {decks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/80 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
            No decks linked to this workspace yet.
          </p>
        ) : (
          <div className="space-y-3">
            {decks.map((deck) => {
              const explicit = deckEnabledById[deck.id] ?? deck.quizSecurityEnabled ?? null;
              const effective = resolveQuizSecurityEnabled(
                { quizSecurityEnabled: explicit },
                { quizSecurityEnabled: workspaceEnabled },
              );
              const storedAudience = deckAudienceById[deck.id] ?? {
                applyToMembers: deck.quizSecurityApplyToMembers,
                applyToTeamAdmins: deck.quizSecurityApplyToTeamAdmins,
              };
              const effectiveAudience = resolveQuizSecurityAudience(
                {
                  quizSecurityApplyToMembers: storedAudience.applyToMembers,
                  quizSecurityApplyToTeamAdmins: storedAudience.applyToTeamAdmins,
                },
                {
                  quizSecurityApplyToMembers: workspaceAudience.applyToMembers,
                  quizSecurityApplyToTeamAdmins: workspaceAudience.applyToTeamAdmins,
                },
              );
              const usesWorkspaceDefault =
                explicit === null &&
                storedAudience.applyToMembers === null &&
                storedAudience.applyToTeamAdmins === null;
              const saving = deckSavingId === deck.id;
              const deckError = deckErrorById[deck.id];

              return (
                <div
                  key={deck.id}
                  className="flex items-start justify-between gap-4 rounded-lg border border-border/80 bg-muted/15 p-4"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-medium text-foreground">{deck.name}</p>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {usesWorkspaceDefault
                        ? `Using workspace default (${workspaceEnabled ? "on" : "off"}).`
                        : "Custom security setting for this deck."}
                    </p>
                    <p
                      className={cn(
                        "text-xs font-medium",
                        effective ? "text-emerald-400" : "text-muted-foreground",
                      )}
                    >
                      {effective ? "Secured" : "Not secured"}
                    </p>
                    {effective ? (
                      <SecurityAudienceCheckboxes
                        idPrefix={`deck-${deck.id}`}
                        value={effectiveAudience}
                        disabled={saving || workspaceSaving}
                        onChange={(audience) =>
                          void handleDeckAudienceChange(deck.id, audience)
                        }
                      />
                    ) : null}
                    {!usesWorkspaceDefault ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-0 text-xs text-muted-foreground"
                        disabled={saving}
                        onClick={() => void resetDeckToWorkspaceDefault(deck.id)}
                      >
                        Use workspace default
                      </Button>
                    ) : null}
                    {deckError ? (
                      <p className="text-sm text-destructive" role="alert">
                        {deckError}
                      </p>
                    ) : null}
                  </div>
                  <Switch
                    id={`quiz-security-deck-${deck.id}`}
                    checked={effective}
                    disabled={saving || workspaceSaving}
                    onCheckedChange={(checked) => void handleDeckToggle(deck.id, checked)}
                    aria-label={`Quiz security for ${deck.name}`}
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
