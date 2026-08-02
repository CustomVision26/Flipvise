"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
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
import {
  battleModeLabel,
  sessionTypeLabel,
} from "@/lib/live-classroom-types";
import {
  liveClassroomHostPath,
  liveClassroomPlayPath,
  liveClassroomProjectorPath,
} from "@/lib/live-classroom-url";

type LiveClassroomLobbyProps = {
  sessionId: number;
  userId: string;
  canHost: boolean;
  licensedSeats: number;
};

export function LiveClassroomLobby({
  sessionId,
  userId,
  canHost,
  licensedSeats,
}: LiveClassroomLobbyProps) {
  const router = useRouter();
  const { state, error } = useLiveClassroomRealtime(sessionId);
  const [pending, startTransition] = useTransition();
  const [joined, setJoined] = useState(false);

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
              Copy
            </Button>
            <Badge variant="secondary" className="gap-1">
              <Users className="size-3" aria-hidden />
              {participants.length}/{licensedSeats}
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
        {canHost ? (
          <CardContent className="flex flex-wrap gap-2">
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
            <Button
              type="button"
              disabled={pending || participants.length === 0}
              className="gap-1.5"
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
          </CardContent>
        ) : (
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Waiting for the host to start the battle…
            </p>
          </CardContent>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {teams.map((team) => {
          const members = participants.filter((p) => p.liveTeamId === team.id);
          return (
            <Card
              key={team.id}
              className="border-border/80 bg-card/60 shadow-sm transition-colors"
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{team.name}</CardTitle>
                <CardDescription>
                  {members.length} member{members.length === 1 ? "" : "s"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                {members.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No members yet</p>
                ) : (
                  members.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="truncate text-foreground">
                        {m.displayName}
                        {m.userId === userId ? " (you)" : ""}
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

      <Card className="border-border/80 bg-card/60 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Unassigned</CardTitle>
        </CardHeader>
        <CardContent>
          {participants.filter((p) => p.liveTeamId == null).length === 0 ? (
            <p className="text-sm text-muted-foreground">Everyone is assigned.</p>
          ) : (
            <ul className="space-y-1">
              {participants
                .filter((p) => p.liveTeamId == null)
                .map((p) => (
                  <li key={p.id} className="text-sm text-foreground">
                    {p.displayName}
                    {p.userId === userId ? " (you)" : ""}
                  </li>
                ))}
            </ul>
          )}
          {canHost && !session.teamsLocked ? (
            <>
              <Separator className="my-3" />
              <p className="text-xs text-muted-foreground">
                Use Random teams or start the battle (auto-assigns remaining
                players).
              </p>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
