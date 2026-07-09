"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  FileText,
  Layers,
  NotebookPen,
  PenLine,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { CreateTeacherClassDialog } from "@/components/create-teacher-class-dialog";
import { TeacherClassResourceButton } from "@/components/teacher-class-resource-button";
import { deleteTeacherClassAction } from "@/actions/teacher-resources";
import type { ClassDeckResources } from "@/db/queries/teacher-class-resources";
import type {
  TeacherClassCreatorDisplay,
  TeacherClassWithDeck,
} from "@/db/queries/teacher-classes";
import type { DeckRow } from "@/db/queries/decks";
import {
  teacherClassDisplayTitle,
  teacherClassSubjectLabel,
  buildTeacherClassDeckHref,
} from "@/lib/teacher-class-links";
import {
  buildAdminLedMemberGroups,
  type WorkspaceMemberMeta,
} from "@/lib/teacher-workspace-member-grouping";
import type { TeacherWorkspaceContext } from "@/lib/teacher-url";
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

type ClassSortKey = "createdAt" | "subject" | "period" | "creator" | "academicYear";

type ClassFilters = {
  subject: string;
  period: string;
  academicYear: string;
  term: string;
  creator: string;
};

const INITIAL_CLASS_FILTERS: ClassFilters = {
  subject: FILTER_ALL,
  period: FILTER_ALL,
  academicYear: FILTER_ALL,
  term: FILTER_ALL,
  creator: FILTER_ALL,
};

const nativeSelectClassName = cn(
  "h-10 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 py-2 text-sm text-foreground",
  "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30",
);

type TeacherClassesViewProps = {
  classes: TeacherClassWithDeck[];
  viewerUserId: string;
  creatorDisplayByUserId: Record<string, TeacherClassCreatorDisplay>;
  ownerUserId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  memberMetaByUserId: Record<string, WorkspaceMemberMeta>;
  isWorkspaceOwner: boolean;
  decks: DeckRow[];
  deckResourcesByClassId: Record<number, ClassDeckResources>;
  workspace: TeacherWorkspaceContext;
  backHref: string;
};

function memberRoleLabel(role: TeacherClassCreatorDisplay["role"]): string | null {
  if (role === "owner") return "Owner";
  if (role === "team_admin") return "Admin";
  if (role === "team_member") return "Member";
  return null;
}

function memberGroupKey(leaderUserId: string, memberUserId: string): string {
  return `${leaderUserId}:${memberUserId}`;
}

function classSubject(cls: TeacherClassWithDeck): string {
  return teacherClassSubjectLabel(cls);
}

function classHaystack(
  cls: TeacherClassWithDeck,
  creatorLabel: string | null,
): string {
  return [
    teacherClassDisplayTitle(cls),
    classSubject(cls),
    cls.deckGradeLevel,
    cls.academicYear,
    cls.termSemester,
    cls.week,
    cls.day,
    cls.period,
    creatorLabel,
  ]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .toLowerCase();
}

