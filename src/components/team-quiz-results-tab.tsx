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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ClipboardList,
  ChevronDown,
  Eye,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { QuizResultRow } from "@/db/queries/quiz-results";
import type { TeamMemberRow } from "@/db/schema";
import type { ClerkUserFieldDisplay } from "@/lib/clerk-user-display";
import {
  QuizResultDetailView,
  type QuizResultSummary,
} from "@/components/quiz-result-detail-view";
import {
  TEAM_ADMIN_PANEL_IDS,
  teamAdminActivePanelClass,
  teamAdminActivePanelTitleClass,
  teamAdminPanelScrollClass,
} from "@/components/team-admin-panel-styles";
import { TeamQuizResultsSubTabs } from "@/components/team-quiz-results-sub-tabs";
import { deleteQuizResultAction } from "@/actions/quiz-results";
import {
  QuizResultSheetsDialog,
  type QuizResultSheetsDialogRow,
} from "@/components/quiz-result-sheets-dialog";
import { cn } from "@/lib/utils";

export type TeamQuizWorkspaceSnapshot = {
  teamId: number;
  teamName: string;
  ownerUserId: string;
  planSlug: string;
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

interface TeamQuizResultsTabProps {
  workspaces: TeamQuizWorkspaceSnapshot[];
  userFieldDisplayById: Record<string, ClerkUserFieldDisplay>;
  quizResultsHref: string;
  quizTimerHref: string;
  quizScheduleHref: string;
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
  planSlug: string;
  memberGroups: MemberQuizResultGroup[];
  attemptCount: number;
};

type QuizResultTableRow = {
  key: string;
  teamId: number;
  teamName: string;
  workspacePlanSlug: string;
  memberLabel: string;
  memberEmail: string | null;
  memberRole: QuizResultSummary["memberRole"];
  result: QuizResultRow;
  summary: QuizResultSummary;
};

function flattenToTableRows(groups: WorkspaceQuizResultGroup[]): QuizResultTableRow[] {
  const rows: QuizResultTableRow[] = [];
  for (const workspace of groups) {
    for (const member of workspace.memberGroups) {
      for (const { result, summary } of member.attempts) {
        rows.push({
          key: `${workspace.teamId}:${result.id}`,
          teamId: workspace.teamId,
          teamName: workspace.teamName,
          workspacePlanSlug: workspace.planSlug,
          memberLabel: member.memberLabel,
          memberEmail: member.memberEmail,
          memberRole: member.memberRole,
          result,
          summary,
        });
      }
    }
  }
  return rows.sort(
    (a, b) => new Date(b.result.savedAt).getTime() - new Date(a.result.savedAt).getTime(),
  );
}

function QuizResultsTable({
  rows,
  showWorkspaceColumn,
  activeResultId,
  deletingKey,
  onView,
  onDelete,
  onOpenSheets,
}: {
  rows: QuizResultTableRow[];
  showWorkspaceColumn: boolean;
  activeResultId: number | null;
  deletingKey: string | null;
  onView: (row: QuizResultTableRow) => void;
  onDelete: (row: QuizResultTableRow) => void;
  onOpenSheets: (row: QuizResultTableRow) => void;
}) {
  return (
    <div className="rounded-lg border border-border/80">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {showWorkspaceColumn ? (
              <TableHead className="min-w-[10rem]">Workspace</TableHead>
            ) : null}
            <TableHead className="min-w-[9rem]">Member</TableHead>
            <TableHead className="min-w-[10rem]">Email</TableHead>
            <TableHead className="min-w-[9rem]">Deck</TableHead>
            <TableHead className="text-right">Score</TableHead>
            <TableHead className="hidden text-right md:table-cell">Correct</TableHead>
            <TableHead className="hidden text-right md:table-cell">Wrong</TableHead>
            <TableHead className="hidden text-right lg:table-cell">Skipped</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Cards</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Time</TableHead>
            <TableHead className="min-w-[9rem]">Saved</TableHead>
            <TableHead className="min-w-[11rem] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const roleLabel = memberRoleLabel(row.memberRole);
            const email =
              row.memberEmail ??
              (row.memberLabel.includes("@") ? row.memberLabel : null);
            const r = row.result;

            return (
              <TableRow
                key={row.key}
                data-state={activeResultId === r.id ? "selected" : undefined}
                className="cursor-pointer"
                onDoubleClick={() => onOpenSheets(row)}
                title="Double-click to open quiz question sheet and answer key"
              >
                {showWorkspaceColumn ? (
                  <TableCell className="max-w-[14rem]">
                    <span className="line-clamp-2 font-medium text-foreground" title={row.teamName}>
                      {row.teamName}
                    </span>
                  </TableCell>
                ) : null}
                <TableCell className="max-w-[12rem]">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className="truncate font-medium text-foreground"
                        title={row.memberLabel}
                      >
                        {row.memberLabel}
                      </span>
                      {roleLabel ? (
                        <Badge
                          variant="outline"
                          className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                        >
                          {roleLabel}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="max-w-[14rem]">
                  {email ? (
                    <span className="block truncate text-muted-foreground" title={email}>
                      {email}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="max-w-[12rem]">
                  <span className="line-clamp-2 font-medium text-foreground" title={r.deckName}>
                    {r.deckName}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span
                    className={cn(
                      "text-base font-semibold tabular-nums",
                      scoreToneClass(r.percent),
                    )}
                  >
                    {r.percent}%
                  </span>
                </TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">
                  {r.correct}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">
                  {r.incorrect}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums lg:table-cell">
                  {r.unanswered}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">
                  {r.total}
                </TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">
                  {formatClock(r.elapsedSeconds)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(r.savedAt)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        onView(row);
                      }}
                    >
                      <Eye className="size-3.5" aria-hidden />
                      View
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs text-muted-foreground hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
                      disabled={deletingKey === row.key}
                      onClick={(event) => {
                        event.stopPropagation();
                        void onDelete(row);
                      }}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      {deletingKey === row.key ? "Deleting…" : "Delete"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
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

const FILTER_ALL_WORKSPACES = "__fv_all_workspaces__";
const FILTER_ALL_DECKS = "__fv_all_decks__";

const nativeSelectClassName = cn(
  "h-10 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 py-2 text-sm text-foreground",
  "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30",
);

function attemptSearchHaystack(
  workspace: WorkspaceQuizResultGroup,
  member: MemberQuizResultGroup,
  result: QuizResultRow,
): string {
  return [
    workspace.teamName,
    member.memberLabel,
    member.memberEmail,
    member.userId,
    result.deckName,
  ]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .toLowerCase();
}

function filterWorkspaceGroups(
  groups: WorkspaceQuizResultGroup[],
  options: {
    searchQuery: string;
    workspaceFilter: string;
    deckFilter: string;
  },
): WorkspaceQuizResultGroup[] {
  const q = options.searchQuery.trim().toLowerCase();

  return groups
    .filter((workspace) => {
      if (options.workspaceFilter === FILTER_ALL_WORKSPACES) return true;
      return String(workspace.teamId) === options.workspaceFilter;
    })
    .map((workspace) => {
      const memberGroups = workspace.memberGroups
        .map((member) => {
          const attempts = member.attempts.filter(({ result }) => {
            if (
              options.deckFilter !== FILTER_ALL_DECKS &&
              result.deckName !== options.deckFilter
            ) {
              return false;
            }
            if (!q) return true;
            return attemptSearchHaystack(workspace, member, result).includes(q);
          });
          if (attempts.length === 0) return null;
          return { ...member, attempts };
        })
        .filter((member): member is MemberQuizResultGroup => member !== null);

      if (memberGroups.length === 0) return null;

      return {
        ...workspace,
        memberGroups,
        attemptCount: memberGroups.reduce((sum, member) => sum + member.attempts.length, 0),
      };
    })
    .filter((workspace): workspace is WorkspaceQuizResultGroup => workspace !== null);
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
        planSlug: workspace.planSlug,
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
  quizScheduleHref,
  quizSecurityHref,
}: TeamQuizResultsTabProps) {
  const router = useRouter();
  const detailPanelRef = React.useRef<HTMLDivElement | null>(null);
  const [detailSummary, setDetailSummary] = React.useState<QuizResultSummary | null>(null);
  const [deletingKey, setDeletingKey] = React.useState<string | null>(null);
  const [removedResultKeys, setRemovedResultKeys] = React.useState<Set<string>>(new Set());
  const [sheetsDialogRow, setSheetsDialogRow] = React.useState<QuizResultSheetsDialogRow | null>(
    null,
  );
  const [sheetsDialogOpen, setSheetsDialogOpen] = React.useState(false);

  React.useEffect(() => {
    setRemovedResultKeys(new Set());
  }, [workspaces]);

  const workspaceGroups = React.useMemo(
    () => buildWorkspaceGroups(workspaces, userFieldDisplayById),
    [workspaces, userFieldDisplayById],
  );

  const [searchQuery, setSearchQuery] = React.useState("");
  const [workspaceFilter, setWorkspaceFilter] = React.useState(FILTER_ALL_WORKSPACES);
  const [deckFilter, setDeckFilter] = React.useState(FILTER_ALL_DECKS);
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  const workspaceFilterOptions = React.useMemo(
    () =>
      [...workspaceGroups]
        .sort((a, b) => a.teamName.localeCompare(b.teamName))
        .map((g) => ({ id: String(g.teamId), name: g.teamName })),
    [workspaceGroups],
  );

  const deckFilterOptions = React.useMemo(() => {
    const names = new Set<string>();
    for (const workspace of workspaceGroups) {
      for (const member of workspace.memberGroups) {
        for (const { result } of member.attempts) {
          names.add(result.deckName);
        }
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [workspaceGroups]);

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    workspaceFilter !== FILTER_ALL_WORKSPACES ||
    deckFilter !== FILTER_ALL_DECKS;

  const filteredWorkspaceGroups = React.useMemo(
    () =>
      filterWorkspaceGroups(workspaceGroups, {
        searchQuery,
        workspaceFilter,
        deckFilter,
      }),
    [workspaceGroups, searchQuery, workspaceFilter, deckFilter],
  );

  const totalAttempts = workspaceGroups.reduce((sum, g) => sum + g.attemptCount, 0);
  const totalMembers = workspaceGroups.reduce((sum, g) => sum + g.memberGroups.length, 0);
  const filteredAttempts = filteredWorkspaceGroups.reduce(
    (sum, g) => sum + g.attemptCount,
    0,
  );
  const filteredMembers = filteredWorkspaceGroups.reduce(
    (sum, g) => sum + g.memberGroups.length,
    0,
  );

  const tableRows = React.useMemo(
    () => flattenToTableRows(filteredWorkspaceGroups),
    [filteredWorkspaceGroups],
  );

  const visibleTableRows = React.useMemo(
    () => tableRows.filter((row) => !removedResultKeys.has(row.key)),
    [tableRows, removedResultKeys],
  );

  const showWorkspaceColumn = workspaceGroups.length > 1;

  function clearFilters() {
    setSearchQuery("");
    setWorkspaceFilter(FILTER_ALL_WORKSPACES);
    setDeckFilter(FILTER_ALL_DECKS);
  }

  function openSheets(row: QuizResultTableRow) {
    const email =
      row.memberEmail ?? (row.memberLabel.includes("@") ? row.memberLabel : null);
    setSheetsDialogRow({
      resultId: row.result.id,
      teamId: row.teamId,
      workspacePlanSlug: row.workspacePlanSlug,
      deckName: row.result.deckName,
      memberLabel: row.memberLabel,
      memberEmail: email,
    });
    setSheetsDialogOpen(true);
  }

  function openView(row: QuizResultTableRow) {
    setDetailSummary(row.summary);
    requestAnimationFrame(() => {
      detailPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function handleDelete(row: QuizResultTableRow) {
    const confirmed = window.confirm(
      `Delete the saved result for "${row.result.deckName}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    if (detailSummary?.id === row.result.id) {
      setDetailSummary(null);
    }

    setDeletingKey(row.key);
    try {
      await deleteQuizResultAction({
        resultId: row.result.id,
        teamId: row.teamId,
      });
      setRemovedResultKeys((prev) => new Set(prev).add(row.key));
      router.refresh();
    } catch {
      // optimistic row stays until refresh on success only
    } finally {
      setDeletingKey(null);
    }
  }

  function toggleFiltersPanel() {
    setFiltersOpen((open) => !open);
  }

  return (
    <div className="space-y-4">
      <TeamQuizResultsSubTabs
        quizResultsHref={quizResultsHref}
        quizTimerHref={quizTimerHref}
        quizScheduleHref={quizScheduleHref}
        quizSecurityHref={quizSecurityHref}
      />
      <Card className={teamAdminActivePanelClass}>
        <CardHeader className="space-y-3 pb-2 sm:pb-4">
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
              Saved quiz attempts by workspace and member. Use View to expand full details below the
              table, or double-click a row to open the quiz question sheet and answer key.
              {totalAttempts > 0 ? (
                <span className="mt-1 block font-medium text-foreground">
                  {hasActiveFilters ? (
                    <>
                      Showing {filteredAttempts} of {totalAttempts} attempt
                      {totalAttempts !== 1 ? "s" : ""} · {filteredWorkspaceGroups.length} of{" "}
                      {workspaceGroups.length} workspace
                      {workspaceGroups.length !== 1 ? "s" : ""} · {filteredMembers} of{" "}
                      {totalMembers} member{totalMembers !== 1 ? "s" : ""}
                    </>
                  ) : (
                    <>
                      {totalAttempts} attempt{totalAttempts !== 1 ? "s" : ""} ·{" "}
                      {workspaceGroups.length} workspace
                      {workspaceGroups.length !== 1 ? "s" : ""} · {totalMembers} member
                      {totalMembers !== 1 ? "s" : ""}
                    </>
                  )}
                </span>
              ) : null}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0 sm:space-y-4">
          {totalAttempts > 0 ? (
            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-full justify-between gap-2 sm:w-auto sm:min-w-[11rem]"
                onClick={toggleFiltersPanel}
                aria-expanded={filtersOpen}
                aria-controls="quiz-results-filters"
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  <SlidersHorizontal className="size-4 shrink-0" aria-hidden />
                  <span>Search & filters</span>
                  {hasActiveFilters && !filtersOpen ? (
                    <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      Active
                    </span>
                  ) : null}
                </span>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 transition-transform",
                    filtersOpen && "rotate-180",
                  )}
                  aria-hidden
                />
              </Button>

              {filtersOpen ? (
              <div
                id="quiz-results-filters"
                className="grid gap-3 rounded-lg border border-border/70 bg-muted/15 p-4 sm:grid-cols-2 lg:grid-cols-4"
              >
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
                  <Label
                    htmlFor="quiz-results-search"
                    className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    Search
                  </Label>
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      id="quiz-results-search"
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Workspace, member, email, or deck…"
                      className="h-10 bg-background pl-9"
                    />
                  </div>
                </div>

                {workspaceFilterOptions.length > 1 ? (
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="quiz-results-workspace"
                      className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
                    >
                      Workspace
                    </Label>
                    <select
                      id="quiz-results-workspace"
                      value={workspaceFilter}
                      onChange={(e) => setWorkspaceFilter(e.target.value)}
                      className={nativeSelectClassName}
                    >
                      <option value={FILTER_ALL_WORKSPACES}>All workspaces</option>
                      {workspaceFilterOptions.map((workspace) => (
                        <option key={workspace.id} value={workspace.id}>
                          {workspace.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {deckFilterOptions.length > 0 ? (
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="quiz-results-deck"
                      className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
                    >
                      Deck
                    </Label>
                    <select
                      id="quiz-results-deck"
                      value={deckFilter}
                      onChange={(e) => setDeckFilter(e.target.value)}
                      className={nativeSelectClassName}
                    >
                      <option value={FILTER_ALL_DECKS}>All decks</option>
                      {deckFilterOptions.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {hasActiveFilters ? (
                  <div className="flex items-end sm:col-span-2 lg:col-span-4">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-10 text-xs text-muted-foreground"
                      onClick={clearFilters}
                    >
                      Clear filters
                    </Button>
                  </div>
                ) : null}
              </div>
              ) : null}
            </div>
          ) : null}

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
          ) : filteredWorkspaceGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 bg-muted/15 px-6 py-12 text-center">
              <Search className="size-10 text-muted-foreground/60" aria-hidden />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">No matching results</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Try a different workspace, member, email, or deck name.
                </p>
              </div>
              {hasActiveFilters ? (
                <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : null}
            </div>
          ) : visibleTableRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 bg-muted/15 px-6 py-12 text-center">
              <Search className="size-10 text-muted-foreground/60" aria-hidden />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">No matching results</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Try a different workspace, member, email, or deck name.
                </p>
              </div>
              {hasActiveFilters ? (
                <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <QuizResultsTable
                rows={visibleTableRows}
                showWorkspaceColumn={showWorkspaceColumn}
                activeResultId={detailSummary?.id ?? null}
                deletingKey={deletingKey}
                onView={openView}
                onDelete={handleDelete}
                onOpenSheets={openSheets}
              />

              {detailSummary ? (
                <div
                  ref={detailPanelRef}
                  className="scroll-mt-4 rounded-lg border border-border/80 bg-card/40"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
                    <p className="text-sm font-medium text-foreground">Result details</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => setDetailSummary(null)}
                    >
                      <X className="size-3.5" aria-hidden />
                      Close
                    </Button>
                  </div>
                  <QuizResultDetailView variant="embedded" result={detailSummary} />
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <QuizResultSheetsDialog
        open={sheetsDialogOpen}
        onOpenChange={setSheetsDialogOpen}
        row={sheetsDialogRow}
      />
    </div>
  );
}
