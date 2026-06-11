"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  grantQuizSecurityRestartAction,
  grantQuizSecurityResumeAction,
  terminateQuizSecuritySessionAction,
} from "@/actions/quiz-security";
import type { QuizSecuritySessionAdminRow } from "@/db/queries/quiz-security";
import type { ClerkUserFieldDisplay } from "@/lib/clerk-user-display";
import { Loader2 } from "lucide-react";

type TeamQuizSecuritySessionsTableProps = {
  teamId: number;
  sessions: QuizSecuritySessionAdminRow[];
  userFieldDisplayById: Record<string, ClerkUserFieldDisplay>;
};

function formatStoppedAt(session: QuizSecuritySessionAdminRow): string {
  const iso = session.terminatedAt ?? session.completedAt ?? session.lockedAt;
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function statusLabel(session: QuizSecuritySessionAdminRow): string {
  switch (session.status) {
    case "granted_resume":
      return session.sessionState == null ? "Redo granted" : "Resume granted";
    case "terminated":
      return "Terminated";
    case "completed":
      return "Completed";
    default:
      return "Locked";
  }
}

export function TeamQuizSecuritySessionsTable({
  teamId,
  sessions,
  userFieldDisplayById,
}: TeamQuizSecuritySessionsTableProps) {
  const [pendingId, setPendingId] = React.useState<number | null>(null);
  const [actionType, setActionType] = React.useState<"grant" | "restart" | "terminate" | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);

  async function handleGrant(sessionId: number) {
    setError(null);
    setPendingId(sessionId);
    setActionType("grant");
    try {
      await grantQuizSecurityResumeAction({ teamId, sessionId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not grant access.");
    } finally {
      setPendingId(null);
      setActionType(null);
    }
  }

  async function handleRestart(sessionId: number) {
    setError(null);
    setPendingId(sessionId);
    setActionType("restart");
    try {
      await grantQuizSecurityRestartAction({ teamId, sessionId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not grant start over.");
    } finally {
      setPendingId(null);
      setActionType(null);
    }
  }

  async function handleTerminate(sessionId: number) {
    setError(null);
    setPendingId(sessionId);
    setActionType("terminate");
    try {
      await terminateQuizSecuritySessionAction({ teamId, sessionId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not terminate session.");
    } finally {
      setPendingId(null);
      setActionType(null);
    }
  }

  if (sessions.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border/80 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
        No sessions need action. When a member leaves a quiz, finishes and needs a redo, or is
        terminated, they appear here.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border/80">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Deck</TableHead>
              <TableHead>Stopped at</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((session) => {
              const display = userFieldDisplayById[session.userId];
              const memberLabel = display?.primaryLine ?? display?.primaryEmail ?? session.userId;
              const isPending = pendingId === session.id;
              const canRestart =
                session.status === "terminated" || session.status === "completed";
              const canTerminate =
                session.status === "locked" || session.status === "granted_resume";
              return (
                <TableRow key={session.id}>
                  <TableCell className="font-medium">{memberLabel}</TableCell>
                  <TableCell>{session.deckName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatStoppedAt(session)}
                  </TableCell>
                  <TableCell className="capitalize text-muted-foreground">
                    {statusLabel(session)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {session.status === "locked" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={isPending}
                          onClick={() => handleGrant(session.id)}
                        >
                          {isPending && actionType === "grant" ? (
                            <Loader2 className="size-3.5 animate-spin" aria-hidden />
                          ) : (
                            "Continue"
                          )}
                        </Button>
                      ) : null}
                      {canRestart ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={isPending}
                          onClick={() => handleRestart(session.id)}
                        >
                          {isPending && actionType === "restart" ? (
                            <Loader2 className="size-3.5 animate-spin" aria-hidden />
                          ) : (
                            "Start over"
                          )}
                        </Button>
                      ) : null}
                      {canTerminate ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={isPending}
                          onClick={() => handleTerminate(session.id)}
                        >
                          {isPending && actionType === "terminate" ? (
                            <Loader2 className="size-3.5 animate-spin" aria-hidden />
                          ) : (
                            "Terminate"
                          )}
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