function distinctClassValues(
  classes: TeacherClassWithDeck[],
  pick: (cls: TeacherClassWithDeck) => string | null | undefined,
): string[] {
  const values = new Set<string>();
  for (const cls of classes) {
    const value = pick(cls)?.trim();
    if (value) values.add(value);
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}

function hasActiveClassFilters(filters: ClassFilters): boolean {
  return Object.values(filters).some((value) => value !== FILTER_ALL);
}

function classMatchesFilters(
  cls: TeacherClassWithDeck,
  filters: ClassFilters,
): boolean {
  if (filters.subject !== FILTER_ALL && classSubject(cls) !== filters.subject) {
    return false;
  }
  if (filters.period !== FILTER_ALL && cls.period !== filters.period) {
    return false;
  }
  if (filters.academicYear !== FILTER_ALL && cls.academicYear !== filters.academicYear) {
    return false;
  }
  if (filters.term !== FILTER_ALL && cls.termSemester !== filters.term) {
    return false;
  }
  if (filters.creator !== FILTER_ALL && cls.userId !== filters.creator) {
    return false;
  }
  return true;
}

function sortClasses(
  classes: TeacherClassWithDeck[],
  sortKey: ClassSortKey,
  sortDir: "asc" | "desc",
  creatorDisplayByUserId: Record<string, TeacherClassCreatorDisplay>,
): TeacherClassWithDeck[] {
  const dir = sortDir === "asc" ? 1 : -1;
  return [...classes].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "subject":
        cmp = classSubject(a).localeCompare(classSubject(b));
        break;
      case "period":
        cmp = a.period.localeCompare(b.period);
        break;
      case "academicYear":
        cmp = a.academicYear.localeCompare(b.academicYear);
        break;
      case "creator": {
        const aLabel =
          creatorDisplayByUserId[a.userId]?.name ??
          creatorDisplayByUserId[a.userId]?.email ??
          "";
        const bLabel =
          creatorDisplayByUserId[b.userId]?.name ??
          creatorDisplayByUserId[b.userId]?.email ??
          "";
        cmp = aLabel.localeCompare(bLabel);
        break;
      }
      case "createdAt":
      default:
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
    }
    return cmp * dir;
  });
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
  options: { value: string; label: string }[];
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
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ClassDeleteButton({
  cls,
  teamId,
  onDeleted,
}: {
  cls: TeacherClassWithDeck;
  teamId: number | null;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setOpen(false);
    startTransition(async () => {
      try {
        await deleteTeacherClassAction({ classId: cls.id, teamId });
        toast.success("Class deleted", {
          description: `${teacherClassDisplayTitle(cls)} was removed from your class list.`,
        });
        onDeleted();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not delete class.",
        );
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
        disabled={isPending}
        aria-label={`Delete class ${teacherClassDisplayTitle(cls)}`}
      >
        <Trash2 className="size-3.5" aria-hidden />
        {isPending ? "…" : "Delete"}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this class?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <span className="font-medium text-foreground">
                {teacherClassDisplayTitle(cls)}
              </span>{" "}
              from your class list. Linked deck resources are not deleted. This action cannot be
              undone.
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

function ClassCard({
  cls,
  resources,
  creatorLabel,
  canDelete,
  teamId,
  onDeleted,
}: {
  cls: TeacherClassWithDeck;
  resources: ClassDeckResources;
  creatorLabel?: string | null;
  canDelete: boolean;
  teamId: number | null;
  onDeleted: () => void;
}) {
  const subject = teacherClassSubjectLabel(cls);

  return (
    <Card className="flex flex-col border-border/80 bg-card/60">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">
            {teacherClassDisplayTitle(cls)}
          </CardTitle>
          {canDelete ? (
            <ClassDeleteButton cls={cls} teamId={teamId} onDeleted={onDeleted} />
          ) : null}
        </div>
        {creatorLabel ? (
          <CardDescription>Created by {creatorLabel}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-1 text-sm text-muted-foreground">
        <p>Subject: {subject}</p>
        <p>Grade level: {cls.deckGradeLevel?.trim() || "—"}</p>
        <p>Academic year: {cls.academicYear}</p>
        <p>Term: {cls.termSemester}</p>
        <p>
          Week: {cls.week} · {cls.day}
        </p>
      </CardContent>
      <CardFooter className="mt-auto flex flex-wrap gap-2 border-t border-border/60 pt-4">
        <TeacherClassResourceButton
          label="Lesson plan"
          icon={NotebookPen}
          savedItems={resources.lessonPlans}
          createHref={resources.toolHrefs.lessonBuilder}
          createLabel="Open Lesson Builder"
          emptyHref={resources.toolHrefs.lessonBuilder}
        />
        <TeacherClassResourceButton
          label="Homework"
          icon={PenLine}
          savedItems={resources.homework}
          createHref={resources.toolHrefs.homework}
          createLabel="Open Homework Generator"
          emptyHref={resources.toolHrefs.homework}
        />
        <Link
          href={resources.toolHrefs.cards}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
        >
          <Layers className="size-3.5" aria-hidden />
          Cards
        </Link>
        <TeacherClassResourceButton
          label="Study guide"
          icon={BookOpen}
          savedItems={resources.studyGuides}
          createHref={resources.toolHrefs.studyGuides}
          createLabel="Open Study Guide Generator"
          emptyHref={resources.toolHrefs.studyGuides}
        />
        <TeacherClassResourceButton
          label="Worksheet"
          icon={FileText}
          savedItems={resources.worksheets}
          createHref={resources.toolHrefs.worksheets}
          createLabel="Open Worksheet Generator"
          emptyHref={resources.toolHrefs.worksheets}
        />
      </CardFooter>
    </Card>
  );
}

function fallbackResources(cls: TeacherClassWithDeck): ClassDeckResources {
  return {
    lessonPlans: [],
    homework: [],
    studyGuides: [],
    worksheets: [],
    toolHrefs: {
      lessonBuilder: `/teacher/lesson-builder?deckId=${cls.deckId}`,
      homework: `/teacher/homework?deckId=${cls.deckId}&sourceType=deck`,
      studyGuides: `/teacher/study-guides?deckId=${cls.deckId}`,
      worksheets: `/teacher/worksheets?deckId=${cls.deckId}`,
      cards: buildTeacherClassDeckHref(cls.deckId),
    },
  };
}

function GroupedClassesList({
  classes,
  creatorDisplayByUserId,
  ownerUserId,
  ownerName,
  ownerEmail,
  memberMetaByUserId,
  deckResourcesByClassId,
  viewerUserId,
  isWorkspaceOwner,
  teamId,
  onClassDeleted,
}: {
  classes: TeacherClassWithDeck[];
  creatorDisplayByUserId: Record<string, TeacherClassCreatorDisplay>;
  ownerUserId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  memberMetaByUserId: Record<string, WorkspaceMemberMeta>;
  deckResourcesByClassId: Record<number, ClassDeckResources>;
  viewerUserId: string;
  isWorkspaceOwner: boolean;
  teamId: number | null;
  onClassDeleted: (classId: number) => void;
}) {
  const [collapsedAdminIds, setCollapsedAdminIds] = useState<Set<string>>(() => new Set());
  const [collapsedMemberKeys, setCollapsedMemberKeys] = useState<Set<string>>(() => new Set());

  const adminGroups = useMemo(
    () =>
      buildAdminLedMemberGroups(
        classes,
        (cls) => cls.userId,
        (userId) => creatorDisplayByUserId[userId]?.role ?? null,
        (userId, role) => {
          const display = creatorDisplayByUserId[userId];
          if (role === "owner") {
            return ownerName ?? ownerEmail ?? "Workspace owner";
          }
          return display?.name ?? display?.email ?? "Unknown member";
        },
        ownerUserId,
        ownerName,
        ownerEmail,
        memberMetaByUserId,
      ),
    [
      classes,
      creatorDisplayByUserId,
      ownerUserId,
      ownerName,
      ownerEmail,
      memberMetaByUserId,
    ],
  );

  function toggleAdminGroup(leaderUserId: string) {
    setCollapsedAdminIds((current) => {
      const next = new Set(current);
      if (next.has(leaderUserId)) next.delete(leaderUserId);
      else next.add(leaderUserId);
      return next;
    });
  }

  function toggleMemberGroup(leaderUserId: string, memberUserId: string) {
    const key = memberGroupKey(leaderUserId, memberUserId);
    setCollapsedMemberKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function canDeleteClass(cls: TeacherClassWithDeck): boolean {
    return cls.userId === viewerUserId || isWorkspaceOwner;
  }

  return (
    <div className="space-y-4">
      {adminGroups.map((adminGroup) => {
        const isAdminCollapsed = collapsedAdminIds.has(adminGroup.leaderUserId);
        const adminRoleLabel = memberRoleLabel(
          adminGroup.leaderRole === "owner" ? "owner" : "team_admin",
        );

        return (
          <div
            key={adminGroup.leaderUserId}
            className="overflow-hidden rounded-xl border border-border/80 bg-card/40"
          >
            <Button
              type="button"
              variant="ghost"
              className="h-auto w-full justify-start gap-2 rounded-none bg-muted/15 px-4 py-3 hover:bg-muted/20"
              onClick={() => toggleAdminGroup(adminGroup.leaderUserId)}
            >
              <ChevronDown
                className={cn(
                  "size-3.5 shrink-0 text-muted-foreground transition-transform",
                  isAdminCollapsed && "-rotate-90",
                )}
                aria-hidden
              />
              <span className="font-semibold text-foreground">{adminGroup.leaderLabel}</span>
              {adminRoleLabel ? (
                <Badge
                  variant="outline"
                  className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {adminRoleLabel}
                </Badge>
              ) : null}
              <span className="text-xs text-muted-foreground">
                {adminGroup.itemCount} class
                {adminGroup.itemCount === 1 ? "" : "es"}
              </span>
            </Button>

            {!isAdminCollapsed ? (
              <div className="space-y-4 border-t border-border/60 p-4">
                {adminGroup.leaderItems.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {adminGroup.leaderItems.map((cls) => (
                      <ClassCard
                        key={cls.id}
                        cls={cls}
                        resources={deckResourcesByClassId[cls.id] ?? fallbackResources(cls)}
                        canDelete={canDeleteClass(cls)}
                        teamId={teamId}
                        onDeleted={() => onClassDeleted(cls.id)}
                      />
                    ))}
                  </div>
                ) : null}

                {adminGroup.memberGroups.map((memberGroup) => {
                  const memberKey = memberGroupKey(
                    adminGroup.leaderUserId,
                    memberGroup.memberUserId,
                  );
                  const isMemberCollapsed = collapsedMemberKeys.has(memberKey);
                  const roleLabel = memberRoleLabel(memberGroup.memberRole);

                  return (
                    <div
                      key={memberKey}
                      className="overflow-hidden rounded-lg border border-border/70"
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto w-full justify-start gap-2 rounded-none bg-muted/10 px-4 py-2.5 hover:bg-muted/15"
                        onClick={() =>
                          toggleMemberGroup(adminGroup.leaderUserId, memberGroup.memberUserId)
                        }
                      >
                        <ChevronDown
                          className={cn(
                            "size-3.5 shrink-0 text-muted-foreground transition-transform",
                            isMemberCollapsed && "-rotate-90",
                          )}
                          aria-hidden
                        />
                        <span className="font-medium text-foreground">{memberGroup.memberLabel}</span>
                        {roleLabel ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                          >
                            {roleLabel}
                          </Badge>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          {memberGroup.items.length} class
                          {memberGroup.items.length === 1 ? "" : "es"}
                        </span>
                      </Button>
                      {!isMemberCollapsed ? (
                        <div className="grid gap-4 border-t border-border/50 p-4 sm:grid-cols-2">
                          {memberGroup.items.map((cls) => (
                            <ClassCard
                              key={cls.id}
                              cls={cls}
                              resources={deckResourcesByClassId[cls.id] ?? fallbackResources(cls)}
                              creatorLabel={memberGroup.memberLabel}
                              canDelete={canDeleteClass(cls)}
                              teamId={teamId}
                              onDeleted={() => onClassDeleted(cls.id)}
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function TeacherClassesView({
  classes: initialClasses,
  viewerUserId,
  creatorDisplayByUserId,
  ownerUserId,
  ownerName,
  ownerEmail,
  memberMetaByUserId,
  isWorkspaceOwner,
  decks,
  deckResourcesByClassId,
  workspace,
  backHref,
}: TeacherClassesViewProps) {
  const router = useRouter();
  const [classes, setClasses] = useState(initialClasses);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<ClassFilters>(INITIAL_CLASS_FILTERS);
  const [sortKey, setSortKey] = useState<ClassSortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<TeacherPageSize>(DEFAULT_TEACHER_PAGE_SIZE);

  useEffect(() => {
    setClasses(initialClasses);
  }, [initialClasses]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, filters, sortKey, sortDir, pageSize]);

  const filterOptions = useMemo(
    () => ({
      subject: distinctClassValues(classes, (cls) => classSubject(cls)),
      period: distinctClassValues(classes, (cls) => cls.period),
      academicYear: distinctClassValues(classes, (cls) => cls.academicYear),
      term: distinctClassValues(classes, (cls) => cls.termSemester),
      creator: [...new Map(
        classes.map((cls) => {
          const display = creatorDisplayByUserId[cls.userId];
          return [
            cls.userId,
            display?.name ?? display?.email ?? "Unknown creator",
          ] as const;
        }),
      ).entries()].map(([value, label]) => ({ value, label })),
    }),
    [classes, creatorDisplayByUserId],
  );

  const filteredClasses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let next = classes.filter((cls) => {
      if (!classMatchesFilters(cls, filters)) return false;
      if (!q) return true;
      const creatorLabel =
        creatorDisplayByUserId[cls.userId]?.name ??
        creatorDisplayByUserId[cls.userId]?.email ??
        null;
      return classHaystack(cls, creatorLabel).includes(q);
    });
    return sortClasses(next, sortKey, sortDir, creatorDisplayByUserId);
  }, [classes, searchQuery, filters, sortKey, sortDir, creatorDisplayByUserId]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 || hasActiveClassFilters(filters);

  const {
    paginatedItems: paginatedClasses,
    totalPages,
    safePage,
    pageStart,
    pageEnd,
  } = useMemo(
    () => paginateTeacherRecords(filteredClasses, page, pageSize),
    [filteredClasses, page, pageSize],
  );

  function handleClassDeleted(classId: number) {
    setClasses((current) => current.filter((cls) => cls.id !== classId));
    router.refresh();
  }

  function canDeleteClass(cls: TeacherClassWithDeck): boolean {
    return cls.userId === viewerUserId || isWorkspaceOwner;
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href={backHref}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Classes</h1>
            <p className="text-sm text-muted-foreground">
              Decks linked to classes used for lesson plan generation.
              {isWorkspaceOwner ? " Grouped by team admin." : ""}
            </p>
          </div>
        </div>
        <CreateTeacherClassDialog decks={decks} teamId={workspace.teamId} />
      </div>

      {decks.length === 0 ? (
        <Card className="border-border/80 bg-card/60">
          <CardContent className="py-8 text-sm leading-relaxed text-muted-foreground">
            Create or link a deck in your teacher workspace before adding a class schedule.
          </CardContent>
        </Card>
      ) : null}

      {classes.length === 0 ? (
        <Card className="border-border/80 bg-card/60">
          <CardContent className="py-8 text-sm leading-relaxed text-muted-foreground">
            No classes yet. Click <span className="font-medium text-foreground">Create class</span>{" "}
            to link a deck to an academic schedule slot.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-border/80 bg-card/60">
            <CardContent className="space-y-3 py-6">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[12rem] flex-1">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search classes…"
                    className="pl-9"
                    aria-label="Search classes"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => setFiltersOpen((open) => !open)}
                >
                  <SlidersHorizontal className="size-4" aria-hidden />
                  Filters
                  {hasActiveFilters ? (
                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                      On
                    </Badge>
                  ) : null}
                </Button>
                {hasActiveFilters ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground"
                    onClick={() => {
                      setSearchQuery("");
                      setFilters(INITIAL_CLASS_FILTERS);
                    }}
                  >
                    <X className="size-3.5" aria-hidden />
                    Clear
                  </Button>
                ) : null}
              </div>

              {filtersOpen ? (
                <div className="grid gap-3 rounded-lg border border-border/70 bg-muted/10 p-4 sm:grid-cols-2 lg:grid-cols-3">
                  <FilterSelect
                    id="class-subject"
                    label="Subject"
                    value={filters.subject}
                    options={filterOptions.subject.map((value) => ({ value, label: value }))}
                    onChange={(value) => setFilters((current) => ({ ...current, subject: value }))}
                  />
                  <FilterSelect
                    id="class-period"
                    label="Period"
                    value={filters.period}
                    options={filterOptions.period.map((value) => ({ value, label: value }))}
                    onChange={(value) => setFilters((current) => ({ ...current, period: value }))}
                  />
                  <FilterSelect
                    id="class-year"
                    label="Academic year"
                    value={filters.academicYear}
                    options={filterOptions.academicYear.map((value) => ({ value, label: value }))}
                    onChange={(value) =>
                      setFilters((current) => ({ ...current, academicYear: value }))
                    }
                  />
                  <FilterSelect
                    id="class-term"
                    label="Term"
                    value={filters.term}
                    options={filterOptions.term.map((value) => ({ value, label: value }))}
                    onChange={(value) => setFilters((current) => ({ ...current, term: value }))}
                  />
                  {isWorkspaceOwner ? (
                    <FilterSelect
                      id="class-creator"
                      label="Creator"
                      value={filters.creator}
                      options={filterOptions.creator}
                      onChange={(value) =>
                        setFilters((current) => ({ ...current, creator: value }))
                      }
                    />
                  ) : null}
                  <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                    <Label htmlFor="class-sort">Sort by</Label>
                    <div className="flex flex-wrap gap-2">
                      <select
                        id="class-sort"
                        className={cn(nativeSelectClassName, "max-w-xs flex-1")}
                        value={sortKey}
                        onChange={(e) => setSortKey(e.target.value as ClassSortKey)}
                      >
                        <option value="createdAt">Date created</option>
                        <option value="subject">Subject</option>
                        <option value="period">Period</option>
                        <option value="academicYear">Academic year</option>
                        <option value="creator">Creator</option>
                      </select>
                      <select
                        className={cn(nativeSelectClassName, "w-28 shrink-0")}
                        value={sortDir}
                        onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
                        aria-label="Sort direction"
                      >
                        <option value="desc">Desc</option>
                        <option value="asc">Asc</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : null}

              <TeacherRecordsCountBar
                idPrefix="teacher-classes"
                pageStart={pageStart}
                pageEnd={pageEnd}
                filteredCount={filteredClasses.length}
                totalCount={classes.length}
                recordLabel="class"
                pageSize={pageSize}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            </CardContent>
          </Card>

          {filteredClasses.length === 0 ? (
            <Card className="border-border/80 bg-card/60">
              <CardContent className="py-8 text-sm text-muted-foreground">
                No classes match your search or filters.
              </CardContent>
            </Card>
          ) : isWorkspaceOwner ? (
            <>
              <GroupedClassesList
                classes={paginatedClasses}
                creatorDisplayByUserId={creatorDisplayByUserId}
                ownerUserId={ownerUserId}
                ownerName={ownerName}
                ownerEmail={ownerEmail}
                memberMetaByUserId={memberMetaByUserId}
                deckResourcesByClassId={deckResourcesByClassId}
                viewerUserId={viewerUserId}
                isWorkspaceOwner={isWorkspaceOwner}
                teamId={workspace.teamId}
                onClassDeleted={handleClassDeleted}
              />
              <TeacherRecordPagination
                page={safePage}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                {paginatedClasses.map((cls) => (
                  <ClassCard
                    key={cls.id}
                    cls={cls}
                    resources={deckResourcesByClassId[cls.id] ?? fallbackResources(cls)}
                    canDelete={canDeleteClass(cls)}
                    teamId={workspace.teamId}
                    onDeleted={() => handleClassDeleted(cls.id)}
                  />
                ))}
              </div>
              <TeacherRecordPagination
                page={safePage}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
