"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type {
  PlanReconciliationSnapshot,
  ReconciliationResourceAction,
} from "@/lib/plan-reconciliation-types";
import { submitPlanReconciliationAction } from "@/actions/plan-reconciliation";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type ResourceChoiceState = {
  inactive: boolean;
  delete: boolean;
};

type PlanReconciliationFormProps = {
  sessionId: number;
  snapshot: PlanReconciliationSnapshot;
};

function emptyChoice(): ResourceChoiceState {
  return { inactive: false, delete: false };
}

function choiceToAction(
  rowInactiveAt: string | null,
  choice: ResourceChoiceState,
): ReconciliationResourceAction {
  if (choice.delete) return "delete";
  if (choice.inactive) return "inactive";
  if (rowInactiveAt != null) return "inactive";
  return "keep";
}

function ResourceActionCheckboxes({
  label,
  disabled,
  choice,
  onChange,
  onDeleteConfirm,
}: {
  label: string;
  disabled?: boolean;
  choice: ResourceChoiceState;
  onChange: (next: ResourceChoiceState) => void;
  onDeleteConfirm: () => void;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      <span className="min-w-0 flex-1 font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`${label}-inactive`}
          checked={choice.inactive}
          disabled={disabled || choice.delete}
          onCheckedChange={(checked) =>
            onChange({
              inactive: checked === true,
              delete: false,
            })
          }
        />
        <Label htmlFor={`${label}-inactive`}>Inactive</Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`${label}-delete`}
          checked={choice.delete}
          disabled={disabled || choice.inactive}
          onCheckedChange={(checked) => {
            if (checked === true) {
              setDeleteOpen(true);
            } else {
              onChange({ inactive: false, delete: false });
            }
          }}
        />
        <Label htmlFor={`${label}-delete`}>Delete permanently</Label>
      </div>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Cards, assignments, and related data for{" "}
              <strong>{label}</strong> will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onChange({ inactive: false, delete: true });
                onDeleteConfirm();
              }}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function PlanReconciliationForm({
  sessionId,
  snapshot,
}: PlanReconciliationFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const [teamChoices, setTeamChoices] = useState<
    Record<number, ResourceChoiceState>
  >(() =>
    Object.fromEntries(snapshot.teams.map((t) => [t.id, emptyChoice()])),
  );
  const [memberChoices, setMemberChoices] = useState<
    Record<string, ResourceChoiceState>
  >(() => {
    const initial: Record<string, ResourceChoiceState> = {};
    for (const team of snapshot.teams) {
      for (const member of team.members) {
        initial[`${team.id}:${member.userId}`] = emptyChoice();
      }
    }
    return initial;
  });
  const [teamDeckChoices, setTeamDeckChoices] = useState<
    Record<string, ResourceChoiceState>
  >(() => {
    const initial: Record<string, ResourceChoiceState> = {};
    for (const team of snapshot.teams) {
      for (const deck of team.decks) {
        initial[`${team.id}:${deck.id}`] = emptyChoice();
      }
    }
    return initial;
  });
  const [personalDeckChoices, setPersonalDeckChoices] = useState<
    Record<number, ResourceChoiceState>
  >(() =>
    Object.fromEntries(snapshot.personalDecks.map((d) => [d.id, emptyChoice()])),
  );

  const counts = useMemo(() => {
    const activeTeams = snapshot.teams.filter((team) => {
      const action = choiceToAction(
        team.inactiveAt,
        teamChoices[team.id] ?? emptyChoice(),
      );
      return action === "keep";
    }).length;

    const activePersonalDecks = snapshot.personalDecks.filter((deck) => {
      const action = choiceToAction(
        deck.inactiveAt,
        personalDeckChoices[deck.id] ?? emptyChoice(),
      );
      return action === "keep";
    }).length;

    const teamMemberCounts = snapshot.teams.map((team) => {
      const activeMembers = team.members.filter((member) => {
        const key = `${team.id}:${member.userId}`;
        const action = choiceToAction(
          member.inactiveAt,
          memberChoices[key] ?? emptyChoice(),
        );
        return action === "keep";
      }).length;
      const activeDecks = team.decks.filter((deck) => {
        const key = `${team.id}:${deck.id}`;
        const action = choiceToAction(
          deck.inactiveAt,
          teamDeckChoices[key] ?? emptyChoice(),
        );
        return action === "keep";
      }).length;
      return { teamId: team.id, activeMembers, activeDecks };
    });

    return { activeTeams, activePersonalDecks, teamMemberCounts };
  }, [
    snapshot,
    teamChoices,
    memberChoices,
    teamDeckChoices,
    personalDeckChoices,
  ]);

  const { limits } = snapshot;
  const teamWithinLimits =
    limits.mode !== "team" ||
    ((limits.maxTeams == null || counts.activeTeams <= limits.maxTeams) &&
      counts.teamMemberCounts.every((row) => {
        const team = snapshot.teams.find((t) => t.id === row.teamId);
        if (!team) return true;
        const teamAction = choiceToAction(
          team.inactiveAt,
          teamChoices[team.id] ?? emptyChoice(),
        );
        if (teamAction !== "keep") return true;
        const membersOk =
          limits.maxMembersPerTeam == null ||
          row.activeMembers <= limits.maxMembersPerTeam;
        const decksOk =
          limits.maxDecksPerWorkspace == null ||
          row.activeDecks <= limits.maxDecksPerWorkspace;
        return membersOk && decksOk;
      }));

  const personalWithinLimits =
    limits.maxPersonalDecks == null ||
    counts.activePersonalDecks <= limits.maxPersonalDecks;

  const canSubmit = teamWithinLimits && personalWithinLimits;

  async function handleSubmit() {
    if (!canSubmit) {
      toast.error("Reduce active resources to meet your plan limits before continuing.");
      return;
    }

    setSubmitting(true);
    try {
      await submitPlanReconciliationAction({
        sessionId,
        teams:
          limits.mode === "team"
            ? snapshot.teams.map((team) => ({
                teamId: team.id,
                action: choiceToAction(
                  team.inactiveAt,
                  teamChoices[team.id] ?? emptyChoice(),
                ),
                members: team.members.map((member) => ({
                  memberUserId: member.userId,
                  action: choiceToAction(
                    member.inactiveAt,
                    memberChoices[`${team.id}:${member.userId}`] ?? emptyChoice(),
                  ),
                })),
                decks: team.decks.map((deck) => ({
                  deckId: deck.id,
                  action: choiceToAction(
                    deck.inactiveAt,
                    teamDeckChoices[`${team.id}:${deck.id}`] ?? emptyChoice(),
                  ),
                })),
              }))
            : undefined,
        personalDecks: snapshot.personalDecks.map((deck) => ({
          deckId: deck.id,
          action: choiceToAction(
            deck.inactiveAt,
            personalDeckChoices[deck.id] ?? emptyChoice(),
          ),
        })),
      });
      toast.success("Plan limits updated. Welcome back!");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save your choices.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Align your account with {limits.planLabel}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Your plan changed
          {snapshot.previousPlanSlug
            ? ` from ${snapshot.previousPlanSlug}`
            : ""}
          . Mark workspaces, members, or decks as inactive (restorable on a future
          upgrade) or delete them permanently to meet your new limits before
          continuing.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current plan limits</CardTitle>
          <CardDescription>
            Active resources must be at or below these caps.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {limits.maxTeams != null && (
            <Badge variant={counts.activeTeams <= limits.maxTeams ? "secondary" : "destructive"}>
              Workspaces: {counts.activeTeams} / {limits.maxTeams}
            </Badge>
          )}
          {limits.maxMembersPerTeam != null && (
            <Badge variant="secondary">
              Members per workspace: up to {limits.maxMembersPerTeam}
            </Badge>
          )}
          {limits.maxDecksPerWorkspace != null && (
            <Badge variant="secondary">
              Decks per workspace: up to {limits.maxDecksPerWorkspace}
            </Badge>
          )}
          {limits.maxPersonalDecks != null && (
            <Badge
              variant={
                counts.activePersonalDecks <= limits.maxPersonalDecks
                  ? "secondary"
                  : "destructive"
              }
            >
              Personal decks: {counts.activePersonalDecks} / {limits.maxPersonalDecks}
            </Badge>
          )}
        </CardContent>
      </Card>

      {!canSubmit && (
        <Alert variant="destructive">
          <AlertTitle>Over plan limits</AlertTitle>
          <AlertDescription>
            Mark enough resources inactive or delete them permanently until every
            count is within your {limits.planLabel} limits.
          </AlertDescription>
        </Alert>
      )}

      {limits.mode === "team" && snapshot.teams.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Team workspaces</CardTitle>
            <CardDescription>
              Members and decks are grouped under each workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {snapshot.teams.map((team) => {
              const teamCount = counts.teamMemberCounts.find(
                (c) => c.teamId === team.id,
              );
              const teamDisabled =
                choiceToAction(
                  team.inactiveAt,
                  teamChoices[team.id] ?? emptyChoice(),
                ) !== "keep";

              return (
                <div key={team.id} className="space-y-4 rounded-lg border p-4">
                  <ResourceActionCheckboxes
                    label={`Workspace: ${team.name}`}
                    choice={teamChoices[team.id] ?? emptyChoice()}
                    onChange={(next) =>
                      setTeamChoices((prev) => ({ ...prev, [team.id]: next }))
                    }
                    onDeleteConfirm={() => undefined}
                  />
                  {!teamDisabled && (
                    <>
                      <div className="text-muted-foreground text-xs">
                        Members {teamCount?.activeMembers ?? 0}
                        {limits.maxMembersPerTeam != null &&
                          ` / ${limits.maxMembersPerTeam}`}
                        {" · "}
                        Decks {teamCount?.activeDecks ?? 0}
                        {limits.maxDecksPerWorkspace != null &&
                          ` / ${limits.maxDecksPerWorkspace}`}
                      </div>
                      <Separator />
                      <div className="space-y-3">
                        <p className="text-sm font-medium">Members</p>
                        {team.members.map((member) => (
                          <ResourceActionCheckboxes
                            key={member.userId}
                            label={`${member.displayName} (${member.role})`}
                            choice={
                              memberChoices[`${team.id}:${member.userId}`] ??
                              emptyChoice()
                            }
                            onChange={(next) =>
                              setMemberChoices((prev) => ({
                                ...prev,
                                [`${team.id}:${member.userId}`]: next,
                              }))
                            }
                            onDeleteConfirm={() => undefined}
                          />
                        ))}
                      </div>
                      <Separator />
                      <div className="space-y-3">
                        <p className="text-sm font-medium">Decks</p>
                        {team.decks.map((deck) => (
                          <ResourceActionCheckboxes
                            key={deck.id}
                            label={`${deck.name} (${deck.cardCount} cards)`}
                            choice={
                              teamDeckChoices[`${team.id}:${deck.id}`] ??
                              emptyChoice()
                            }
                            onChange={(next) =>
                              setTeamDeckChoices((prev) => ({
                                ...prev,
                                [`${team.id}:${deck.id}`]: next,
                              }))
                            }
                            onDeleteConfirm={() => undefined}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {snapshot.personalDecks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Personal decks</CardTitle>
            <CardDescription>
              Choose decks to keep on your personal dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.personalDecks.map((deck) => (
              <ResourceActionCheckboxes
                key={deck.id}
                label={`${deck.name} (${deck.cardCount} cards)`}
                choice={personalDeckChoices[deck.id] ?? emptyChoice()}
                onChange={(next) =>
                  setPersonalDeckChoices((prev) => ({ ...prev, [deck.id]: next }))
                }
                onDeleteConfirm={() => undefined}
              />
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button disabled={!canSubmit || submitting} onClick={handleSubmit}>
          {submitting ? "Saving…" : "Continue to dashboard"}
        </Button>
      </div>
    </div>
  );
}
