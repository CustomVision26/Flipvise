"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteLiveClassroomSessionAction,
  restartLiveClassroomSessionAction,
} from "@/actions/live-classroom-session-admin";
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
};

type LiveClassroomRecentSessionsListProps = {
  sessions: LiveClassroomSessionListItem[];
  canManage: boolean;
  emptyMessage?: string;
  /** When true, show endedAt in the subtitle (history page). */
  showEndedAt?: boolean;
};

export function LiveClassroomRecentSessionsList({
  sessions,
  canManage,
  emptyMessage = "No sessions yet. Start one to open a lobby.",
  showEndedAt = false,
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

  if (sessions.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const deleteTarget = sessions.find((s) => s.id === deleteId);

  return (
    <>
      <div className="space-y-2">
        {sessions.map((session) => {
          const href =
            session.status === "completed" || session.status === "cancelled"
              ? liveClassroomReportPath(session.id)
              : liveClassroomLobbyPath(session.id);
          const busy = pending && pendingId === session.id;
          return (
            <div
              key={session.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/50 px-3 py-2.5 transition-colors hover:bg-muted/40"
            >
              <Link href={href} className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {session.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {sessionTypeLabel(session.sessionType)} ·{" "}
                  {battleModeLabel(session.battleMode)}
                  {showEndedAt && session.endedAt
                    ? ` · ${new Date(session.endedAt).toLocaleString()}`
                    : ""}
                </p>
              </Link>
              <div className="flex flex-wrap items-center gap-2">
                {canManage ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={busy}
                      onClick={() => restart(session.id)}
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
                      onClick={() => setDeleteId(session.id)}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      Delete
                    </Button>
                  </>
                ) : null}
                <Badge variant="outline" className="capitalize">
                  {session.status}
                </Badge>
              </div>
            </div>
          );
        })}
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
