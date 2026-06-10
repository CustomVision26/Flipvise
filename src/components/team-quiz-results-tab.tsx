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
import {
  TEAM_ADMIN_PANEL_IDS,
  teamAdminCardClass,
  teamAdminPanelScrollClass,
} from "@/components/team-admin-panel-styles";
import { cn } from "@/lib/utils";

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
  const memberRoleMap = new Map(members.map((m) => [m.userId, m.role]));

  const ownerDisplay = userFieldDisplayById[ownerUserId];
  const ownerName = ownerDisplay?.primaryLine ?? null;
  const ownerEmail = ownerDisplay?.primaryEmail ?? null;

  return (
    <Card className={teamAdminCardClass}>
      <CardHeader className="space-y-2 pb-4">
        <CardTitle
          id={TEAM_ADMIN_PANEL_IDS.quizResults}
          className={cn(
            "flex items-center gap-2 text-base font-medium tracking-tight sm:text-lg",
            teamAdminPanelScrollClass,
          )}
        >
          <ClipboardList className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          Quiz results
        </CardTitle>
        <CardDescription className="text-sm leading-relaxed">
          Saved quiz attempts from members of this workspace, newest first.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {results.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No quiz results saved yet. Members can save results from the quiz screen.
          </p>
        ) : (
          results.map((r) => {
            const display = userFieldDisplayById[r.userId];
            const userName = display?.primaryLine ?? null;
            const userEmail = display?.primaryEmail ?? null;
            const memberLabel = userName ?? userEmail ?? r.userId;

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
                className="flex flex-col gap-4 rounded-lg border border-border/80 bg-background/40 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium text-foreground">{r.deckName}</p>
                    <Badge variant="secondary" className="shrink-0 text-xs font-normal">
                      {memberLabel}
                    </Badge>
                    {memberRole ? (
                      <Badge variant="outline" className="shrink-0 text-xs font-normal text-muted-foreground">
                        {memberRole === "owner"
                          ? "Owner"
                          : memberRole === "team_admin"
                            ? "Admin"
                            : "Member"}
                      </Badge>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="font-semibold tabular-nums text-foreground">
                      {r.percent}%
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <CheckCircle className="size-3.5 text-emerald-500" aria-hidden />
                      {r.correct}/{r.total} correct
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <XCircle className="size-3.5 text-rose-500" aria-hidden />
                      {r.incorrect} incorrect
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <CircleHelp className="size-3.5" aria-hidden />
                      {r.unanswered} unanswered
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {r.total} card{r.total !== 1 ? "s" : ""} · {formatClock(r.elapsedSeconds)} ·{" "}
                    {formatDate(r.savedAt)}
                  </p>
                </div>

                <div className="shrink-0 sm:self-center">
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
