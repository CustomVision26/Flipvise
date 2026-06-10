"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle,
  XCircle,
  CircleHelp,
  ClipboardList,
  Clock,
  Layers,
} from "lucide-react";
import type { QuizResultRow } from "@/db/queries/quiz-results";
import type { ClerkUserFieldDisplay } from "@/lib/clerk-user-display";
import {
  ViewQuizResultDialog,
  type QuizResultSummary,
} from "@/components/view-quiz-result-dialog";
import {
  TEAM_ADMIN_PANEL_IDS,
  teamAdminActivePanelClass,
  teamAdminActivePanelTitleClass,
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

function scoreToneClass(percent: number): string {
  if (percent >= 80) return "text-emerald-500";
  if (percent >= 50) return "text-amber-500";
  return "text-rose-500";
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

function QuizResultListItem({
  result: r,
  summary,
  memberLabel,
  memberRole,
}: {
  result: QuizResultRow;
  summary: QuizResultSummary;
  memberLabel: string;
  memberRole: QuizResultSummary["memberRole"];
}) {
  return (
    <article className="rounded-xl border border-border/80 bg-background/50 p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4">
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <h3 className="text-base font-semibold leading-snug text-foreground sm:text-lg">
                {r.deckName}
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="max-w-full truncate text-xs font-medium">
                  {memberLabel}
                </Badge>
                {memberRole ? (
                  <Badge
                    variant="outline"
                    className="shrink-0 text-xs font-normal text-muted-foreground"
                  >
                    {memberRole === "owner"
                      ? "Owner"
                      : memberRole === "team_admin"
                        ? "Admin"
                        : "Member"}
                  </Badge>
                ) : null}
              </div>
            </div>
            <p className="shrink-0 text-xs text-muted-foreground sm:text-right">
              {formatDate(r.savedAt)}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
            <p
              className={cn(
                "shrink-0 text-4xl font-bold tabular-nums leading-none sm:text-5xl",
                scoreToneClass(r.percent),
              )}
            >
              {r.percent}%
            </p>
            <div className="min-w-0 flex-1 space-y-1.5">
              <Progress value={r.percent} className="h-2.5 w-full" />
              <p className="text-xs text-muted-foreground">
                {r.correct} of {r.total} cards answered correctly
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-lg border border-border/60 bg-muted/25 px-2 py-3 text-center sm:px-3">
            <div className="flex items-center justify-center gap-1.5 text-emerald-500">
              <CheckCircle className="size-4 shrink-0" aria-hidden />
              <span className="text-xl font-bold tabular-nums sm:text-2xl">{r.correct}</span>
            </div>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-[11px]">
              Correct
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/25 px-2 py-3 text-center sm:px-3">
            <div className="flex items-center justify-center gap-1.5 text-rose-500">
              <XCircle className="size-4 shrink-0" aria-hidden />
              <span className="text-xl font-bold tabular-nums sm:text-2xl">{r.incorrect}</span>
            </div>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-[11px]">
              Incorrect
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/25 px-2 py-3 text-center sm:px-3">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
              <CircleHelp className="size-4 shrink-0" aria-hidden />
              <span className="text-xl font-bold tabular-nums text-foreground sm:text-2xl">
                {r.unanswered}
              </span>
            </div>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-[11px]">
              Unanswered
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Layers className="size-3.5 shrink-0" aria-hidden />
            {r.total} card{r.total !== 1 ? "s" : ""}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5 shrink-0" aria-hidden />
            {formatClock(r.elapsedSeconds)}
          </span>
        </div>

        <Separator className="bg-border/60" />

        <div className="flex justify-stretch sm:justify-end">
          <ViewQuizResultDialog result={summary} triggerLabel="View results" />
        </div>
      </div>
    </article>
  );
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
    <Card className={teamAdminActivePanelClass}>
      <CardHeader className="space-y-2 pb-2 sm:pb-4">
        <CardTitle
          id={TEAM_ADMIN_PANEL_IDS.quizResults}
          className={cn(
            "flex items-center gap-2",
            teamAdminActivePanelTitleClass,
            teamAdminPanelScrollClass,
          )}
        >
          <ClipboardList className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          Quiz results
        </CardTitle>
        <CardDescription className="text-sm leading-relaxed">
          Saved quiz attempts from members of this workspace, newest first.
          {results.length > 0 ? (
            <span className="mt-1 block font-medium text-foreground">
              {results.length} saved attempt{results.length !== 1 ? "s" : ""}
            </span>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-2 sm:space-y-5 sm:pt-0">
        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 bg-muted/15 px-6 py-12 text-center">
            <ClipboardList className="size-10 text-muted-foreground/60" aria-hidden />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">No quiz results yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Members can save results from the quiz screen after studying a deck.
              </p>
            </div>
          </div>
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
              <QuizResultListItem
                key={r.id}
                result={r}
                summary={summary}
                memberLabel={memberLabel}
                memberRole={memberRole}
              />
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
