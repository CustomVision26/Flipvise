"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Play, RotateCcw, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { scheduleLiveClassroomBattleCountdownAction } from "@/actions/live-classroom";
import {
  deleteLiveClassroomSessionAction,
  openLiveClassroomSessionFromPoolAction,
  restartLiveClassroomSessionAction,
} from "@/actions/live-classroom-session-admin";
import {
  LiveClassroomScheduledCountdown,
  useLiveClassroomScheduleReady,
} from "@/components/live-classroom-scheduled-countdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  battleModeLabel,
  sessionTypeLabel,
  type LiveClassroomBattleMode,
  type LiveClassroomSessionStatus,
  type LiveClassroomSessionType,
} from "@/lib/live-classroom-types";
import {
  liveClassroomHostPath,
  liveClassroomLobbyPath,
  liveClassroomReportPath,
} from "@/lib/live-classroom-url";

export type LiveClassroomSessionListItem = {
  id: number;
  name: string;
  status: LiveClassroomSessionStatus;
  sessionType: LiveClassroomSessionType;
  battleMode: LiveClassroomBattleMode;
  endedAt?: string | null;
  scheduledFor?: string | null;
  createdAt?: string | null;
  deckName?: string | null;
  deckCardCount?: number | null;
  teamsLocked?: boolean;
  /** Members currently assigned to a team in the lobby (excludes Unassigned). */
  assignedMemberCount?: number;
  /** Of the assigned members, how many are connected + presence-fresh. */
  readyMemberCount?: number;
};

type LiveClassroomRecentSessionsListProps = {
  sessions: LiveClassroomSessionListItem[];
  canManage: boolean;
  emptyMessage?: string;
  /** When true, show endedAt in the subtitle (history page). */
  showEndedAt?: boolean;
  /** Sessions Pool: new-session label, countdown, switch-open behavior. */
  poolMode?: boolean;
};

function isNewPoolSession(session: LiveClassroomSessionListItem): boolean {
  return session.status === "lobby" || session.status === "scheduled";
}

function isLivePoolSession(session: LiveClassroomSessionListItem): boolean {
  return session.status === "active" || session.status === "paused";
}

