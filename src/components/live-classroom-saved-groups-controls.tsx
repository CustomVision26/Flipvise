"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  applyLiveClassroomSavedGroupAction,
  deleteLiveClassroomSavedGroupAction,
  saveLiveClassroomLobbyGroupAction,
  updateLiveClassroomSavedGroupAction,
} from "@/actions/live-classroom";
import type { LiveClassroomWorkspaceMemberOption } from "@/components/live-classroom-session-settings-dialog";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  analyzeLiveClassroomSavedGroup,
  LIVE_CLASSROOM_MIN_MEMBERS_PER_TEAM,
  type LiveClassroomSavedGroupTeam,
} from "@/lib/live-classroom-saved-groups";

export type LiveClassroomSavedGroupOption = {
  id: number;
  name: string;
  groups: LiveClassroomSavedGroupTeam[];
  updatedAt: string;
};

type LobbyTeamSnapshot = {
  id: number;
  name: string;
};

type LobbyParticipantSnapshot = {
  userId: string;
  displayName: string;
  liveTeamId: number | null;
};

type LiveClassroomSavedGroupsControlsProps = {
  sessionId: number;
  teamsLocked: boolean;
  teams: LobbyTeamSnapshot[];
  participants: LobbyParticipantSnapshot[];
  workspaceMembers: LiveClassroomWorkspaceMemberOption[];
  initialSavedGroups: LiveClassroomSavedGroupOption[];
  onApplied?: () => void;
  /** Team assignment = Random — show Save group. */
  showSaveButton?: boolean;
  /** Team assignment = Saved groups — show load dropdown. */
  showLoadDropdown?: boolean;
};

const NONE = "__none__";

