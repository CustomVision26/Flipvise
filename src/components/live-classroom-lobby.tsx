"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type DragEvent,
} from "react";
import {
  Copy,
  DoorOpen,
  GripVertical,
  Loader2,
  Lock,
  Play,
  Shuffle,
  Unlock,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  assignLiveClassroomTeamsAction,
  clearLiveClassroomBattleCountdownAction,
  getLiveClassroomRealtimeStateAction,
  heartbeatLiveClassroomAction,
  joinLiveClassroomSessionAction,
  leaveLiveClassroomPresenceAction,
  scheduleLiveClassroomBattleCountdownAction,
  startLiveClassroomBattleAction,
  updateLobbyTeamAction,
} from "@/actions/live-classroom";
import { cancelLiveClassroomLobbySessionAction } from "@/actions/live-classroom-session-admin";
import { LiveClassroomBattleCountdownDialog } from "@/components/live-classroom-battle-countdown-dialog";
import { useLiveClassroomRealtime } from "@/components/live-classroom-realtime-poller";
import {
  LiveClassroomSavedGroupsControls,
  type LiveClassroomSavedGroupOption,
} from "@/components/live-classroom-saved-groups-controls";
import { LiveClassroomRescheduleDialog } from "@/components/live-classroom-reschedule-dialog";
import {
  LiveClassroomScheduledCountdown,
  useLiveClassroomScheduleReady,
} from "@/components/live-classroom-scheduled-countdown";
import {
  LiveClassroomSessionSettingsDialog,
  type LiveClassroomWorkspaceMemberOption,
} from "@/components/live-classroom-session-settings-dialog";
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
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  battleModeLabel,
  liveClassroomTeamTone,
  sessionTypeLabel,
} from "@/lib/live-classroom-types";
import { LIVE_CLASSROOM_MIN_MEMBERS_PER_TEAM } from "@/lib/live-classroom-saved-groups";
import {
  liveClassroomHostPath,
  liveClassroomPlayPath,
  liveClassroomProjectorPath,
  liveClassroomReportPath,
  liveClassroomSessionGonePath,
} from "@/lib/live-classroom-url";

const LC_MEMBER_DRAG_MIME = "application/x-flipvise-lc-member";

type LiveClassroomLobbyProps = {
  sessionId: number;
  userId: string;
  ownerUserId: string;
  teamId: number;
  canHost: boolean;
  /** Owner or team admin — can see unassigned roster and drag members onto teams. */
  canManage: boolean;
  licensedSeats: number;
  workspaceMembers?: LiveClassroomWorkspaceMemberOption[];
  assignedUserIds?: string[];
  savedGroups?: LiveClassroomSavedGroupOption[];
};