function PoolSessionRow({
  session,
  canManage,
  poolMode,
  showEndedAt,
  busy,
  anotherSessionLive,
  onOpen,
  onRestart,
  onDelete,
  onStartBattle,
}: {
  session: LiveClassroomSessionListItem;
  canManage: boolean;
  poolMode: boolean;
  showEndedAt: boolean;
  busy: boolean;
  anotherSessionLive: boolean;
  onOpen: () => void;
  onRestart: () => void;
  onDelete: () => void;
  onStartBattle: () => void;
}) {
  const scheduleReady = useLiveClassroomScheduleReady(session.scheduledFor);
  const ended =
    session.status === "completed" || session.status === "cancelled";
  const isLive = isLivePoolSession(session);
  const showNew = poolMode && isNewPoolSession(session) && !isLive;
  const showCountdown =
    poolMode &&
    !isLive &&
    session.scheduledFor != null &&
    (session.status === "scheduled" || session.status === "lobby");
  const assignedCount = session.assignedMemberCount ?? 0;
  const readyCount = session.readyMemberCount ?? 0;
  const membersLockedAndReady =
    Boolean(session.teamsLocked) && assignedCount > 0 && readyCount === assignedCount;
  const isStartCandidate =
    poolMode &&
    canManage &&
    !ended &&
    !isLive &&
    !anotherSessionLive &&
    scheduleReady &&
    (session.status === "lobby" || session.status === "scheduled");
  const canStartBattle = isStartCandidate && membersLockedAndReady;
  const showWaitingForReady = isStartCandidate && !membersLockedAndReady;

  const href = ended
    ? liveClassroomReportPath(session.id)
    : isLive
      ? liveClassroomHostPath(session.id)
      : liveClassroomLobbyPath(session.id);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/50 px-3 py-2.5 transition-colors hover:bg-muted/40">
      <div className="min-w-0 flex-1 space-y-1">
        {poolMode && !ended ? (
          <button
            type="button"
            className="block w-full min-w-0 text-left"
            disabled={busy}
            onClick={onOpen}
          >
            <p className="truncate text-sm font-medium text-foreground">
              {showNew ? "New session" : session.name}
              {session.deckName ? (
                <span className="font-normal text-muted-foreground">
                  {" · "}
                  {session.deckName}
                  {session.deckCardCount != null
                    ? ` · ${session.deckCardCount} card${
                        session.deckCardCount === 1 ? "" : "s"
                      }`
                    : ""}
                </span>
              ) : null}
            </p>
            <p className="text-xs text-muted-foreground">
              {showNew ? `${session.name} · ` : null}
              {sessionTypeLabel(session.sessionType)} ·{" "}
              {battleModeLabel(session.battleMode)}
            </p>
          </button>
        ) : (
          <Link href={href} className="block min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {session.name}
              {session.deckName ? (
                <span className="font-normal text-muted-foreground">
                  {" · "}
                  {session.deckName}
                  {session.deckCardCount != null
                    ? ` · ${session.deckCardCount} card${
                        session.deckCardCount === 1 ? "" : "s"
                      }`
                    : ""}
                </span>
              ) : null}
            </p>
            <p className="text-xs text-muted-foreground">
              {sessionTypeLabel(session.sessionType)} ·{" "}
              {battleModeLabel(session.battleMode)}
              {showEndedAt && session.endedAt
                ? ` · ${new Date(session.endedAt).toLocaleString()}`
                : ""}
            </p>
          </Link>
        )}
        {showCountdown && session.scheduledFor ? (
          <LiveClassroomScheduledCountdown
            scheduledFor={session.scheduledFor}
            showDate
          />
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {poolMode && !ended ? (
          isLive ? (
            <Button type="button" size="sm" disabled={busy} onClick={onOpen}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Host
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={onOpen}
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Lobby
            </Button>
          )
        ) : null}
        {canStartBattle ? (
          <Button type="button" size="sm" disabled={busy} onClick={onStartBattle}>
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5" aria-hidden />
            )}
            Start battle
          </Button>
        ) : showWaitingForReady ? (
          <Badge
            variant="outline"
            className="gap-1 text-xs text-muted-foreground"
            title={
              !session.teamsLocked
                ? "Lock teams in the lobby to enable Start battle."
                : assignedCount === 0
                  ? "No members assigned to a team yet."
                  : `Waiting for members to be ready (${readyCount}/${assignedCount}).`
            }
          >
            <Users className="size-3" aria-hidden />
            {!session.teamsLocked
              ? "Teams not locked"
              : assignedCount === 0
                ? "No members yet"
                : `${readyCount}/${assignedCount} ready`}
          </Badge>
        ) : null}
        {canManage ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={busy}
              onClick={onRestart}
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RotateCcw className="size-3.5" aria-hidden />
              )}
              Restart
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5 text-destructive hover:text-destructive"
              disabled={busy}
              onClick={onDelete}
            >
              <Trash2 className="size-3.5" aria-hidden />
              Delete
            </Button>
          </>
        ) : null}
        {isLive ? (
          <Badge>Live</Badge>
        ) : showNew ? (
          <Badge variant="outline">New session</Badge>
        ) : (
          <Badge variant="outline" className="capitalize">
            {session.status}
          </Badge>
        )}
      </div>
    </div>
  );
}

