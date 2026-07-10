"use client";

import { useEffect, useMemo, useState, useTransition, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TeacherRegisterStudentPanel } from "@/components/teacher-register-student-panel";
import { TeacherStudentReportsPanel } from "@/components/teacher-student-reports-panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ViewQuizResultDialog } from "@/components/view-quiz-result-dialog";
import {
  QuizResultSheetsDialog,
  type QuizResultSheetsDialogRow,
} from "@/components/quiz-result-sheets-dialog";
import { deleteQuizResultAction } from "@/actions/quiz-results";
import type { QuizResultSummary } from "@/components/quiz-result-detail-view";
import type {
  TeacherStudentProgressMemberMeta,
  TeacherStudentProgressRow,
} from "@/db/queries/teacher-student-progress";
import type {
  TeacherManualGradeRow,
} from "@/db/schema";
import type { TeacherClassWithDeck } from "@/db/queries/teacher-classes";
import type { TeacherRegisteredStudentWithClass } from "@/db/queries/teacher-registered-students";
import type { WorkspaceStudentInvitee } from "@/db/queries/teacher-workspace-student-invitees";
import type { SavedHomeworkAssignmentOption } from "@/db/queries/saved-homework";
import type { TeacherManualGradeQuizOption } from "@/db/queries/teacher-manual-grades";
import { teamAdminCardClass } from "@/components/team-admin-panel-styles";
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DEFAULT_TEACHER_PAGE_SIZE,
  paginateTeacherRecords,
  TeacherRecordPagination,
  TeacherRecordsCountBar,
  type TeacherPageSize,
} from "@/components/teacher-record-pagination";

const FILTER_ALL = "__all__";

type SortKey = "savedAt" | "member" | "subject" | "topic" | "score";

type ScheduleFilters = {
  period: string;
  subject: string;
  gradeLevel: string;
  academicYear: string;
  term: string;
  week: string;
  day: string;
  memberRole: string;
};

const INITIAL_SCHEDULE_FILTERS: ScheduleFilters = {
  period: FILTER_ALL,
  subject: FILTER_ALL,
  gradeLevel: FILTER_ALL,
  academicYear: FILTER_ALL,
  term: FILTER_ALL,
  week: FILTER_ALL,
  day: FILTER_ALL,
  memberRole: FILTER_ALL,
};

type MemberProgressGroup = {
  memberUserId: string;
  memberLabel: string;
  memberEmail: string | null;
  memberRole: QuizResultSummary["memberRole"];
  rows: TeacherStudentProgressRow[];
};

type AdminLedProgressGroup = {
  leaderUserId: string;
  leaderLabel: string;
  leaderEmail: string | null;
  leaderRole: "owner" | "team_admin";
  leaderRows: TeacherStudentProgressRow[];
  memberGroups: MemberProgressGroup[];
  resultCount: number;
};

function memberRoleLabel(role: QuizResultSummary["memberRole"]): string | null {
  if (role === "owner") return "Owner";
  if (role === "team_admin") return "Admin";
  if (role === "team_member") return "Member";
  return null;
}

function buildMemberGroups(rows: TeacherStudentProgressRow[]): MemberProgressGroup[] {
  const grouped = new Map<string, MemberProgressGroup>();

  for (const row of rows) {
    const memberLabel = row.memberName ?? row.memberEmail ?? "Unknown member";
    const existing = grouped.get(row.memberUserId);
    if (existing) {
      existing.rows.push(row);
    } else {
      grouped.set(row.memberUserId, {
        memberUserId: row.memberUserId,
        memberLabel,
        memberEmail: row.memberEmail,
        memberRole: row.memberRole,
        rows: [row],
      });
    }
  }

  return [...grouped.values()].sort((a, b) => a.memberLabel.localeCompare(b.memberLabel));
}

