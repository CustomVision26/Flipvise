"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, CircleHelp, ClipboardList } from "lucide-react";
import type { QuizResultRow } from "@/db/queries/quiz-results";
import type { ClerkUserFieldDisplay } from "@/lib/clerk-user-display";
import { ViewQuizResultDialog, type QuizResultSummary } from "@/components/view-quiz-result-dialog";

function formatDate(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatClock(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const mm = Math.floor(clamped / 60).toString().padStart(2, "0");
  const ss = (clamped % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

interface MemberRow {
  userId: string;
  role: string;
}

interface TeamQuizResultsTabProps {
  results: QuizResultRow[];
  teamName: string;
  ownerUserId: string;
  members: MemberRow[];
  userFieldDisplayById: Record<string, ClerkUserFieldDisplay>;
}

export function TeamQuizResultsTab({
  results,
  teamName,
  ownerUserId,
  members,
  userFieldDisplayById,
}: TeamQuizResultsTabProps) {
  // Build a quick role-lookup map: userId → role
  const memberRoleMap = new Map(members.map((m) => [m.userId, m.role]));

  const ownerDisplay = userFieldDisplayById[ownerUserId];
  const ownerName = ownerDisplay?.primaryLine ?? null;
  const ownerEmail = ownerDisplay?.primaryEmail ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="size-5 shrink-0" aria-hidden />
          Member quiz results
        </CardTitle>
        <CardDescription>
          All saved quiz attempts from members of this workspace, newest first.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {results.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No quiz results saved yet. Members can save their results from the quiz result screen.
          </p>
        ) : (
          results.map((r) => {
            const display = userFieldDisplayById[r.userId];
            const userName = display?.primaryLine ?? null;
            const userEmail = display?.primaryEmail ?? null;
            const memberLabel = userName ?? userEmail ?? r.userId;

            const tierColor =
              r.percent >= 90
                ? "text-yellow-500"
                : r.percent >= 50
                  ? "text-blue-400"
                  : "text-purple-400";

            // Resolve member role
            let memberRole: QuizResultSummary["memberRole"] = null;
            if (r.userId === ownerUserId) {
              memberRole = "owner";
            } else {
              const role = memberRoleMap.get(r.userId);
              memberRole =
                role === "team_admin"
                  ? "team_admin"
                  : role === "team_member"
                    ? "team_member"
                    : null;
            }

            const summary: QuizResultSummary = {
              id: r.id,
              deckName: r.deckName,
              correct: r.correct,
              incorrect: r.incorrect,
              unanswered: r.unanswered,
              total: r.total,
              percent: r.percent,
              elapsedSeconds: r.elapsedSeconds,
              savedAt: r.savedAt,
              perCard: r.perCard ?? null,
              userName,
              userEmail,
              teamName,
              memberRole,
              ownerName,
              ownerEmail,
            };

            return (
              <div
                key={r.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card/50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground truncate">{r.deckName}</p>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {memberLabel}
                    </Badge>
                    {memberRole && (
                      <Badge variant="outline" className="shrink-0 text-xs text-muted-foreground">
                        {memberRole === "owner"
                          ? "Owner"
                          : memberRole === "team_admin"
                            ? "Admin"
                            : "Member"}
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className={`font-semibold tabular-nums ${tierColor}`}>
                      {r.percent}%
                    </span>
                    <span className="flex items-center gap-1 text-emerald-500">
                      <CheckCircle className="size-3.5" aria-hidden />
                      {r.correct} / {r.total} correct
                    </span>
                    <span className="flex items-center gap-1 text-rose-500">
                      <XCircle className="size-3.5" aria-hidden />
                      {r.incorrect} incorrect
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <CircleHelp className="size-3.5" aria-hidden />
                      {r.unanswered} unanswered
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {r.total} card{r.total !== 1 ? "s" : ""} &middot;{" "}
                    {formatClock(r.elapsedSeconds)} &middot; {formatDate(r.savedAt)}
                  </p>
                </div>

                <div className="shrink-0">
                  <ViewQuizResultDialog result={summary} />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