export function LiveClassroomSavedGroupsControls({
  sessionId,
  teamsLocked,
  teams,
  participants,
  workspaceMembers,
  initialSavedGroups,
  onApplied,
  showSaveButton = true,
  showLoadDropdown = true,
}: LiveClassroomSavedGroupsControlsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [savedGroups, setSavedGroups] =
    useState<LiveClassroomSavedGroupOption[]>(initialSavedGroups);
  const [selectedId, setSelectedId] = useState<string>(NONE);
  const [saveOpen, setSaveOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [repairOpen, setRepairOpen] = useState(false);
  const [repairGroup, setRepairGroup] =
    useState<LiveClassroomSavedGroupOption | null>(null);
  const [draftTeams, setDraftTeams] = useState<LiveClassroomSavedGroupTeam[]>(
    [],
  );
  const [addMemberSelectKey, setAddMemberSelectKey] = useState(0);

  const workspaceIds = useMemo(
    () => new Set(workspaceMembers.map((m) => m.userId)),
    [workspaceMembers],
  );

  const displayByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of workspaceMembers) map.set(m.userId, m.displayName);
    for (const p of participants) {
      if (!map.has(p.userId)) map.set(p.userId, p.displayName);
    }
    return map;
  }, [workspaceMembers, participants]);

  const lobbyPreview = useMemo(() => {
    return teams
      .map((t) => ({
        teamName: t.name,
        members: participants
          .filter((p) => p.liveTeamId === t.id)
          .map((p) => ({
            userId: p.userId,
            displayName: p.displayName,
          })),
      }))
      .filter((t) => t.members.length > 0);
  }, [teams, participants]);

  const saveValidationError = useMemo(() => {
    if (lobbyPreview.length === 0) {
      return "Assign members to teams before saving a group.";
    }
    for (const t of lobbyPreview) {
      if (t.members.length < LIVE_CLASSROOM_MIN_MEMBERS_PER_TEAM) {
        return `${t.teamName} needs at least ${LIVE_CLASSROOM_MIN_MEMBERS_PER_TEAM} members.`;
      }
    }
    return null;
  }, [lobbyPreview]);

  const draftIntegrity = useMemo(
    () => analyzeLiveClassroomSavedGroup(draftTeams, workspaceIds),
    [draftTeams, workspaceIds],
  );

  const draftValid =
    draftTeams.length > 0 &&
    draftTeams.every(
      (t) => t.userIds.length >= LIVE_CLASSROOM_MIN_MEMBERS_PER_TEAM,
    ) &&
    draftIntegrity.missingUserIds.length === 0;

  const unusedWorkspaceMembers = useMemo(() => {
    const used = new Set(draftTeams.flatMap((t) => t.userIds));
    return workspaceMembers.filter((m) => !used.has(m.userId));
  }, [draftTeams, workspaceMembers]);

  function openSaveDialog() {
    setGroupName("");
    setSaveOpen(true);
  }

  function openRepair(group: LiveClassroomSavedGroupOption) {
    const integrity = analyzeLiveClassroomSavedGroup(group.groups, workspaceIds);
    setRepairGroup(group);
    setDraftTeams(
      integrity.teams.map((t) => ({
        teamName: t.teamName,
        userIds: [...t.presentUserIds],
      })),
    );
    setRepairOpen(true);
  }

  function addMemberToDraft(teamName: string, userId: string) {
    setDraftTeams((prev) =>
      prev.map((t) =>
        t.teamName === teamName && !t.userIds.includes(userId)
          ? { ...t, userIds: [...t.userIds, userId] }
          : t,
      ),
    );
  }

  function removeMemberFromDraft(teamName: string, userId: string) {
    setDraftTeams((prev) =>
      prev.map((t) =>
        t.teamName === teamName
          ? { ...t, userIds: t.userIds.filter((id) => id !== userId) }
          : t,
      ),
    );
  }

  function handleSelectSavedGroup(value: string | null) {
    if (value == null || value === NONE) {
      setSelectedId(NONE);
      return;
    }
    setSelectedId(value);
    const id = Number(value);
    const group = savedGroups.find((g) => g.id === id);
    if (!group) return;

    const integrity = analyzeLiveClassroomSavedGroup(group.groups, workspaceIds);
    if (!integrity.isValid) {
      openRepair(group);
      return;
    }

    startTransition(async () => {
      try {
        const result = await applyLiveClassroomSavedGroupAction({
          sessionId,
          savedGroupId: id,
        });
        if (!result.ok && result.needsRepair) {
          openRepair(result.savedGroup);
          return;
        }
        toast.success(`Loaded “${group.name}”`);
        onApplied?.();
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not load saved group",
        );
        setSelectedId(NONE);
      }
    });
  }

  function handleSaveGroup(e: React.FormEvent) {
    e.preventDefault();
    if (saveValidationError) {
      toast.error(saveValidationError);
      return;
    }
    startTransition(async () => {
      try {
        const result = await saveLiveClassroomLobbyGroupAction({
          sessionId,
          name: groupName.trim(),
        });
        setSavedGroups((prev) => [result.savedGroup, ...prev]);
        setSelectedId(String(result.savedGroup.id));
        setSaveOpen(false);
        toast.success(`Saved group “${result.savedGroup.name}”`);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not save group",
        );
      }
    });
  }

  function handleDeleteRepairGroup() {
    if (!repairGroup) return;
    startTransition(async () => {
      try {
        await deleteLiveClassroomSavedGroupAction(repairGroup.id);
        setSavedGroups((prev) => prev.filter((g) => g.id !== repairGroup.id));
        setSelectedId(NONE);
        setRepairOpen(false);
        setRepairGroup(null);
        toast.success("Saved group deleted");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not delete group",
        );
      }
    });
  }

  function handleUpdateRepairGroup() {
    if (!repairGroup || !draftValid) {
      toast.error(
        `Each team needs at least ${LIVE_CLASSROOM_MIN_MEMBERS_PER_TEAM} workspace members.`,
      );
      return;
    }
    startTransition(async () => {
      try {
        const updated = await updateLiveClassroomSavedGroupAction({
          savedGroupId: repairGroup.id,
          groups: draftTeams,
        });
        setSavedGroups((prev) =>
          prev.map((g) =>
            g.id === updated.savedGroup.id ? updated.savedGroup : g,
          ),
        );
        const applied = await applyLiveClassroomSavedGroupAction({
          sessionId,
          savedGroupId: updated.savedGroup.id,
        });
        if (!applied.ok && applied.needsRepair) {
          openRepair(applied.savedGroup);
          toast.error("Group still needs more members.");
          return;
        }
        setRepairOpen(false);
        setRepairGroup(null);
        setSelectedId(String(updated.savedGroup.id));
        toast.success("Saved group updated and applied");
        onApplied?.();
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not update group",
        );
      }
    });
  }

  const savedGroupSelected = selectedId !== NONE;
  const saveGroupDisabled =
    pending ||
    teamsLocked ||
    (showLoadDropdown && savedGroupSelected);

  if (!showSaveButton && !showLoadDropdown) return null;

  return (
    <>
      {showSaveButton ? (
        <Button
          type="button"
          variant="outline"
          disabled={saveGroupDisabled}
          className="gap-1.5"
          title={
            teamsLocked
              ? "Unlock teams before saving a group"
              : savedGroupSelected
                ? "Clear the selected saved group to save a new one"
                : "Save the current team assignments"
          }
          onClick={openSaveDialog}
        >
          <Save className="size-3.5" aria-hidden />
          Save group
        </Button>
      ) : null}

      {showLoadDropdown ? (
        <Select
          value={selectedId}
          disabled={pending || teamsLocked || savedGroups.length === 0}
          onValueChange={handleSelectSavedGroup}
        >
          <SelectTrigger
            className="w-[11.5rem]"
            title={
              teamsLocked
                ? "Unlock teams before loading a saved group"
                : savedGroups.length === 0
                  ? "No saved groups yet"
                  : "Load a saved group onto the lobby teams"
            }
          >
            <SelectValue placeholder="Saved groups">
              {selectedId === NONE
                ? "Saved groups"
                : (savedGroups.find((g) => String(g.id) === selectedId)?.name ??
                  "Saved groups")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Saved groups</SelectItem>
            {savedGroups.map((g) => (
              <SelectItem key={g.id} value={String(g.id)}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSaveGroup} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Save group</DialogTitle>
              <DialogDescription>
                Save the current lobby teams and members so you can reload them
                later. Each team needs at least{" "}
                {LIVE_CLASSROOM_MIN_MEMBERS_PER_TEAM} members.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="lc-saved-group-name">Group name</Label>
              <Input
                id="lc-saved-group-name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Period 3 rivalry"
                maxLength={255}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Teams to save</Label>
              {lobbyPreview.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No members are assigned to teams yet.
                </p>
              ) : (
                <div className="space-y-2 rounded-lg border border-border/60 bg-muted/10 p-3">
                  {lobbyPreview.map((t) => (
                    <div key={t.teamName} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">
                          {t.teamName}
                        </p>
                        <Badge
                          variant={
                            t.members.length >=
                            LIVE_CLASSROOM_MIN_MEMBERS_PER_TEAM
                              ? "secondary"
                              : "destructive"
                          }
                          className="text-[10px]"
                        >
                          {t.members.length} member
                          {t.members.length === 1 ? "" : "s"}
                        </Badge>
                      </div>
                      <ul className="flex flex-wrap gap-1.5">
                        {t.members.map((m) => (
                          <Badge
                            key={m.userId}
                            variant="outline"
                            className="font-normal"
                          >
                            {m.displayName}
                          </Badge>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
              {saveValidationError ? (
                <p className="text-xs text-destructive">{saveValidationError}</p>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSaveOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  pending ||
                  Boolean(saveValidationError) ||
                  groupName.trim().length === 0
                }
                className="gap-1.5"
              >
                {pending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <BookmarkPlus className="size-3.5" aria-hidden />
                )}
                Save group
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={repairOpen}
        onOpenChange={(open) => {
          if (!open) {
            setRepairOpen(false);
            setRepairGroup(null);
            setSelectedId(NONE);
          }
        }}
      >
        <AlertDialogContent className="max-h-[min(90vh,40rem)] overflow-y-auto sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Update or delete “{repairGroup?.name ?? "saved group"}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              One or more members were removed from the workspace, so this saved
              group no longer has at least {LIVE_CLASSROOM_MIN_MEMBERS_PER_TEAM}{" "}
              members on every team. Add or reassign workspace members, or delete
              the saved group.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 py-1">
            {draftIntegrity.hasMissingMembers ? (
              <p className="text-xs text-muted-foreground">
                {draftIntegrity.missingUserIds.length} former member
                {draftIntegrity.missingUserIds.length === 1 ? "" : "s"} no longer
                in this workspace.
              </p>
            ) : null}
            {draftTeams.map((team) => (
              <div
                key={team.teamName}
                className="space-y-2 rounded-lg border border-border/60 bg-muted/10 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{team.teamName}</p>
                  <Badge
                    variant={
                      team.userIds.length >= LIVE_CLASSROOM_MIN_MEMBERS_PER_TEAM
                        ? "secondary"
                        : "destructive"
                    }
                    className="text-[10px]"
                  >
                    {team.userIds.length}/
                    {LIVE_CLASSROOM_MIN_MEMBERS_PER_TEAM}+
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {team.userIds.length === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      No members left
                    </span>
                  ) : (
                    team.userIds.map((userId) => (
                      <Button
                        key={userId}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 rounded-full px-2 text-xs"
                        onClick={() =>
                          removeMemberFromDraft(team.teamName, userId)
                        }
                      >
                        {displayByUserId.get(userId) ?? userId.slice(0, 8)} ×
                      </Button>
                    ))
                  )}
                </div>
                {unusedWorkspaceMembers.length > 0 ? (
                  <Select
                    key={`${team.teamName}-${addMemberSelectKey}`}
                    onValueChange={(v) => {
                      const value = typeof v === "string" ? v : "";
                      if (value) {
                        addMemberToDraft(team.teamName, value);
                        setAddMemberSelectKey((k) => k + 1);
                      }
                    }}
                  >
                    <SelectTrigger className="h-8 w-full">
                      <SelectValue placeholder="Add member…" />
                    </SelectTrigger>
                    <SelectContent>
                      {unusedWorkspaceMembers.map((m) => (
                        <SelectItem key={m.userId} value={m.userId}>
                          {m.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </div>
            ))}
            {!draftValid ? (
              <p className="text-xs text-destructive">
                Each team needs at least {LIVE_CLASSROOM_MIN_MEMBERS_PER_TEAM}{" "}
                members before you can update.
              </p>
            ) : null}
          </div>

          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={handleDeleteRepairGroup}
            >
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
              Delete saved group
            </Button>
            <AlertDialogAction
              disabled={pending || !draftValid}
              onClick={(e) => {
                e.preventDefault();
                handleUpdateRepairGroup();
              }}
            >
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
              Update & apply
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