function resolveLeaderUserId(
  memberUserId: string,
  ownerUserId: string,
  memberMetaByUserId: Record<string, TeacherStudentProgressMemberMeta>,
): string {
  const meta = memberMetaByUserId[memberUserId];
  if (!meta) return ownerUserId;

  const addedBy = meta.addedByUserId;
  if (!addedBy) return ownerUserId;
  if (addedBy === ownerUserId || meta.addedByAsOwner) return ownerUserId;

  const adderMeta = memberMetaByUserId[addedBy];
  if (adderMeta?.role === "team_admin") return addedBy;

  return ownerUserId;
}

function buildAdminLedGroups(
  rows: TeacherStudentProgressRow[],
  ownerUserId: string,
  ownerName: string | null,
  ownerEmail: string | null,
  memberMetaByUserId: Record<string, TeacherStudentProgressMemberMeta>,
): AdminLedProgressGroup[] {
  const flatMemberGroups = buildMemberGroups(rows);
  const adminMap = new Map<string, AdminLedProgressGroup>();

  function ensureAdmin(
    leaderUserId: string,
    leaderRole: "owner" | "team_admin",
  ): AdminLedProgressGroup {
    const existing = adminMap.get(leaderUserId);
    if (existing) return existing;

    const meta = memberMetaByUserId[leaderUserId];
    const leaderLabel =
      leaderRole === "owner"
        ? ownerName ?? ownerEmail ?? "Workspace owner"
        : meta?.name ?? meta?.email ?? "Team admin";
    const leaderEmail =
      leaderRole === "owner" ? ownerEmail : meta?.email ?? null;

    const group: AdminLedProgressGroup = {
      leaderUserId,
      leaderLabel,
      leaderEmail,
      leaderRole,
      leaderRows: [],
      memberGroups: [],
      resultCount: 0,
    };
    adminMap.set(leaderUserId, group);
    return group;
  }

  for (const memberGroup of flatMemberGroups) {
    const role = memberGroup.memberRole;

    if (role === "owner") {
      const adminGroup = ensureAdmin(ownerUserId, "owner");
      adminGroup.leaderRows.push(...memberGroup.rows);
      continue;
    }

    if (role === "team_admin") {
      const adminGroup = ensureAdmin(memberGroup.memberUserId, "team_admin");
      adminGroup.leaderRows.push(...memberGroup.rows);
      continue;
    }

    const leaderUserId = resolveLeaderUserId(
      memberGroup.memberUserId,
      ownerUserId,
      memberMetaByUserId,
    );
    const leaderRole = leaderUserId === ownerUserId ? "owner" : "team_admin";
    const adminGroup = ensureAdmin(leaderUserId, leaderRole);
    adminGroup.memberGroups.push(memberGroup);
  }

  return [...adminMap.values()]
    .map((group) => ({
      ...group,
      resultCount:
        group.leaderRows.length +
        group.memberGroups.reduce((sum, member) => sum + member.rows.length, 0),
    }))
    .filter((group) => group.resultCount > 0)
    .sort((a, b) => {
      if (a.leaderRole === "owner" && b.leaderRole !== "owner") return -1;
      if (b.leaderRole === "owner" && a.leaderRole !== "owner") return 1;
      return a.leaderLabel.localeCompare(b.leaderLabel);
    });
}

function memberGroupKey(leaderUserId: string, memberUserId: string): string {
  return `${leaderUserId}:${memberUserId}`;
}

const nativeSelectClassName = cn(
  "h-10 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 py-2 text-sm text-foreground",
  "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30",
);

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

function scoreToneClass(percent: number): string {
  if (percent >= 80) return "text-emerald-500";
  if (percent >= 50) return "text-blue-400";
  return "text-rose-500";
}

function rowHaystack(row: TeacherStudentProgressRow): string {
  return [
    row.memberName,
    row.memberEmail,
    memberRoleLabel(row.memberRole),
    row.subject,
    row.topic,
    row.gradeLevel,
    row.schedule?.period,
    row.schedule?.academicYear,
    row.schedule?.termSemester,
    row.schedule?.week,
    row.schedule?.day,
    row.summary.deckName,
  ]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .toLowerCase();
}