export function LiveClassroomRecentSessionsList({
  sessions,
  canManage,
  emptyMessage = "No sessions yet. Start one to open a lobby.",
  showEndedAt = false,
  poolMode = false,
}: LiveClassroomRecentSessionsListProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  function restart(sessionId: number) {
    setPendingId(sessionId);
    startTransition(async () => {
      try {
        await restartLiveClassroomSessionAction(sessionId);
        toast.success("Session restarted — lobby is open");
        router.push(liveClassroomLobbyPath(sessionId));
        router.refresh();
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not restart session",
        );
      } finally {
        setPendingId(null);
      }
    });
  }

  function confirmDelete() {
    if (deleteId == null) return;
    const sessionId = deleteId;
    setDeleteId(null);
    setPendingId(sessionId);
    startTransition(async () => {
      try {
        await deleteLiveClassroomSessionAction(sessionId);
        toast.success("Session deleted");
        router.refresh();
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not delete session",
        );
      } finally {
        setPendingId(null);
      }
    });
  }

  function openFromPool(session: LiveClassroomSessionListItem) {
    if (session.status === "completed" || session.status === "cancelled") {
      router.push(liveClassroomReportPath(session.id));
      return;
    }
    setPendingId(session.id);
    startTransition(async () => {
      try {
        const result = await openLiveClassroomSessionFromPoolAction(session.id);
        if (result.closedOther) {
          toast.message("Closed the other open session, then opened this one.");
        }
        router.push(
          result.status === "active" || result.status === "paused"
            ? liveClassroomHostPath(result.sessionId)
            : liveClassroomLobbyPath(result.sessionId),
        );
        router.refresh();
      } catch (e) {
        // The list can be a stale snapshot — the battle may have finished
        // (all questions answered / lives ran out) since this page loaded.
        if (e instanceof Error && /already ended/i.test(e.message)) {
          toast.message("That battle already finished — opening its report.");
          router.push(liveClassroomReportPath(session.id));
          router.refresh();
          return;
        }
        toast.error(
          e instanceof Error ? e.message : "Could not open session",
        );
        router.refresh();
      } finally {
        setPendingId(null);
      }
    });
  }

  function startBattleFromPool(session: LiveClassroomSessionListItem) {
    setPendingId(session.id);
    startTransition(async () => {
      try {
        const opened = await openLiveClassroomSessionFromPoolAction(session.id);
        if (opened.closedOther) {
          toast.message("Closed the other open session, then opened this one.");
        }
        const result = await scheduleLiveClassroomBattleCountdownAction(
          session.id,
        );
        if (result.alreadyActive) {
          router.push(liveClassroomHostPath(session.id));
          router.refresh();
          return;
        }
        toast.success("Countdown started");
        router.push(liveClassroomLobbyPath(session.id));
        router.refresh();
      } catch (e) {
        if (e instanceof Error && /already ended/i.test(e.message)) {
          toast.message("That battle already finished — opening its report.");
          router.push(liveClassroomReportPath(session.id));
          router.refresh();
          return;
        }
        toast.error(
          e instanceof Error ? e.message : "Could not start battle",
        );
        router.push(liveClassroomLobbyPath(session.id));
      } finally {
        setPendingId(null);
      }
    });
  }

  if (sessions.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const deleteTarget = sessions.find((s) => s.id === deleteId);
  const hasLiveSession = sessions.some(isLivePoolSession);

  return (
    <>
      <div className="space-y-2">
        {sessions.map((session) => (
          <PoolSessionRow
            key={session.id}
            session={session}
            canManage={canManage}
            poolMode={poolMode}
            showEndedAt={showEndedAt}
            busy={pending && pendingId === session.id}
            anotherSessionLive={
              hasLiveSession && !isLivePoolSession(session)
            }
            onOpen={() => openFromPool(session)}
            onRestart={() => restart(session.id)}
            onDelete={() => setDeleteId(session.id)}
            onStartBattle={() => startBattleFromPool(session)}
          />
        ))}
      </div>

      <AlertDialog
        open={deleteId != null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete session?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes
              {deleteTarget ? ` “${deleteTarget.name}”` : " this session"} and
              its battle data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
