"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle,
  XCircle,
  CircleHelp,
  ClipboardList,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Trash2,
} from "lucide-react";
import type { QuizResultRow } from "@/db/queries/quiz-results";
import type { TeamMemberRow } from "@/db/schema";
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
import { TeamQuizResultsSubTabs } from "@/components/team-quiz-results-sub-tabs";
import { deleteQuizResultAction } from "@/actions/quiz-results";
import { cn } from "@/lib/utils";

export type TeamQuizWorkspaceSnapshot = {
  teamId: number;
  teamName: string;
  ownerUserId: string;
  members: TeamMemberRow[];
  results: QuizResultRow[];
};

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

function memberRoleLabel(role: QuizResultSummary["memberRole"]): string | null {
  if (role === "owner") return "Owner";
  if (role === "team_admin") return "Admin";
  if (role === "team_member") return "Member";
  return null;
}

function memberInitials(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  if (trimmed.includes("@")) {
    return trimmed.slice(0, 2).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

function workspaceInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

function memberKey(teamId: number, userId: string): string {
  return `${teamId}:${userId}`;
}

interface TeamQuizResultsTabProps {
  workspaces: TeamQuizWorkspaceSnapshot[];
  userFieldDisplayById: Record<string, ClerkUserFieldDisplay>;
  quizResultsHref: string;
  quizTimerHref: string;
  quizSecurityHref: string;
}

type MemberQuizResultGroup = {
  userId: string;
  memberLabel: string;
  memberEmail: string | null;
  memberRole: QuizResultSummary["memberRole"];
  attempts: Array<{ result: QuizResultRow; summary: QuizResultSummary }>;
};

type WorkspaceQuizResultGroup = {
  teamId: number;
  teamName: string;
  ownerUserId: string;
  memberGroups: MemberQuizResultGroup[];
  attemptCount: number;
};

function DeleteQuizResultButton({
  resultId,
  teamId,
  deckName,
}: {
  resultId: number;
  teamId: number;
  deckName: string;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);

  async function handleDelete() {
    setIsPending(true);
    try {
      await deleteQuizResultAction({ resultId, teamId });
      router.refresh();
    } catch {
      // UI refresh on success only
    } finally {
      setIsPending(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
            disabled={isPending}
          />
        }
      >
        <Trash2 className="size-3.5" aria-hidden />
        Delete
      </AlertDialogTrigger>
      <AlertDialogContent className="mx-4 w-[calc(100vw-2rem)] max-w-md sm:mx-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base sm:text-lg">Delete quiz result?</AlertDialogTitle>
          <AlertDialogDescription className="text-xs sm:text-sm">
            This will permanently remove the saved result for &ldquo;{deckName}&rdquo;. This action
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
          <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={handleDelete}
            className="w-full sm:w-auto"
          >
            {isPending ? "Deleting…" : "Delete result"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function QuizResultListItem({
  result: r,
  summary,
  teamId,
}: {
  result: QuizResultRow;
  summary: QuizResultSummary;
  teamId: number;
}) {
  return (
    <article className="rounded-lg border border-border/70 bg-card/40 p-3.5 sm:p-4">
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-0.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Deck
            </p>
            <h4 className="text-sm font-semibold leading-snug text-foreground sm:text-base">
              {r.deckName}
            </h4>
          </div>
          <p className="shrink-0 text-xs text-muted-foreground sm:text-right">
            {formatDate(r.savedAt)}
          </p>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
          <p
            className={cn(
              "shrink-0 text-3xl font-semibold tabular-nums leading-none sm:text-4xl",
              scoreToneClass(r.percent),
            )}
          >
            {r.percent}%
          </p>
          <div className="min-w-0 flex-1 space-y-1">
            <Progress value={r.percent} className="h-2 w-full" />
            <p className="text-xs text-muted-foreground">
              {r.correct} of {r.total} answered correctly
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md border border-border/60 bg-muted/20 px-2 py-2.5 text-center">
            <div className="flex items-center justify-center gap-1 text-emerald-500">
              <CheckCircle className="size-3.5 shrink-0" aria-hidden />
              <span className="text-lg font-semibold tabular-nums">{r.correct}</span>
            </div>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Correct
            </p>
          </div>
          <div className="rounded-md border border-border/60 bg-muted/20 px-2 py-2.5 text-center">
            <div className="flex items-center justify-center gap-1 text-rose-500">
              <XCircle className="size-3.5 shrink-0" aria-hidden />
              <span className="text-lg font-semibold tabular-nums">{r.incorrect}</span>
            </div>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Incorrect
            </p>
          </div>
          <div className="rounded-md border border-border/60 bg-muted/20 px-2 py-2.5 text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              <CircleHelp className="size-3.5 shrink-0" aria-hidden />
              <span className="text-lg font-semibold tabular-nums text-foreground">
                {r.unanswered}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Skipped
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Layers className="size-3.5 shrink-0" aria-hidden />
              {r.total} card{r.total !== 1 ? "s" : ""}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5 shrink-0" aria-hidden />
              {formatClock(r.elapsedSeconds)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ViewQuizResultDialog result={summary} triggerLabel="View details" />
            <DeleteQuizResultButton resultId={r.id} teamId={teamId} deckName={r.deckName} />
          </div>
        </div>
      </div>
    </article>
  );
}

function MemberQuizResultsGroup({
  group,
  teamId,
  expanded,
  onToggle,
}: {
  group: MemberQuizResultGroup;
  teamId: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const latest = group.attempts[0]?.result;
  const roleLabel = memberRoleLabel(group.memberRole);
  const showEmail =
    group.memberEmail &&
    group.memberEmail !== group.memberLabel &&
    !group.memberLabel.includes("@");

  const collapsedSummary = latest
    ? `Latest: ${latest.deckName} · ${latest.percent}% · ${formatDate(latest.savedAt)}`
    : null;

  return (
    <section className="overflow-hidden rounded-lg border border-border/70 bg-card/20">
      <Button
        type="button"
        variant="ghost"
        className="h-auto w-full justify-between gap-3 rounded-none px-3 py-3 text-left hover:bg-muted/30 sm:px-4"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Avatar className="mt-0.5 size-8 bg-muted/60">
            <AvatarFallback className="bg-muted/80 text-xs font-semibold text-foreground">
              {memberInitials(group.memberLabel)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold text-foreground">
                {group.memberLabel}
              </span>
              {roleLabel ? (
                <Badge
                  variant="outline"
                  className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {roleLabel}
                </Badge>
              ) : null}
              <Badge variant="secondary" className="shrink-0 text-[10px] font-medium tabular-nums">
                {group.attempts.length} attempt{group.attempts.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            {showEmail ? (
              <p className="truncate text-xs text-muted-foreground">{group.memberEmail}</p>
            ) : null}
            {!expanded && collapsedSummary ? (
              <p className="line-clamp-2 text-xs text-muted-foreground">{collapsedSummary}</p>
            ) : null}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
      </Button>

      {expanded ? (
        <div className="space-y-2.5 border-t border-border/60 bg-muted/10 px-3 py-3 sm:space-y-3 sm:px-4 sm:py-4">
          {group.attempts.map(({ result, summary }) => (
            <QuizResultListItem
              key={result.id}
              result={result}
              summary={summary}
              teamId={teamId}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function WorkspaceQuizResultsGroup({
  group,
  expanded,
  onToggle,
  expandedMemberKeys,
  onToggleMember,
}: {
  group: WorkspaceQuizResultGroup;
  expanded: boolean;
  onToggle: () => void;
  expandedMemberKeys: Set<string>;
  onToggleMember: (key: string) => void;
}) {
  const latest = group.memberGroups[0]?.attempts[0]?.result;
  const collapsedSummary = latest
    ? `${group.memberGroups.length} member${group.memberGroups.length !== 1 ? "s" : ""} · ${group.attemptCount} attempt${group.attemptCount !== 1 ? "s" : ""} · Latest: ${latest.deckName} (${latest.percent}%)`
    : `${group.memberGroups.length} member${group.memberGroups.length !== 1 ? "s" : ""} · ${group.attemptCount} attempt${group.attemptCount !== 1 ? "s" : ""}`;

  return (
    <section className="overflow-hidden rounded-xl border border-border/80 bg-card/30 shadow-sm">
      <Button
        type="button"
        variant="ghost"
        className="h-auto w-full justify-between gap-3 rounded-none px-3 py-3 text-left hover:bg-muted/30 sm:px-4 sm:py-3.5"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Avatar className="mt-0.5 size-9 bg-primary/10">
            <AvatarFallback className="bg-primary/15 text-xs font-semibold text-foreground">
              {workspaceInitials(group.teamName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <LayoutGrid className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate text-sm font-semibold text-foreground sm:text-base">
                {group.teamName}
              </span>
              <Badge variant="secondary" className="shrink-0 text-[10px] font-medium tabular-nums">
                {group.attemptCount} attempt{group.attemptCount !== 1 ? "s" : ""}
              </Badge>
            </div>
            {!expanded ? (
              <p className="line-clamp-2 text-xs text-muted-foreground">{collapsedSummary}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {group.memberGroups.length} member{group.memberGroups.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
      </Button>

      {expanded ? (
        <div className="space-y-2.5 border-t border-border/60 bg-muted/10 px-3 py-3 sm:space-y-3 sm:px-4 sm:py-4">
          {group.memberGroups.map((memberGroup) => {
            const key = memberKey(group.teamId, memberGroup.userId);
            return (
              <MemberQuizResultsGroup
                key={key}
                group={memberGroup}
                teamId={group.teamId}
                expanded={expandedMemberKeys.has(key)}
                onToggle={() => onToggleMember(key)}
              />
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function buildMemberGroups(
  results: QuizResultRow[],
  options: {
    teamId: number;
    teamName: string;
    ownerUserId: string;
    memberRoleMap: Map<string, string>;
    userFieldDisplayById: Record<string, ClerkUserFieldDisplay>;
    ownerName: string | null;
    ownerEmail: string | null;
  },
): MemberQuizResultGroup[] {
  const grouped = new Map<string, MemberQuizResultGroup>();

  for (const r of results) {
    const display = options.userFieldDisplayById[r.userId];
    const userName = display?.primaryLine ?? null;
    const userEmail = display?.primaryEmail ?? null;
    const memberLabel = userName ?? userEmail ?? r.userId;

    let memberRole: QuizResultSummary["memberRole"] = null;
    if (r.userId === options.ownerUserId) {
      memberRole = "owner";
    } else {
      const role = options.memberRoleMap.get(r.userId);
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
      teamName: options.teamName,
      memberRole,
      ownerName: options.ownerName,
      ownerEmail: options.ownerEmail,
    };

    const existing = grouped.get(r.userId);
    if (existing) {
      existing.attempts.push({ result: r, summary });
    } else {
      grouped.set(r.userId, {
        userId: r.userId,
        memberLabel,
        memberEmail: userEmail,
        memberRole,
        attempts: [{ result: r, summary }],
      });
    }
  }

  return [...grouped.values()].sort((a, b) => {
    const aLatest = new Date(a.attempts[0]?.result.savedAt ?? 0).getTime();
    const bLatest = new Date(b.attempts[0]?.result.savedAt ?? 0).getTime();
    return bLatest - aLatest;
  });
}

function buildWorkspaceGroups(
  workspaces: TeamQuizWorkspaceSnapshot[],
  userFieldDisplayById: Record<string, ClerkUserFieldDisplay>,
): WorkspaceQuizResultGroup[] {
  return workspaces
    .filter((workspace) => workspace.results.length > 0)
    .map((workspace) => {
      const ownerDisplay = userFieldDisplayById[workspace.ownerUserId];
      const memberRoleMap = new Map(workspace.members.map((m) => [m.userId, m.role]));
      const memberGroups = buildMemberGroups(workspace.results, {
        teamId: workspace.teamId,
        teamName: workspace.teamName,
        ownerUserId: workspace.ownerUserId,
        memberRoleMap,
        userFieldDisplayById,
        ownerName: ownerDisplay?.primaryLine ?? null,
        ownerEmail: ownerDisplay?.primaryEmail ?? null,
      });

      return {
        teamId: workspace.teamId,
        teamName: workspace.teamName,
        ownerUserId: workspace.ownerUserId,
        memberGroups,
        attemptCount: workspace.results.length,
      };
    })
    .sort((a, b) => {
      const aLatest = new Date(
        a.memberGroups[0]?.attempts[0]?.result.savedAt ?? 0,
      ).getTime();
      const bLatest = new Date(
        b.memberGroups[0]?.attempts[0]?.result.savedAt ?? 0,
      ).getTime();
      return bLatest - aLatest;
    });
}

export function TeamQuizResultsTab({
  workspaces,
  userFieldDisplayById,
  quizResultsHref,
  quizTimerHref,
  quizSecurityHref,
}: TeamQuizResultsTabProps) {
  const workspaceGroups = React.useMemo(
    () => buildWorkspaceGroups(workspaces, userFieldDisplayById),
    [workspaces, userFieldDisplayById],
  );

  const totalAttempts = workspaceGroups.reduce((sum, g) => sum + g.attemptCount, 0);
  const totalMembers = workspaceGroups.reduce((sum, g) => sum + g.memberGroups.length, 0);

  const [expandedWorkspaceIds, setExpandedWorkspaceIds] = React.useState<Set<number>>(
    new Set(),
  );
  const [expandedMemberKeys, setExpandedMemberKeys] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    setExpandedWorkspaceIds(new Set(workspaceGroups.map((g) => g.teamId)));
    const memberKeys = workspaceGroups.flatMap((g) =>
      g.memberGroups.map((m) => memberKey(g.teamId, m.userId)),
    );
    setExpandedMemberKeys(new Set(memberKeys));
  }, [workspaceGroups]);

  const allWorkspacesExpanded =
    workspaceGroups.length > 0 &&
    workspaceGroups.every((g) => expandedWorkspaceIds.has(g.teamId));

  function toggleWorkspace(teamId: number) {
    setExpandedWorkspaceIds((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  }

  function toggleMember(key: string) {
    setExpandedMemberKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function setAllExpanded(expanded: boolean) {
    if (expanded) {
      setExpandedWorkspaceIds(new Set(workspaceGroups.map((g) => g.teamId)));
      setExpandedMemberKeys(
        new Set(
          workspaceGroups.flatMap((g) =>
            g.memberGroups.map((m) => memberKey(g.teamId, m.userId)),
          ),
        ),
      );
      return;
    }
    setExpandedWorkspaceIds(new Set());
    setExpandedMemberKeys(new Set());
  }

  return (
    <div className="space-y-4">
      <TeamQuizResultsSubTabs
        quizResultsHref={quizResultsHref}
        quizTimerHref={quizTimerHref}
        quizSecurityHref={quizSecurityHref}
      />
      <Card className={teamAdminActivePanelClass}>
        <CardHeader className="space-y-3 pb-2 sm:pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
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
                Saved attempts grouped by workspace and member. Expand a row to review each quiz.
                {totalAttempts > 0 ? (
                  <span className="mt-1 block font-medium text-foreground">
                    {totalAttempts} attempt{totalAttempts !== 1 ? "s" : ""} ·{" "}
                    {workspaceGroups.length} workspace
                    {workspaceGroups.length !== 1 ? "s" : ""} · {totalMembers} member
                    {totalMembers !== 1 ? "s" : ""}
                  </span>
                ) : null}
              </CardDescription>
            </div>
            {workspaceGroups.length > 0 ? (
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setAllExpanded(!allWorkspacesExpanded)}
                >
                  {allWorkspacesExpanded ? "Collapse all" : "Expand all"}
                </Button>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0 sm:space-y-4">
          {totalAttempts === 0 ? (
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
            workspaceGroups.map((group) => (
              <WorkspaceQuizResultsGroup
                key={group.teamId}
                group={group}
                expanded={expandedWorkspaceIds.has(group.teamId)}
                onToggle={() => toggleWorkspace(group.teamId)}
                expandedMemberKeys={expandedMemberKeys}
                onToggleMember={toggleMember}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