function distinctValues(
  rows: TeacherStudentProgressRow[],
  pick: (row: TeacherStudentProgressRow) => string | null | undefined,
): string[] {
  const values = new Set<string>();
  for (const row of rows) {
    const value = pick(row)?.trim();
    if (value && value !== "—") values.add(value);
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}

function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className={nativeSelectClassName}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value={FILTER_ALL}>All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function rowMatchesScheduleFilters(
  row: TeacherStudentProgressRow,
  filters: ScheduleFilters,
): boolean {
  if (filters.subject !== FILTER_ALL && row.subject !== filters.subject) {
    return false;
  }
  if (filters.gradeLevel !== FILTER_ALL && row.gradeLevel !== filters.gradeLevel) {
    return false;
  }
  if (filters.period !== FILTER_ALL) {
    if (!row.schedule || row.schedule.period !== filters.period) return false;
  }
  if (filters.academicYear !== FILTER_ALL) {
    if (!row.schedule || row.schedule.academicYear !== filters.academicYear) return false;
  }
  if (filters.term !== FILTER_ALL) {
    if (!row.schedule || row.schedule.termSemester !== filters.term) return false;
  }
  if (filters.week !== FILTER_ALL) {
    if (!row.schedule || row.schedule.week !== filters.week) return false;
  }
  if (filters.day !== FILTER_ALL) {
    if (!row.schedule || row.schedule.day !== filters.day) return false;
  }
  if (filters.memberRole !== FILTER_ALL && row.memberRole !== filters.memberRole) {
    return false;
  }
  return true;
}

function hasActiveScheduleFilters(filters: ScheduleFilters): boolean {
  return Object.values(filters).some((value) => value !== FILTER_ALL);
}

function MemberCell({ row }: { row: TeacherStudentProgressRow }) {
  const memberLabel = row.memberName ?? row.memberEmail ?? "Unknown member";
  const roleLabel = memberRoleLabel(row.memberRole);

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="truncate font-medium text-foreground" title={memberLabel}>
          {memberLabel}
        </p>
        {roleLabel ? (
          <Badge
            variant="outline"
            className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            {roleLabel}
          </Badge>
        ) : null}
      </div>
      {row.memberEmail && row.memberName ? (
        <p className="truncate text-xs text-muted-foreground" title={row.memberEmail}>
          {row.memberEmail}
        </p>
      ) : null}
    </div>
  );
}

