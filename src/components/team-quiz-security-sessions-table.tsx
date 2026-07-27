"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

type SessionStatus = QuizSecuritySessionAdminRow["status"];

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

function statusLabel(
  status: SessionStatus,
  sessionState: QuizSecuritySessionAdminRow["sessionState"],
): string {
  switch (status) {
    case "granted_resume":
      return sessionState == null ? "Start over granted" : "Continue granted";
    case "terminated":
      return "Terminated";
    case "completed":
      return "Completed";
    case "locked":
      return "Locked";
    default:
      return "Active";
  }
}

export function TeamQuizSecuritySessionsTable({
  teamId,
  sessions,
  userFieldDisplayById,
}: TeamQuizSecuritySessionsTableProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<number | null>(null);
  const [actionType, setActionType] = React.useState<
    "grant" | "restart" | "terminate" | null
  >(null);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  /** Optimistic status overrides until the server refresh lands. */
  const [statusOverrides, setStatusOverrides] = React.useState<
    Record<number, { status: SessionStatus; clearSessionState?: boolean }>
  >({});

  React.useEffect(() => {
    setStatusOverrides({});
  }, [sessions]);

  async function handleGrant(sessionId: number) {
    setError(null);
    setSuccess(null);
    setPendingId(sessionId);
    setActionType("grant");
    try {
      await grantQuizSecurityResumeAction({ teamId, sessionId });
      setStatusOverrides((prev) => ({
        ...prev,
        [sessionId]: { status: "granted_resume" },
      }));
      setSuccess("Continue granted — the member can resume after Check for access.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not grant access.");
    } finally {
      setPendingId(null);
      setActionType(null);
    }
  }

  async function handleRestart(sessionId: number) {
    setError(null);
    setSuccess(null);
    setPendingId(sessionId);
    setActionType("restart");
    try {
      await grantQuizSecurityRestartAction({ teamId, sessionId });
      setStatusOverrides((prev) => ({
        ...prev,
        [sessionId]: { status: "granted_resume", clearSessionState: true },
      }));
      setSuccess(
        "Start over granted — the member can begin a fresh quiz after Check for access.",
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not grant start over.");
    } finally {
      setPendingId(null);
      setActionType(null);
    }
  }

  async function handleTerminate(sessionId: number) {
    setError(null);
    setSuccess(null);
    setPendingId(sessionId);
    setActionType("terminate");
    try {
      await terminateQuizSecuritySessionAction({ teamId, sessionId });
      setStatusOverrides((prev) => ({
        ...prev,
        [sessionId]: { status: "terminated" },
      }));
      setSuccess("Session terminated.");
      router.refresh();
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
              const memberLabel =
                display?.primaryLine ?? display?.primaryEmail ?? session.userId;
              const isPending = pendingId === session.id;
              const override = statusOverrides[session.id];
              const status = override?.status ?? session.status;
              const sessionState = override?.clearSessionState
                ? null
                : session.sessionState;
              const canRestart = status === "terminated" || status === "completed";
              const canContinue = status === "locked";
              const canTerminate =
                status === "locked" || status === "granted_resume";
              return (
                <TableRow key={session.id}>
                  <TableCell className="font-medium">{memberLabel}</TableCell>
                  <TableCell>{session.deckName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatStoppedAt(session)}
                  </TableCell>
                  <TableCell
                    className={
                      status === "granted_resume"
                        ? "font-medium text-emerald-400"
                        : "text-muted-foreground"
                    }
                  >
                    {statusLabel(status, sessionState)}
                  </TableCell>
                  <TableCell className="text-right">
                    <TooltipProvider>
                      <div className="flex flex-wrap justify-end gap-2">
                        {canContinue ? (
                          <Tooltip>
                            <TooltipTrigger render={<span className="inline-flex" />}>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={isPending}
                                onClick={() => void handleGrant(session.id)}
                              >
                                {isPending && actionType === "grant" ? (
                                  <Loader2
                                    className="size-3.5 animate-spin"
                                    aria-hidden
                                  />
                                ) : (
                                  "Continue"
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Let the member resume their in-progress quiz
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
                        {canRestart ? (
                          <Tooltip>
                            <TooltipTrigger render={<span className="inline-flex" />}>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={isPending}
                                onClick={() => void handleRestart(session.id)}
                              >
                                {isPending && actionType === "restart" ? (
                                  <Loader2
                                    className="size-3.5 animate-spin"
                                    aria-hidden
                                  />
                                ) : (
                                  "Start over"
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Grant a fresh quiz attempt (clears prior progress)
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
                        {canTerminate ? (
                          <Tooltip>
                            <TooltipTrigger render={<span className="inline-flex" />}>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                disabled={isPending}
                                onClick={() => void handleTerminate(session.id)}
                              >
                                {isPending && actionType === "terminate" ? (
                                  <Loader2
                                    className="size-3.5 animate-spin"
                                    aria-hidden
                                  />
                                ) : (
                                  "Terminate"
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              End this member&apos;s Exam Mode session
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
                      </div>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {success ? (
        <p className="text-sm text-emerald-400" role="status">
          {success}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