export function LiveClassroomLobby({
  sessionId,
  userId,
  ownerUserId,
  teamId,
  canHost,
  canManage,
  workspaceMembers = [],
  assignedUserIds = [],
  savedGroups = [],
}: LiveClassroomLobbyProps) {
  const [pending, startTransition] = useTransition();
  const [joined, setJoined] = useState(false);
  const [draggingUserId, setDraggingUserId] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const [countdownAt, setCountdownAt] = useState<string | null>(null);
  const [startingBattle, setStartingBattle] = useState(false);
  const [schedulingBattle, setSchedulingBattle] = useState(false);
  const [closeLobbyOpen, setCloseLobbyOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const leftLobbyForBattleRef = useRef(false);
  const startingBattleRef = useRef(false);

  const sessionGoneHref = liveClassroomSessionGonePath({
    canManage,
    teamId,
  });

  // Pause polls only for the host while start runs — overlapping server actions
  // starved navigation. Non-hosts keep polling so they see status=active.
  const { state, error, setState } = useLiveClassroomRealtime(
    sessionId,
    5000,
    !(startingBattle && canHost),
  );

  useEffect(() => {
    void joinLiveClassroomSessionAction({ sessionId })
      .then(() => {
        setJoined(true);
        setJoinError(null);
      })
      .catch((e) => {
        const message =
          e instanceof Error ? e.message : "Could not join lobby";
        setJoinError(message);
        toast.error(message);
        if (
          /not joinable|not available|not found|cancelled|completed/i.test(
            message,
          )
        ) {
          window.location.assign(sessionGoneHref);
        }
      });
  }, [sessionId, sessionGoneHref]);

  useEffect(() => {
    if (!error) return;
    if (/not available|not found/i.test(error)) {
      window.location.assign(sessionGoneHref);
    }
  }, [error, sessionGoneHref]);

  useEffect(() => {
    if (!joined) return;
    const id = window.setInterval(() => {
      void heartbeatLiveClassroomAction(sessionId).catch(() => undefined);
    }, 12_000);
    return () => {
      window.clearInterval(id);
      // Skip leave-presence when hard-navigating into an active battle — that
      // brief offline window used to auto-complete independent sessions.
      if (leftLobbyForBattleRef.current) return;
      void leaveLiveClassroomPresenceAction(sessionId).catch(() => undefined);
    };
  }, [joined, sessionId]);

  const clearCountdownUi = useCallback(() => {
    startingBattleRef.current = false;
    setCountdownAt(null);
    setStartingBattle(false);
    setSchedulingBattle(false);
  }, []);

  const forceLeaveLobbyToBattle = useCallback(
    (hasTeam: boolean, isSessionHost: boolean) => {
      if (leftLobbyForBattleRef.current) return;
      leftLobbyForBattleRef.current = true;
      clearCountdownUi();
      const dest =
        hasTeam || !isSessionHost
          ? liveClassroomPlayPath(sessionId)
          : liveClassroomHostPath(sessionId);
      // Hard navigation — soft replace left the lobby overlay stuck while the
      // battle was already active under heavy poll/start load.
      window.location.assign(dest);
    },
    [sessionId, clearCountdownUi],
  );

  useEffect(() => {
    if (!state) return;
    const status = state.session.status;
    const serverStartsAt = state.session.battleStartsAt;

    if (status === "cancelled") {
      leftLobbyForBattleRef.current = false;
      clearCountdownUi();
      window.location.assign(sessionGoneHref);
      return;
    }

    if (status === "completed") {
      leftLobbyForBattleRef.current = false;
      clearCountdownUi();
      window.location.assign(liveClassroomReportPath(sessionId));
      return;
    }

    if (status === "active" || status === "paused") {
      const me = state.participants.find((p) => p.userId === userId);
      const hasTeam = me?.liveTeamId != null;
      const isSessionHost = state.session.hostUserId === userId;
      forceLeaveLobbyToBattle(hasTeam, isSessionHost);
      return;
    }

    if (serverStartsAt) {
      setCountdownAt(serverStartsAt);
    } else if (!startingBattle && !schedulingBattle) {
      setCountdownAt(null);
    }
  }, [
    state,
    userId,
    sessionId,
    startingBattle,
    schedulingBattle,
    forceLeaveLobbyToBattle,
    clearCountdownUi,
    sessionGoneHref,
  ]);

  const finishCountdownAndStart = useCallback(() => {
    if (startingBattleRef.current || leftLobbyForBattleRef.current) return;
    startingBattleRef.current = true;
    setStartingBattle(true);
    void (async () => {
      try {
        // Only host/admin starts — other clients keep the overlay until poll
        // sees status=active (avoids start stampede + premature play load).
        if (!canHost) {
          return;
        }
        await startLiveClassroomBattleAction(sessionId);
        const me = state?.participants.find((p) => p.userId === userId);
        const hasTeam = me?.liveTeamId != null;
        const isSessionHost = state?.session.hostUserId === userId;
        forceLeaveLobbyToBattle(hasTeam, Boolean(isSessionHost));
      } catch (e) {
        leftLobbyForBattleRef.current = false;
        clearCountdownUi();
        void clearLiveClassroomBattleCountdownAction(sessionId).catch(
          () => undefined,
        );
        toast.error(
          e instanceof Error ? e.message : "Could not start the battle",
        );
      }
    })();
  }, [
    canHost,
    sessionId,
    state,
    userId,
    forceLeaveLobbyToBattle,
    clearCountdownUi,
  ]);

  // Non-host / stalled start: if still on lobby after activation window, recover.
  useEffect(() => {
    if (!startingBattle) return;
    const id = window.setTimeout(() => {
      if (leftLobbyForBattleRef.current) return;
      void getLiveClassroomRealtimeStateAction(sessionId)
        .then((next) => {
          setState(next);
          const status = next.session.status;
          if (status === "active" || status === "paused") {
            const me = next.participants.find((p) => p.userId === userId);
            forceLeaveLobbyToBattle(
              me?.liveTeamId != null,
              next.session.hostUserId === userId,
            );
            return;
          }
          if (canHost && status === "lobby") {
            return startLiveClassroomBattleAction(sessionId).then(() => {
              const me = next.participants.find((p) => p.userId === userId);
              forceLeaveLobbyToBattle(
                me?.liveTeamId != null,
                next.session.hostUserId === userId,
              );
            });
          }
          clearCountdownUi();
          toast.error("Battle did not start. Try Start battle again.");
        })
        .catch((e) => {
          clearCountdownUi();
          toast.error(
            e instanceof Error ? e.message : "Could not start the battle",
          );
        });
    }, 12_000);
    return () => window.clearTimeout(id);
  }, [
    startingBattle,
    sessionId,
    userId,
    canHost,
    setState,
    forceLeaveLobbyToBattle,
    clearCountdownUi,
  ]);

  async function scheduleBattleCountdown() {
    if (schedulingBattle || startingBattle || countdownAt != null) return;
    setSchedulingBattle(true);
    try {
      const result = await scheduleLiveClassroomBattleCountdownAction(sessionId);
      if (result.alreadyActive) {
        setSchedulingBattle(false);
        leftLobbyForBattleRef.current = true;
        window.location.assign(liveClassroomHostPath(sessionId));
        return;
      }
      setCountdownAt(result.battleStartsAt);
      toast.success("Countdown started");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not start countdown",
      );
    } finally {
      setSchedulingBattle(false);
    }
  }

  function run(label: string, fn: () => Promise<unknown>) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(label);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Action failed");
      }
    });
  }

  const canDragAssign =
    canManage && state != null && !state.session.teamsLocked && !pending;
  const scheduleReady = useLiveClassroomScheduleReady(
    state?.session.scheduledFor,
  );

  function moveMemberToTeam(moveUserId: string, toLiveTeamId: number | null) {
    if (!canManage || !state || state.session.teamsLocked) return;
    const current = state.participants.find((p) => p.userId === moveUserId);
    if (!current) return;
    if ((current.liveTeamId ?? null) === toLiveTeamId) return;

    const previous = state;
    setState({
      ...state,
      participants: state.participants.map((p) =>
        p.userId === moveUserId ? { ...p, liveTeamId: toLiveTeamId } : p,
      ),
    });

    startTransition(async () => {
      try {
        await updateLobbyTeamAction({
          sessionId,
          moveUserId,
          toLiveTeamId,
        });
        toast.success("Member moved");
      } catch (e) {
        setState(previous);
        toast.error(e instanceof Error ? e.message : "Could not move member");
      }
    });
  }

  function onMemberDragStart(e: DragEvent, memberUserId: string) {
    if (!canDragAssign) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData(LC_MEMBER_DRAG_MIME, memberUserId);
    e.dataTransfer.setData("text/plain", memberUserId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingUserId(memberUserId);
  }

  function onMemberDragEnd() {
    setDraggingUserId(null);
    setDropTargetKey(null);
  }

  function onTeamDragOver(e: DragEvent, targetKey: string) {
    if (!canDragAssign) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTargetKey(targetKey);
  }

  function onTeamDrop(e: DragEvent, toLiveTeamId: number | null) {
    e.preventDefault();
    const moveUserId =
      e.dataTransfer.getData(LC_MEMBER_DRAG_MIME) ||
      e.dataTransfer.getData("text/plain") ||
      draggingUserId;
    setDropTargetKey(null);
    setDraggingUserId(null);
    if (!moveUserId || !canDragAssign) return;
    moveMemberToTeam(moveUserId, toLiveTeamId);
  }

  if (!state) {
    const failMessage = joinError ?? error;
    const unavailable =
      failMessage != null &&
      /not available|not found|not assigned|not joinable/i.test(failMessage);
    return (
      <div className="flex flex-col gap-3 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          {!unavailable ? (
            <Loader2 className="size-4 animate-spin" />
          ) : null}
          {unavailable ? "This lobby is no longer available." : "Loading lobby…"}
          {failMessage ? (
            <span className="text-destructive">{failMessage}</span>
          ) : null}
        </div>
        {unavailable ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => window.location.assign(sessionGoneHref)}
          >
            {canManage ? "Back to Sessions Pool" : "Back to Team Dashboard"}
          </Button>
        ) : null}
      </div>
    );
  }

  const { session, teams, participants, otherLiveSession } = state;
  const blockedByOtherLive = otherLiveSession != null;
  const otherLiveBlockReason = otherLiveSession
    ? `“${otherLiveSession.name}” is live. Finish that battle before starting this session.`
    : undefined;
  const assignedParticipants = participants.filter((p) => p.liveTeamId != null);
  const notReadyParticipants = assignedParticipants.filter((p) => !p.connected);
  const membersLockedAndReady =
    session.teamsLocked &&
    assignedParticipants.length > 0 &&
    notReadyParticipants.length === 0;
  const lcAccessUserIds = new Set<string>(assignedUserIds);
  const lcAccessTotal = lcAccessUserIds.size;
  const lcAccessInLobby = participants.filter((p) =>
    lcAccessUserIds.has(p.userId),
  ).length;

  const selfParticipant = participants.find((p) => p.userId === userId);
  const selfLiveTeamId = selfParticipant?.liveTeamId ?? null;
  const selfLiveTeam = teams.find((t) => t.id === selfLiveTeamId) ?? null;
  /** Owner / team admin see every team + Unassigned; members only see their assigned team. */
  const visibleTeams = canManage
    ? teams
    : teams.filter((t) => t.id === selfLiveTeamId);
  /** Teams with at least one member — shown as VS matchup for owners/admins. */
  const matchupTeams = canManage
    ? teams
        .filter((t) => participants.some((p) => p.liveTeamId === t.id))
        .map((t) => ({ name: t.name, colorKey: t.colorKey }))
    : null;

  const teamAssignment = session.config.teamAssignment ?? "manual";
  /** Manual → hide Random / Save / load. Random → Save only. Saved groups → Save + load. */
  const showRandomTeamsButton = teamAssignment === "random";
  const showSaveGroupButton =
    teamAssignment === "random" || teamAssignment === "saved_groups";
  const showSavedGroupsDropdown = teamAssignment === "saved_groups";

  return (
    <div className="space-y-4">
      <Card className="border-border/80 bg-card/60 shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl tracking-tight">{session.name}</CardTitle>
            <CardDescription>
              {sessionTypeLabel(session.sessionType)} ·{" "}
              {battleModeLabel(session.battleMode)}
              {session.deckName ? (
                <>
                  {" · "}
                  {session.deckName}
                  {session.deckCardCount != null
                    ? ` · ${session.deckCardCount} card${
                        session.deckCardCount === 1 ? "" : "s"
                      }`
                    : ""}
                </>
              ) : null}
            </CardDescription>
            {session.scheduledFor ? (
              <LiveClassroomScheduledCountdown
                scheduledFor={session.scheduledFor}
                showDate
                onEdit={canHost ? () => setRescheduleOpen(true) : undefined}
              />
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {blockedByOtherLive && otherLiveSession ? (
              <Badge
                title={otherLiveBlockReason}
                className="gap-1"
              >
                Live: {otherLiveSession.name}
              </Badge>
            ) : null}
            {canHost ? (
              <LiveClassroomSessionSettingsDialog
                sessionId={sessionId}
                canHost={canHost}
                teamsLocked={session.teamsLocked}
                ownerUserId={ownerUserId}
                disabled={blockedByOtherLive}
                disabledReason={otherLiveBlockReason}
                session={{
                  name: session.name,
                  sessionType: session.sessionType,
                  battleMode: session.battleMode,
                  config: session.config,
                }}
                deckId={session.deckId}
                teams={teams.map((t) => ({ id: t.id, name: t.name }))}
                participants={participants.map((p) => ({
                  id: p.id,
                  userId: p.userId,
                  displayName: p.displayName,
                  liveTeamId: p.liveTeamId,
                  connected: p.connected,
                }))}
                workspaceMembers={workspaceMembers}
                assignedUserIds={assignedUserIds}
                currentUserId={userId}
              />
            ) : null}
            <Badge
              variant="outline"
              className={cn(
                "font-mono text-base tracking-widest",
                blockedByOtherLive && "opacity-50",
              )}
            >
              {session.joinCode}
            </Badge>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={blockedByOtherLive}
              title={otherLiveBlockReason}
              onClick={() => {
                void navigator.clipboard.writeText(session.joinCode);
                toast.success("Join code copied");
              }}
            >
              <Copy className="size-3.5" aria-hidden />
              Copy code
            </Button>
            <Badge
              variant="secondary"
              className="gap-1"
              title="Members with Live Classroom access in lobby / total with access"
            >
              <Users className="size-3" aria-hidden />
              {lcAccessInLobby}/{lcAccessTotal}
            </Badge>
            {session.teamsLocked ? (
              <Badge variant="outline" className="gap-1">
                <Lock className="size-3" aria-hidden />
                Locked
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <Unlock className="size-3" aria-hidden />
                Open
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Share the join code above with members assigned to the Live
            Classroom™ team. They open{" "}
            <span className="text-foreground">Join with code</span> on the
            linked deck’s study page and enter it — there is no lobby link.
            Workspace membership alone is not enough.
          </p>
        {canHost ? (
          <div className="flex flex-wrap gap-2">
            {showRandomTeamsButton ? (
              <Button
                type="button"
                disabled={pending || session.teamsLocked}
                className="gap-1.5"
                variant="outline"
                onClick={() =>
                  run("Teams shuffled", () =>
                    assignLiveClassroomTeamsAction({
                      sessionId,
                      mode: "random",
                    }),
                  )
                }
              >
                <Shuffle className="size-3.5" aria-hidden />
                Random teams
              </Button>
            ) : null}
            <Button
              type="button"
              disabled={pending || schedulingBattle || startingBattle}
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                if (!session.teamsLocked) {
                  const undersized = teams.filter((team) => {
                    const count = participants.filter(
                      (p) => p.liveTeamId === team.id,
                    ).length;
                    return count < LIVE_CLASSROOM_MIN_MEMBERS_PER_TEAM;
                  });
                  if (undersized.length > 0) {
                    const names = undersized.map((t) => t.name).join(", ");
                    toast.error(
                      undersized.length === 1
                        ? `Cannot lock teams — ${names} needs at least ${LIVE_CLASSROOM_MIN_MEMBERS_PER_TEAM} members. Add a member to ${names}.`
                        : `Cannot lock teams — add members so each team has at least ${LIVE_CLASSROOM_MIN_MEMBERS_PER_TEAM}. Needs members: ${names}.`,
                    );
                    return;
                  }
                }
                run(
                  session.teamsLocked ? "Teams unlocked" : "Teams locked",
                  () =>
                    updateLobbyTeamAction({
                      sessionId,
                      liveTeamId: teams[0]?.id ?? 0,
                      lockTeams: !session.teamsLocked,
                    }).then((result) => {
                      if (session.teamsLocked) {
                        setCountdownAt(null);
                        setStartingBattle(false);
                        setSchedulingBattle(false);
                      }
                      return result;
                    }),
                );
              }}
            >
              {session.teamsLocked ? (
                <Unlock className="size-3.5" aria-hidden />
              ) : (
                <Lock className="size-3.5" aria-hidden />
              )}
              {session.teamsLocked ? "Unlock teams" : "Lock teams"}
            </Button>
            {canManage ? (
              <>
                <LiveClassroomSavedGroupsControls
                  sessionId={sessionId}
                  teamsLocked={session.teamsLocked}
                  teams={teams.map((t) => ({ id: t.id, name: t.name }))}
                  participants={participants.map((p) => ({
                    userId: p.userId,
                    displayName: p.displayName,
                    liveTeamId: p.liveTeamId,
                  }))}
                  workspaceMembers={workspaceMembers}
                  initialSavedGroups={savedGroups}
                  showSaveButton={showSaveGroupButton}
                  showLoadDropdown={showSavedGroupsDropdown}
                  onApplied={() => {
                    void getLiveClassroomRealtimeStateAction(sessionId)
                      .then((next) => setState(next))
                      .catch(() => undefined);
                  }}
                />
                {scheduleReady && membersLockedAndReady ? (
                  <Button
                    type="button"
                    disabled={
                      pending ||
                      schedulingBattle ||
                      startingBattle ||
                      countdownAt != null ||
                      blockedByOtherLive
                    }
                    className="gap-1.5"
                    title={
                      blockedByOtherLive
                        ? otherLiveBlockReason
                        : countdownAt != null
                          ? "Countdown in progress"
                          : "Start the battle countdown"
                    }
                    onClick={() => void scheduleBattleCountdown()}
                  >
                    {schedulingBattle || startingBattle ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Play className="size-3.5" aria-hidden />
                    )}
                    Start battle
                  </Button>
                ) : scheduleReady && !blockedByOtherLive ? (
                  <Badge
                    variant="outline"
                    className="gap-1.5 py-1.5 text-xs text-muted-foreground"
                    title={
                      !session.teamsLocked
                        ? "Lock teams to enable Start battle."
                        : assignedParticipants.length === 0
                          ? "Assign at least one member to a team."
                          : `Waiting for ${notReadyParticipants.length} member${notReadyParticipants.length === 1 ? "" : "s"} to reconnect: ${notReadyParticipants
                              .map((p) => p.displayName)
                              .join(", ")}`
                    }
                  >
                    <Users className="size-3" aria-hidden />
                    {!session.teamsLocked
                      ? "Lock teams to start"
                      : assignedParticipants.length === 0
                        ? "No members assigned"
                        : `${assignedParticipants.length - notReadyParticipants.length}/${assignedParticipants.length} ready`}
                  </Badge>
                ) : null}
                {session.teamsLocked && !blockedByOtherLive ? (
                  <Button
                    nativeButton={false}
                    variant="secondary"
                    render={
                      <a
                        href={liveClassroomProjectorPath(sessionId)}
                        target="_blank"
                        rel="noreferrer"
                      />
                    }
                  >
                    Open projector
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled
                    title={
                      blockedByOtherLive
                        ? otherLiveBlockReason
                        : "Lock teams before opening the projector"
                    }
                  >
                    Open projector
                  </Button>
                )}
                <Button
                  type="button"
                  disabled={pending || schedulingBattle || startingBattle}
                  variant="outline"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  onClick={() => setCloseLobbyOpen(true)}
                >
                  <DoorOpen className="size-3.5" aria-hidden />
                  Close lobby
                </Button>
              </>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2">
            {session.scheduledFor ? (
              <LiveClassroomScheduledCountdown
                scheduledFor={session.scheduledFor}
                showDate
              />
            ) : null}
            <p className="text-sm text-muted-foreground">
              Waiting for the host to start the battle…
            </p>
          </div>
        )}
        </CardContent>
      </Card>

      {!canManage && selfLiveTeamId == null ? (
        <Card className="border-border/80 bg-card/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Waiting for a team</CardTitle>
            <CardDescription>
              The host will assign you to a team. You’ll only see your own team
              once you’re placed.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div
          className={cn(
            "grid gap-4",
            visibleTeams.length > 1 ? "md:grid-cols-2" : "md:grid-cols-1",
          )}
        >
          {visibleTeams.map((team) => {
            const members = participants.filter((p) => p.liveTeamId === team.id);
            const targetKey = `team:${team.id}`;
            const isDropTarget = dropTargetKey === targetKey;
            const tone = liveClassroomTeamTone(team.colorKey);
            return (
              <Card
                key={team.id}
                className={cn(
                  "shadow-sm transition-colors",
                  tone.card,
                  canDragAssign && "min-h-36",
                  isDropTarget && "ring-2 ring-primary/50",
                )}
                onDragOver={(e) => onTeamDragOver(e, targetKey)}
                onDragLeave={() => {
                  if (dropTargetKey === targetKey) setDropTargetKey(null);
                }}
                onDrop={(e) => onTeamDrop(e, team.id)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className={cn("text-base", tone.title)}>
                    {team.name}
                  </CardTitle>
                  <CardDescription>
                    {members.length} member{members.length === 1 ? "" : "s"}
                    {canDragAssign
                      ? " · Drop members here"
                      : canManage && session.teamsLocked
                        ? " · Teams locked"
                        : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {members.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {canDragAssign
                        ? "Drag a member here from Unassigned"
                        : "No members yet"}
                    </p>
                  ) : (
                    members.map((m) => (
                      <div
                        key={m.id}
                        draggable={canDragAssign}
                        onDragStart={(e) => onMemberDragStart(e, m.userId)}
                        onDragEnd={onMemberDragEnd}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm",
                          tone.row,
                          canDragAssign &&
                            "cursor-grab active:cursor-grabbing",
                          draggingUserId === m.userId && "opacity-50",
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-1.5 truncate">
                          {canDragAssign ? (
                            <GripVertical
                              className="size-3.5 shrink-0 opacity-70"
                              aria-hidden
                            />
                          ) : null}
                          <span className="truncate">
                            {m.displayName}
                            {m.userId === userId ? " (you)" : ""}
                          </span>
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 text-[10px]",
                            m.connected ? tone.badgeOnline : tone.badgeAway,
                          )}
                          title={
                            m.connected
                              ? "In the lobby and ready for the session"
                              : "In the lobby but currently away"
                          }
                        >
                          {m.connected ? "Ready" : "Not ready"}
                        </Badge>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {canManage ? (
        <Card
          className={cn(
            "border-border/80 bg-card/60 shadow-sm",
            dropTargetKey === "unassigned" &&
              "border-primary bg-primary/10 ring-2 ring-primary/40",
          )}
          onDragOver={(e) => onTeamDragOver(e, "unassigned")}
          onDragLeave={() => {
            if (dropTargetKey === "unassigned") setDropTargetKey(null);
          }}
          onDrop={(e) => onTeamDrop(e, null)}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Unassigned</CardTitle>
            {canDragAssign ? (
              <CardDescription>
                Drag members onto Blue or Red Team
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent>
            {participants.filter((p) => p.liveTeamId == null).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Everyone is assigned.
              </p>
            ) : (
              <ul className="space-y-1">
                {participants
                  .filter((p) => p.liveTeamId == null)
                  .map((p) => (
                    <li
                      key={p.id}
                      draggable={canDragAssign}
                      onDragStart={(e) => onMemberDragStart(e, p.userId)}
                      onDragEnd={onMemberDragEnd}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-foreground",
                        canDragAssign &&
                          "cursor-grab active:cursor-grabbing hover:bg-muted/40",
                        draggingUserId === p.userId && "opacity-50",
                      )}
                    >
                      {canDragAssign ? (
                        <GripVertical
                          className="size-3.5 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                      ) : null}
                      <span className="truncate">
                        {p.displayName}
                        {p.userId === userId ? " (you)" : ""}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
            {canHost && !session.teamsLocked ? (
              <>
                <Separator className="my-3" />
                <p className="text-xs text-muted-foreground">
                  Drag members onto a team, or use Random teams. Lock teams
                  before starting — unassigned members stay out of the battle.
                </p>
              </>
            ) : null}
            {canHost && session.teamsLocked ? (
              <>
                <Separator className="my-3" />
                <p className="text-xs text-muted-foreground">
                  Teams are locked. Unassigned members will not join any team
                  when the battle starts. Unlock to move people.
                </p>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <LiveClassroomBattleCountdownDialog
        open={
          session.status === "lobby" &&
          (startingBattle || countdownAt != null)
        }
        battleStartsAt={countdownAt}
        deckId={session.deckId}
        deckName={session.deckName}
        teamId={session.teamId}
        liveTeamName={canManage ? null : (selfLiveTeam?.name ?? null)}
        liveTeamColorKey={canManage ? null : (selfLiveTeam?.colorKey ?? null)}
        matchupTeams={matchupTeams}
        onComplete={finishCountdownAndStart}
        onCancel={
          canManage
            ? () => {
                leftLobbyForBattleRef.current = false;
                clearCountdownUi();
                void clearLiveClassroomBattleCountdownAction(sessionId).catch(
                  () => undefined,
                );
              }
            : undefined
        }
      />

      <LiveClassroomRescheduleDialog
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        sessionId={sessionId}
      />

      <AlertDialog open={closeLobbyOpen} onOpenChange={setCloseLobbyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close lobby?</AlertDialogTitle>
            <AlertDialogDescription>
              This ends the lobby without starting a battle. Students will no
              longer be able to join with this code. You can start a new session
              afterward.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                startTransition(() => {
                  void cancelLiveClassroomLobbySessionAction(sessionId)
                    .then(() => {
                      toast.success("Lobby closed");
                      leftLobbyForBattleRef.current = true;
                      window.location.assign(sessionGoneHref);
                    })
                    .catch((err) => {
                      toast.error(
                        err instanceof Error
                          ? err.message
                          : "Could not close lobby",
                      );
                    });
                });
              }}
            >
              Close lobby
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