function ProgressResultDeleteButton({
  resultId,
  teamId,
  memberLabel,
  onDeleted,
}: {
  resultId: number;
  teamId: number;
  memberLabel: string;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setOpen(false);
    startTransition(async () => {
      try {
        await deleteQuizResultAction({ resultId, teamId });
        toast.success("Quiz result deleted", {
          description: `Removed the result for ${memberLabel}.`,
        });
        onDeleted();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not delete quiz result.",
        );
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="xs"
        className="text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
        disabled={isPending}
        aria-label={`Delete quiz result for ${memberLabel}`}
      >
        <Trash2 className="size-3.5" aria-hidden />
        {isPending ? "…" : "Delete"}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete quiz result?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the quiz result for{" "}
              <span className="font-medium text-foreground">{memberLabel}</span>. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ProgressResultRows({
  rows,
  teamId,
  workspacePlanSlug,
  canDeleteResults,
  onResultDeleted,
  onOpenSheets,
}: {
  rows: TeacherStudentProgressRow[];
  teamId: number | null;
  workspacePlanSlug: string | null;
  canDeleteResults: boolean;
  onResultDeleted: (resultId: number) => void;
  onOpenSheets: (row: TeacherStudentProgressRow) => void;
}) {
  return (
    <>
      {rows.map((row) => (
        <TableRow
          key={row.resultId}
          className="cursor-pointer hover:bg-muted/10"
          onDoubleClick={() => onOpenSheets(row)}
          title="Double-click to open quiz question sheet and answer key"
        >
          <TableCell className="max-w-[14rem]">
            <MemberCell row={row} />
          </TableCell>
          <TableCell className="max-w-[10rem]">
            <span className="line-clamp-2 text-sm" title={row.subject}>
              {row.subject}
            </span>
          </TableCell>
          <TableCell className="max-w-[12rem]">
            <span className="line-clamp-2 text-sm" title={row.topic}>
              {row.topic}
            </span>
          </TableCell>
          <TableCell className="text-sm text-muted-foreground">
            {formatDate(row.savedAt)}
          </TableCell>
          <TableCell className="hidden text-right sm:table-cell">
            <span className={cn("font-semibold tabular-nums", scoreToneClass(row.percent))}>
              {row.percent}%
            </span>
          </TableCell>
          <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <ViewQuizResultDialog
                result={row.summary}
                triggerLabel="View quiz result"
                compact
              />
              {canDeleteResults && teamId != null ? (
                <ProgressResultDeleteButton
                  resultId={row.resultId}
                  teamId={teamId}
                  memberLabel={row.memberName ?? row.memberEmail ?? "this member"}
                  onDeleted={() => onResultDeleted(row.resultId)}
                />
              ) : null}
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

type TeacherStudentProgressViewProps = {
  rows: TeacherStudentProgressRow[];
  teamId: number | null;
  teamMemberId: number | null;
  canDeleteResults: boolean;
  ownerUserId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  memberMetaByUserId: Record<string, TeacherStudentProgressMemberMeta>;
  workspaceLabel: string | null;
  workspacePlanSlug: string | null;
  backHref: string;
  isWorkspaceOwner: boolean;
  showRegisterStudentTab: boolean;
  isPersonalEducation: boolean;
  isEducationTeamWorkspace: boolean;
  workspaceInvitees: WorkspaceStudentInvitee[];
  showQuizResultsTab: boolean;
  showGradesAndReportsTabs: boolean;
  registeredStudents: TeacherRegisteredStudentWithClass[];
  personalClasses: TeacherClassWithDeck[];
  savedHomeworkAssignments: SavedHomeworkAssignmentOption[];
  savedQuizOptions: TeacherManualGradeQuizOption[];
  manualGrades: TeacherManualGradeRow[];
};

export function TeacherStudentProgressView({
  rows: initialRows,
  teamId,
  teamMemberId,
  canDeleteResults,
  ownerUserId,
  ownerName,
  ownerEmail,
  memberMetaByUserId,
  workspaceLabel,
  workspacePlanSlug,
  backHref,
  isWorkspaceOwner,
  showRegisterStudentTab,
  isPersonalEducation,
  isEducationTeamWorkspace,
  workspaceInvitees,
  showQuizResultsTab,
  showGradesAndReportsTabs,
  registeredStudents,
  personalClasses,
  savedHomeworkAssignments,
  savedQuizOptions,
  manualGrades,
}: TeacherStudentProgressViewProps) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);
  const [searchQuery, setSearchQuery] = useState("");
  const [scheduleFilters, setScheduleFilters] =
    useState<ScheduleFilters>(INITIAL_SCHEDULE_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>("savedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<TeacherPageSize>(DEFAULT_TEACHER_PAGE_SIZE);
  const [sheetsDialogRow, setSheetsDialogRow] = useState<QuizResultSheetsDialogRow | null>(null);
  const [sheetsDialogOpen, setSheetsDialogOpen] = useState(false);
  const [collapsedAdminIds, setCollapsedAdminIds] = useState<Set<string>>(() => new Set());
  const [collapsedMemberKeys, setCollapsedMemberKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setPage(1);
  }, [searchQuery, scheduleFilters, sortKey, sortDir, pageSize]);

  const filterOptions = useMemo(
    () => ({
      period: distinctValues(rows, (row) => row.schedule?.period),
      subject: distinctValues(rows, (row) => row.subject),
      gradeLevel: distinctValues(rows, (row) => row.gradeLevel ?? row.schedule?.gradeLevel),
      academicYear: distinctValues(rows, (row) => row.schedule?.academicYear),
      term: distinctValues(rows, (row) => row.schedule?.termSemester),
      week: distinctValues(rows, (row) => row.schedule?.week),
      day: distinctValues(rows, (row) => row.schedule?.day),
      memberRole: ["owner", "team_admin", "team_member"].filter((role) =>
        rows.some((row) => row.memberRole === role),
      ),
    }),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let next = rows.filter((row) => {
      if (!rowMatchesScheduleFilters(row, scheduleFilters)) return false;
      if (!q) return true;
      return rowHaystack(row).includes(q);
    });

    next = [...next].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "member": {
          const aLabel = (a.memberName ?? a.memberEmail ?? "").toLowerCase();
          const bLabel = (b.memberName ?? b.memberEmail ?? "").toLowerCase();
          cmp = aLabel.localeCompare(bLabel);
          break;
        }
        case "subject":
          cmp = a.subject.localeCompare(b.subject);
          break;
        case "topic":
          cmp = a.topic.localeCompare(b.topic);
          break;
        case "score":
          cmp = a.percent - b.percent;
          break;
        case "savedAt":
        default:
          cmp = new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return next;
  }, [rows, searchQuery, scheduleFilters, sortKey, sortDir]);

  const hasActiveFilters =
    searchQuery.trim() !== "" || hasActiveScheduleFilters(scheduleFilters);

  const {
    paginatedItems: paginatedRows,
    totalPages,
    safePage,
    pageStart,
    pageEnd,
  } = useMemo(
    () => paginateTeacherRecords(filteredRows, page, pageSize),
    [filteredRows, page, pageSize],
  );

  const adminLedGroups = useMemo(
    () =>
      isWorkspaceOwner
        ? buildAdminLedGroups(
            paginatedRows,
            ownerUserId,
            ownerName,
            ownerEmail,
            memberMetaByUserId,
          )
        : null,
    [paginatedRows, isWorkspaceOwner, ownerUserId, ownerName, ownerEmail, memberMetaByUserId],
  );

  const displayRows = isWorkspaceOwner ? null : paginatedRows;

  function clearFilters() {
    setSearchQuery("");
    setScheduleFilters(INITIAL_SCHEDULE_FILTERS);
  }

  function updateScheduleFilter(key: keyof ScheduleFilters, value: string) {
    setScheduleFilters((current) => ({ ...current, [key]: value }));
  }

  function toggleAdminGroup(leaderUserId: string) {
    setCollapsedAdminIds((current) => {
      const next = new Set(current);
      if (next.has(leaderUserId)) {
        next.delete(leaderUserId);
      } else {
        next.add(leaderUserId);
      }
      return next;
    });
  }

  function toggleMemberSubgroup(leaderUserId: string, memberUserId: string) {
    const key = memberGroupKey(leaderUserId, memberUserId);
    setCollapsedMemberKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function handleResultDeleted(resultId: number) {
    setRows((current) => current.filter((row) => row.resultId !== resultId));
    router.refresh();
  }

  function openQuizSheets(row: TeacherStudentProgressRow) {
    if (teamId == null) return;
    const memberLabel = row.memberName ?? row.memberEmail ?? "Unknown member";
    setSheetsDialogRow({
      resultId: row.resultId,
      teamId,
      workspacePlanSlug: workspacePlanSlug ?? "",
      deckName: row.summary.deckName,
      memberLabel,
      memberEmail: row.memberEmail,
    });
    setSheetsDialogOpen(true);
  }

  const progressRowProps = {
    teamId,
    workspacePlanSlug,
    canDeleteResults,
    onResultDeleted: handleResultDeleted,
    onOpenSheets: openQuizSheets,
  };

  const defaultTab = showRegisterStudentTab && isPersonalEducation
    ? "register-student"
    : showQuizResultsTab
      ? "quiz-results"
      : showGradesAndReportsTabs
        ? "reports-and-grades"
        : "quiz-results";

  const quizResultsCard = (
      <Card className={cn(teamAdminCardClass, "overflow-visible backdrop-blur-sm")}>
        <CardHeader className="gap-4 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base">Workspace quiz results</CardTitle>
              <CardDescription>
                {hasActiveFilters ? "Filtered results. " : ""}
                {isWorkspaceOwner && adminLedGroups && adminLedGroups.length > 0 ? (
                  <>
                    Grouped by team admin on this page ({adminLedGroups.length} group
                    {adminLedGroups.length === 1 ? "" : "s"}).
                  </>
                ) : null}{" "}
                Click a team admin or member group to show or hide results. Double-click a row to
                open the quiz question sheet and answer key.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0 gap-2"
              onClick={() => setFiltersOpen((open) => !open)}
            >
              <SlidersHorizontal className="size-4" aria-hidden />
              {filtersOpen ? "Hide filters" : "Filters & sort"}
            </Button>
          </div>

          {filtersOpen ? (
            <div className="space-y-4 rounded-xl border border-border/70 bg-muted/15 p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
                  <Label htmlFor="student-progress-search">Search</Label>
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      id="student-progress-search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Member, email, role, subject, topic, period, term, week, day…"
                      className="pl-9"
                    />
                  </div>
                </div>
                <FilterSelect
                  id="student-progress-period"
                  label="Period"
                  value={scheduleFilters.period}
                  options={filterOptions.period}
                  onChange={(value) => updateScheduleFilter("period", value)}
                />
                <FilterSelect
                  id="student-progress-subject"
                  label="Subject"
                  value={scheduleFilters.subject}
                  options={filterOptions.subject}
                  onChange={(value) => updateScheduleFilter("subject", value)}
                />
                <FilterSelect
                  id="student-progress-grade-level"
                  label="Grade level"
                  value={scheduleFilters.gradeLevel}
                  options={filterOptions.gradeLevel}
                  onChange={(value) => updateScheduleFilter("gradeLevel", value)}
                />
                <FilterSelect
                  id="student-progress-academic-year"
                  label="Academic year"
                  value={scheduleFilters.academicYear}
                  options={filterOptions.academicYear}
                  onChange={(value) => updateScheduleFilter("academicYear", value)}
                />
                <FilterSelect
                  id="student-progress-term"
                  label="Term"
                  value={scheduleFilters.term}
                  options={filterOptions.term}
                  onChange={(value) => updateScheduleFilter("term", value)}
                />
                <FilterSelect
                  id="student-progress-week"
                  label="Week"
                  value={scheduleFilters.week}
                  options={filterOptions.week}
                  onChange={(value) => updateScheduleFilter("week", value)}
                />
                <FilterSelect
                  id="student-progress-day"
                  label="Day"
                  value={scheduleFilters.day}
                  options={filterOptions.day}
                  onChange={(value) => updateScheduleFilter("day", value)}
                />
                <div className="space-y-1.5">
                  <Label htmlFor="student-progress-role">Role</Label>
                  <select
                    id="student-progress-role"
                    className={nativeSelectClassName}
                    value={scheduleFilters.memberRole}
                    onChange={(e) => updateScheduleFilter("memberRole", e.target.value)}
                  >
                    <option value={FILTER_ALL}>All</option>
                    {filterOptions.memberRole.map((role) => (
                      <option key={role} value={role}>
                        {memberRoleLabel(role as QuizResultSummary["memberRole"]) ?? role}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
                  <Label htmlFor="student-progress-sort">Sort by</Label>
                  <div className="flex gap-2">
                    <select
                      id="student-progress-sort"
                      className={nativeSelectClassName}
                      value={sortKey}
                      onChange={(e) => setSortKey(e.target.value as SortKey)}
                    >
                      <option value="savedAt">Date & time</option>
                      <option value="member">Member</option>
                      <option value="subject">Subject</option>
                      <option value="topic">Topic</option>
                      <option value="score">Score</option>
                    </select>
                    <select
                      aria-label="Sort direction"
                      className={cn(nativeSelectClassName, "w-28 shrink-0")}
                      value={sortDir}
                      onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
                    >
                      <option value="desc">Desc</option>
                      <option value="asc">Asc</option>
                    </select>
                  </div>
                </div>
              </div>
              {hasActiveFilters ? (
                <div className="flex justify-end border-t border-border/50 pt-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground"
                    onClick={clearFilters}
                  >
                    <X className="size-3.5" aria-hidden />
                    Clear filters
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </CardHeader>

        <CardContent className="pt-0">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-muted/10 px-6 py-12 text-center">
              <p className="text-sm font-medium text-foreground">No saved quiz results yet</p>
              <p className="max-w-md text-sm text-muted-foreground">
                When workspace members save quiz results from assigned decks, they will appear
                here with member details and class schedule context.
              </p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 bg-muted/10 px-6 py-12 text-center">
              <p className="text-sm font-medium text-foreground">No matching results</p>
              <p className="text-sm text-muted-foreground">
                Try different search terms or class schedule filters.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          ) : (
            <>
              <TeacherRecordsCountBar
                idPrefix="student-progress"
                pageStart={pageStart}
                pageEnd={pageEnd}
                filteredCount={filteredRows.length}
                totalCount={rows.length}
                recordLabel="result"
                pageSize={pageSize}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
              <div className="overflow-x-auto rounded-lg border border-border/80">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="min-w-[10rem]">Member</TableHead>
                    <TableHead className="min-w-[8rem]">Subject</TableHead>
                    <TableHead className="min-w-[10rem]">Topic</TableHead>
                    <TableHead className="min-w-[11rem]">Created</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Score</TableHead>
                    <TableHead className="min-w-[9rem] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isWorkspaceOwner && adminLedGroups
                    ? adminLedGroups.map((adminGroup) => {
                        const adminRoleLabel = memberRoleLabel(
                          adminGroup.leaderRole === "owner" ? "owner" : "team_admin",
                        );
                        const isAdminCollapsed = collapsedAdminIds.has(adminGroup.leaderUserId);

                        return (
                          <Fragment key={adminGroup.leaderUserId}>
                            <TableRow
                              className="cursor-pointer select-none bg-muted/15 hover:bg-muted/20"
                              onClick={() => toggleAdminGroup(adminGroup.leaderUserId)}
                              title="Click to show or hide this team admin's section"
                            >
                              <TableCell colSpan={6} className="py-2.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <ChevronDown
                                    className={cn(
                                      "size-3.5 shrink-0 text-muted-foreground transition-transform",
                                      isAdminCollapsed && "-rotate-90",
                                    )}
                                    aria-hidden
                                  />
                                  <span
                                    className="font-semibold text-foreground"
                                    title={adminGroup.leaderLabel}
                                  >
                                    {adminGroup.leaderLabel}
                                  </span>
                                  {adminRoleLabel ? (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                                    >
                                      {adminRoleLabel}
                                    </Badge>
                                  ) : null}
                                  <span className="text-xs text-muted-foreground">
                                    {adminGroup.resultCount} result
                                    {adminGroup.resultCount === 1 ? "" : "s"}
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                            {!isAdminCollapsed ? (
                              <>
                                {adminGroup.leaderRows.length > 0 ? (
                                  <ProgressResultRows rows={adminGroup.leaderRows} {...progressRowProps} />
                                ) : null}
                                {adminGroup.memberGroups.map((memberGroup) => {
                                  const memberRole = memberRoleLabel(memberGroup.memberRole);
                                  const memberKey = memberGroupKey(
                                    adminGroup.leaderUserId,
                                    memberGroup.memberUserId,
                                  );
                                  const isMemberCollapsed = collapsedMemberKeys.has(memberKey);

                                  return (
                                    <Fragment key={memberKey}>
                                      <TableRow
                                        className="cursor-pointer select-none bg-muted/10 hover:bg-muted/15"
                                        onClick={() =>
                                          toggleMemberSubgroup(
                                            adminGroup.leaderUserId,
                                            memberGroup.memberUserId,
                                          )
                                        }
                                        title="Click to show or hide this member's results"
                                      >
                                        <TableCell colSpan={6} className="py-2.5 pl-8">
                                          <div className="flex flex-wrap items-center gap-2 border-l border-border/70 pl-4">
                                            <ChevronDown
                                              className={cn(
                                                "size-3.5 shrink-0 text-muted-foreground transition-transform",
                                                isMemberCollapsed && "-rotate-90",
                                              )}
                                              aria-hidden
                                            />
                                            <span
                                              className="font-medium text-foreground"
                                              title={memberGroup.memberLabel}
                                            >
                                              {memberGroup.memberLabel}
                                            </span>
                                            {memberRole ? (
                                              <Badge
                                                variant="outline"
                                                className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                                              >
                                                {memberRole}
                                              </Badge>
                                            ) : null}
                                            <span className="text-xs text-muted-foreground">
                                              {memberGroup.rows.length} result
                                              {memberGroup.rows.length === 1 ? "" : "s"}
                                            </span>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                      {!isMemberCollapsed ? (
                                        <ProgressResultRows rows={memberGroup.rows} {...progressRowProps} />
                                      ) : null}
                                    </Fragment>
                                  );
                                })}
                              </>
                            ) : null}
                          </Fragment>
                        );
                      })
                    : (
                      <ProgressResultRows rows={displayRows ?? []} {...progressRowProps} />
                    )}
                </TableBody>
              </Table>
            </div>
              <TeacherRecordPagination
                page={safePage}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link
            href={backHref}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2 shrink-0")}
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Student Progress</h1>
            <p className="text-sm text-muted-foreground">
              {isEducationTeamWorkspace
                ? "Register invited workspace students, record assignment grades, and generate progress reports."
                : showRegisterStudentTab
                  ? "Register students, record assignment grades, and generate progress reports."
                  : `Track quiz performance and assignment grades in ${workspaceLabel ?? "your workspace"}.`}
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue={defaultTab} className="w-full gap-4">
        <TabsList
          className={cn(
            "h-auto w-full gap-1.5 bg-muted/60 p-1.5",
            showRegisterStudentTab && showQuizResultsTab && showGradesAndReportsTabs
              ? "grid grid-cols-3"
              : "flex flex-nowrap justify-start overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          )}
        >
          {showRegisterStudentTab ? (
            <TabsTrigger
              value="register-student"
              className="h-auto min-h-11 flex-none whitespace-normal px-2 py-2.5 text-center text-xs leading-snug sm:px-3 sm:text-sm"
            >
              Registering a student
            </TabsTrigger>
          ) : null}
          {showQuizResultsTab ? (
            <TabsTrigger
              value="quiz-results"
              className="h-auto min-h-11 flex-none whitespace-normal px-2 py-2.5 text-center text-xs leading-snug sm:px-3 sm:text-sm"
            >
              Quiz results
            </TabsTrigger>
          ) : null}
          {showGradesAndReportsTabs ? (
            <TabsTrigger
              value="reports-and-grades"
              className="h-auto min-h-11 flex-none whitespace-normal px-2 py-2.5 text-center text-xs leading-snug sm:px-3 sm:text-sm"
            >
              Reports & Grades
            </TabsTrigger>
          ) : null}
        </TabsList>

        {showRegisterStudentTab ? (
          <TabsContent value="register-student" className="mt-0">
            <TeacherRegisterStudentPanel
              students={registeredStudents}
              classes={personalClasses}
              teamId={teamId}
              isEducationTeamWorkspace={isEducationTeamWorkspace}
              workspaceInvitees={workspaceInvitees}
            />
          </TabsContent>
        ) : null}

        {showQuizResultsTab ? (
          <TabsContent value="quiz-results" className="mt-0">
            {quizResultsCard}
          </TabsContent>
        ) : null}

        {showGradesAndReportsTabs ? (
          <TabsContent value="reports-and-grades" className="mt-0">
            <TeacherStudentReportsPanel
              manualGrades={manualGrades}
              teamId={teamId}
              teamMemberId={teamMemberId}
              isPersonalEducation={isPersonalEducation}
              isEducationTeamWorkspace={isEducationTeamWorkspace}
              registeredStudents={registeredStudents}
              personalClasses={personalClasses}
              savedHomeworkAssignments={savedHomeworkAssignments}
              savedQuizOptions={savedQuizOptions}
              quizResultRows={rows}
            />
          </TabsContent>
        ) : null}
      </Tabs>

      <QuizResultSheetsDialog
        open={sheetsDialogOpen}
        onOpenChange={setSheetsDialogOpen}
        row={sheetsDialogRow}
      />
    </div>
  );
}
