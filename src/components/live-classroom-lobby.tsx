"use client";

import {
  useEffect,
  useState,
  useTransition,
  type DragEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
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
  heartbeatLiveClassroomAction,
  joinLiveClassroomSessionAction,
  startLiveClassroomBattleAction,
  updateLobbyTeamAction,
} from "@/actions/live-classroom";
import { useLiveClassroomRealtime } from "@/components/live-classroom-realtime-poller";
import {
  LiveClassroomSessionSettingsDialog,
  type LiveClassroomWorkspaceMemberOption,
} from "@/components/live-classroom-session-settings-dialog";
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
  sessionTypeLabel,
} from "@/lib/live-classroom-types";
import {
  liveClassroomHostPath,
  liveClassroomPlayPath,
  liveClassroomProjectorPath,
} from "@/lib/live-classroom-url";

const LC_MEMBER_DRAG_MIME = "application/x-flipvise-lc-member";

type LiveClassroomLobbyProps = {
  sessionId: number;
  userId: string;
  ownerUserId: string;
  canHost: boolean;
  /** Owner or team admin — can see unassigned roster and drag members onto teams. */
  canManage: boolean;
  licensedSeats: number;
  workspaceMembers?: LiveClassroomWorkspaceMemberOption[];
  assignedUserIds?: string[];
};

export function LiveClassroomLobby({
  sessionId,
  userId,
  ownerUserId,
  canHost,
  canManage,
  workspaceMembers = [],
  assignedUserIds = [],
}: LiveClassroomLobbyProps) {
  const router = useRouter();
  const { state, error, setState } = useLiveClassroomRealtime(sessionId);
  const [pending, startTransition] = useTransition();
  const [joined, setJoined] = useState(false);
  const [draggingUserId, setDraggingUserId] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);

  useEffect(() => {
    void joinLiveClassroomSessionAction({ sessionId })
      .then(() => setJoined(true))
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Could not join lobby");
      });
  }, [sessionId]);

  useEffect(() => {
    if (!joined) return;
    const id = window.setInterval(() => {
      void heartbeatLiveClassroomAction(sessionId).catch(() => undefined);
    }, 8000);
    return () => window.clearInterval(id);
  }, [joined, sessionId]);

  useEffect(() => {
    if (!state) return;
    if (state.session.status === "active" || state.session.status === "paused") {
      if (canHost && state.session.hostUserId === userId) {
        router.push(liveClassroomHostPath(sessionId));
      } else {
        router.push(liveClassroomPlayPath(sessionId));
      }
    }
  }, [state, canHost, userId, sessionId, router]);

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
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading lobby…
        {error ? <span className="text-destructive">{error}</span> : null}
      </div>
    );
  }

  const { session, teams, participants } = state;
  const lcAccessUserIds = new Set<string>([ownerUserId, ...assignedUserIds]);
  const lcAccessTotal = lcAccessUserIds.size;
  const lcAccessInLobby = participants.filter((p) =>
    lcAccessUserIds.has(p.userId),
  ).length;

  return (
    <div className="space-y-4">
      <Card className="border-border/80 bg-card/60 shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl tracking-tight">{session.name}</CardTitle>
            <CardDescription>
              {sessionTypeLabel(session.sessionType)} ·{" "}
              {battleModeLabel(session.battleMode)}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canHost ? (
              <LiveClassroomSessionSettingsDialog
                sessionId={sessionId}
                canHost={canHost}
                teamsLocked={session.teamsLocked}
                ownerUserId={ownerUserId}
                session={{
                  name: session.name,
                  sessionType: session.sessionType,
                  battleMode: session.battleMode,
                  config: session.config,
                }}
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
            <Badge variant="outline" className="font-mono text-base tracking-widest">
              {session.joinCode}
            </Badge>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
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
            <Button
              type="button"
              disabled={pending}
              variant="outline"
              className="gap-1.5"
              onClick={() =>
                run(
                  session.teamsLocked ? "Teams unlocked" : "Teams locked",
                  () =>
                    updateLobbyTeamAction({
                      sessionId,
                      liveTeamId: teams[0]?.id ?? 0,
                      lockTeams: !session.teamsLocked,
                    }),
                )
              }
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
                <Button
                  type="button"
                  disabled={
                    pending ||
                    participants.length === 0 ||
                    !session.teamsLocked
                  }
                  className="gap-1.5"
                  title={
                    session.teamsLocked
                      ? "Start the battle"
                      : "Lock teams before starting the battle"
                  }
                  onClick={() =>
                    run("Battle started", async () => {
                      await startLiveClassroomBattleAction(sessionId);
                      router.push(liveClassroomHostPath(sessionId));
                    })
                  }
                >
                  {pending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Play className="size-3.5" aria-hidden />
                  )}
                  Start battle
                </Button>
                {session.teamsLocked ? (
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
                    title="Lock teams before opening the projector"
                  >
                    Open projector
                  </Button>
                )}
              </>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Waiting for the host to start the battle…
          </p>
        )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {teams.map((team) => {
          const members = participants.filter((p) => p.liveTeamId === team.id);
          const targetKey = `team:${team.id}`;
          const isDropTarget = dropTargetKey === targetKey;
          return (
            <Card
              key={team.id}
              className={cn(
                "border-border/80 bg-card/60 shadow-sm transition-colors",
                canDragAssign && "min-h-36",
                isDropTarget &&
                  "border-primary bg-primary/10 ring-2 ring-primary/40",
              )}
              onDragOver={(e) => onTeamDragOver(e, targetKey)}
              onDragLeave={() => {
                if (dropTargetKey === targetKey) setDropTargetKey(null);
              }}
              onDrop={(e) => onTeamDrop(e, team.id)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{team.name}</CardTitle>
                <CardDescription>
                  {members.length} member{members.length === 1 ? "" : "s"}
                  {canDragAssign
                    ? " · Drop members here"
                    : canManage && session.teamsLocked
                      ? " · Teams locked"
                      : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
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
                        "flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-sm",
                        canDragAssign &&
                          "cursor-grab active:cursor-grabbing hover:bg-muted/40",
                        draggingUserId === m.userId && "opacity-50",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-1.5 truncate text-foreground">
                        {canDragAssign ? (
                          <GripVertical
                            className="size-3.5 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                        ) : null}
                        <span className="truncate">
                          {m.displayName}
                          {m.userId === userId ? " (you)" : ""}
                        </span>
                      </span>
                      <Badge
                        variant={m.connected ? "default" : "outline"}
                        className="text-[10px]"
                      >
                        {m.connected ? "Online" : "Away"}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

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
                  Drag members onto a team, or use Random teams / start battle
                  (auto-assigns remaining players).
                </p>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
