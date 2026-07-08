"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
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
  deleteTeacherResourceAction,
} from "@/actions/teacher-resources";
import type {
  TeacherResourceLibraryItem,
  TeacherResourceLibrarySection,
} from "@/db/queries/teacher-resource-library";
import {
  buildAdminLedSubjectGroups,
  type WorkspaceMemberMeta,
} from "@/lib/teacher-workspace-member-grouping";
import { cn } from "@/lib/utils";

const FILTER_ALL = "__all__";

type SortKey = "savedAt" | "title" | "subject" | "gradeLevel" | "creator";

type ResourceFilters = {
  subject: string;
  gradeLevel: string;
  creator: string;
};

const INITIAL_RESOURCE_FILTERS: ResourceFilters = {
  subject: FILTER_ALL,
  gradeLevel: FILTER_ALL,
  creator: FILTER_ALL,
};

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
const DEFAULT_PAGE_SIZE: PageSize = 10;

function buildPageList(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | "ellipsis")[] = [];
  const showLeftEllipsis = current > 3;
  const showRightEllipsis = current < total - 2;

  pages.push(1);
  if (showLeftEllipsis) pages.push("ellipsis");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (showRightEllipsis) pages.push("ellipsis");
  pages.push(total);
  return pages;
}

const nativeSelectClassName = cn(
  "h-10 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 py-2 text-sm text-foreground",
  "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30",
);

type TeacherResourceLibraryViewProps = {
  sections: TeacherResourceLibrarySection[];
  viewerUserId: string;
  teamId: number | null;
  ownerUserId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  memberMetaByUserId: Record<string, WorkspaceMemberMeta>;
  isWorkspaceOwner: boolean;
  lessonBuilderHref: string;
  homeworkHref: string;
};

function leaderRoleLabel(role: "owner" | "team_admin"): string {
  return role === "owner" ? "Owner" : "Admin";
}

function adminGroupKey(sectionId: string, leaderUserId: string): string {
  return `${sectionId}:${leaderUserId}`;
}

function subjectGroupKey(
  sectionId: string,
  leaderUserId: string,
  subject: string,
): string {
  return `${sectionId}:${leaderUserId}:${subject}`;
}

function formatSavedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getTime() === 0) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isDeletableSection(
  sectionId: TeacherResourceLibrarySection["id"],
): sectionId is "lessonPlans" | "homework" {
  return sectionId === "lessonPlans" || sectionId === "homework";
}

function canDeleteItem(
  item: TeacherResourceLibraryItem,
  sectionId: TeacherResourceLibrarySection["id"],
  viewerUserId: string,
  isWorkspaceOwner: boolean,
): boolean {
  if (!isDeletableSection(sectionId) || item.isPlaceholder) return false;
  return item.creatorUserId === viewerUserId || isWorkspaceOwner;
}

function resolveResourceId(
  item: TeacherResourceLibraryItem,
  sectionId: TeacherResourceLibrarySection["id"],
): number | null {
  if (sectionId === "lessonPlans") return item.lessonPlanId;
  if (sectionId === "homework") return item.homeworkId;
  return null;
}

function itemHaystack(item: TeacherResourceLibraryItem): string {
  return [
    item.title,
    item.subject,
    item.gradeLevel,
    item.difficultyLevel,
    item.creatorName,
    item.creatorEmail,
    item.sourceLabel,
  ]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .toLowerCase();
}

function distinctItemValues(
  items: TeacherResourceLibraryItem[],
  pick: (item: TeacherResourceLibraryItem) => string | null | undefined,
): string[] {
  const values = new Set<string>();
  for (const item of items) {
    const value = pick(item)?.trim();
    if (value) values.add(value);
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}

function hasActiveResourceFilters(filters: ResourceFilters): boolean {
  return Object.values(filters).some((value) => value !== FILTER_ALL);
}

function itemMatchesFilters(
  item: TeacherResourceLibraryItem,
  filters: ResourceFilters,
): boolean {
  if (filters.subject !== FILTER_ALL && item.subject !== filters.subject) {
    return false;
  }
  if (filters.gradeLevel !== FILTER_ALL && item.gradeLevel !== filters.gradeLevel) {
    return false;
  }
  if (filters.creator !== FILTER_ALL && item.creatorUserId !== filters.creator) {
    return false;
  }
  return true;
}

function sortItems(
  items: TeacherResourceLibraryItem[],
  sortKey: SortKey,
  sortDir: "asc" | "desc",
): TeacherResourceLibraryItem[] {
  const dir = sortDir === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "title":
        cmp = a.title.localeCompare(b.title);
        break;
      case "subject":
        cmp = a.subject.localeCompare(b.subject);
        break;
      case "gradeLevel":
        cmp = a.gradeLevel.localeCompare(b.gradeLevel);
        break;
      case "creator": {
        const aLabel = a.creatorName ?? a.creatorEmail ?? "";
        const bLabel = b.creatorName ?? b.creatorEmail ?? "";
        cmp = aLabel.localeCompare(bLabel);
        break;
      }
      case "savedAt":
      default:
        cmp = new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime();
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

function ResourceDeleteButton({
  item,
  sectionId,
  teamId,
  onDeleted,
}: {
  item: TeacherResourceLibraryItem;
  sectionId: TeacherResourceLibrarySection["id"];
  teamId: number | null;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const resourceId = resolveResourceId(item, sectionId);

  if (!isDeletableSection(sectionId) || resourceId == null) return null;

  const resourceType = sectionId;
  const resolvedResourceId = resourceId;

  function handleConfirm() {
    setOpen(false);
    startTransition(async () => {
      await deleteTeacherResourceAction({
        resourceType,
        resourceId: resolvedResourceId,
        teamId,
      });
      onDeleted();
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
        aria-label={`Delete ${item.title}`}
      >
        <Trash2 className="size-3.5" aria-hidden />
        {isPending ? "…" : "Delete"}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this resource?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <span className="font-medium text-foreground">{item.title}</span>{" "}
              from your resource library. This action cannot be undone.
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

function ResourceItemCard({
  item,
  sectionId,
  teamId,
  canDelete,
  onDeleted,
}: {
  item: TeacherResourceLibraryItem;
  sectionId: TeacherResourceLibrarySection["id"];
  teamId: number | null;
  canDelete: boolean;
  onDeleted: () => void;
}) {
  const creatorLabel = item.creatorName ?? item.creatorEmail ?? "Unknown creator";
  const savedLabel = formatSavedDate(item.savedAt);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium text-foreground">{item.title}</p>
        <p className="text-sm text-muted-foreground">
          {item.subject} · {item.gradeLevel}
          {item.difficultyLevel ? ` · ${item.difficultyLevel}` : ""}
        </p>
        {item.sourceLabel ? (
          <p className="text-xs text-muted-foreground">{item.sourceLabel}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {creatorLabel}
          {savedLabel ? ` · Saved ${savedLabel}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {item.pdfUrl ? (
          <a
            href={item.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            PDF
          </a>
        ) : null}
        {sectionId === "lessonPlans" && item.quizHref ? (
          <Link
            href={item.quizHref}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Create Quiz
          </Link>
        ) : null}
        {canDelete ? (
          <ResourceDeleteButton
            item={item}
            sectionId={sectionId}
            teamId={teamId}
            onDeleted={onDeleted}
          />
        ) : null}
        {item.isPlaceholder ? (
          <Badge variant="secondary">Placeholder</Badge>
        ) : (
          <Badge variant="secondary">Saved</Badge>
        )}
      </div>
    </div>
  );
}

function ResourceFiltersBar({
  sectionId,
  items,
  searchQuery,
  onSearchChange,
  filters,
  onFiltersChange,
  sortKey,
  onSortKeyChange,
  sortDir,
  onSortDirChange,
  filtersOpen,
  onFiltersOpenChange,
  filteredCount,
  pageStart,
  pageEnd,
  pageSize,
  onPageSizeChange,
  isWorkspaceOwner,
}: {
  sectionId: TeacherResourceLibrarySection["id"];
  items: TeacherResourceLibraryItem[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filters: ResourceFilters;
  onFiltersChange: (filters: ResourceFilters) => void;
  sortKey: SortKey;
  onSortKeyChange: (value: SortKey) => void;
  sortDir: "asc" | "desc";
  onSortDirChange: (value: "asc" | "desc") => void;
  filtersOpen: boolean;
  onFiltersOpenChange: (open: boolean) => void;
  filteredCount: number;
  pageStart: number;
  pageEnd: number;
  pageSize: PageSize;
  onPageSizeChange: (size: PageSize) => void;
  isWorkspaceOwner: boolean;
}) {
  const filterOptions = useMemo(
    () => ({
      subject: distinctItemValues(items, (item) => item.subject),
      gradeLevel: distinctItemValues(items, (item) => item.gradeLevel),
      creator: [...new Map(
        items.map((item) => [
          item.creatorUserId,
          item.creatorName ?? item.creatorEmail ?? "Unknown creator",
        ]),
      ).entries()].map(([value, label]) => ({ value, label })),
    }),
    [items],
  );

  const hasActiveFilters =
    searchQuery.trim().length > 0 || hasActiveResourceFilters(filters);

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search resources…"
            className="pl-9"
            aria-label={`Search ${sectionId}`}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => onFiltersOpenChange(!filtersOpen)}
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
              onSearchChange("");
              onFiltersChange(INITIAL_RESOURCE_FILTERS);
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
            id={`${sectionId}-subject`}
            label="Subject"
            value={filters.subject}
            options={filterOptions.subject.map((value) => ({ value, label: value }))}
            onChange={(value) => onFiltersChange({ ...filters, subject: value })}
          />
          <FilterSelect
            id={`${sectionId}-grade`}
            label="Grade level"
            value={filters.gradeLevel}
            options={filterOptions.gradeLevel.map((value) => ({ value, label: value }))}
            onChange={(value) => onFiltersChange({ ...filters, gradeLevel: value })}
          />
          {isWorkspaceOwner ? (
            <FilterSelect
              id={`${sectionId}-creator`}
              label="Creator"
              value={filters.creator}
              options={filterOptions.creator}
              onChange={(value) => onFiltersChange({ ...filters, creator: value })}
            />
          ) : null}
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
            <Label htmlFor={`${sectionId}-sort`}>Sort by</Label>
            <div className="flex flex-wrap gap-2">
              <select
                id={`${sectionId}-sort`}
                className={cn(nativeSelectClassName, "max-w-xs flex-1")}
                value={sortKey}
                onChange={(e) => onSortKeyChange(e.target.value as SortKey)}
              >
                <option value="savedAt">Date saved</option>
                <option value="title">Title</option>
                <option value="subject">Subject</option>
                <option value="gradeLevel">Grade level</option>
                <option value="creator">Creator</option>
              </select>
              <select
                className={cn(nativeSelectClassName, "w-28 shrink-0")}
                value={sortDir}
                onChange={(e) => onSortDirChange(e.target.value as "asc" | "desc")}
                aria-label="Sort direction"
              >
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </select>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground tabular-nums">
          {filteredCount === 0
            ? `Showing 0 of ${items.length} resource${items.length === 1 ? "" : "s"}`
            : `Showing ${pageStart}–${pageEnd} of ${filteredCount} resource${filteredCount === 1 ? "" : "s"}`}
        </p>
        {filteredCount > 0 ? (
          <div className="flex items-center gap-1.5">
            <Label htmlFor={`${sectionId}-page-size`} className="sr-only">
              Records per page
            </Label>
            <select
              id={`${sectionId}-page-size`}
              className={cn(nativeSelectClassName, "h-8 w-[7.5rem] text-xs")}
              value={String(pageSize)}
              onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ResourceRecordPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pageList = buildPageList(page, totalPages);

  function goToPage(target: number) {
    if (target < 1 || target > totalPages) return;
    onPageChange(target);
  }

  return (
    <Pagination className="pt-4">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            aria-disabled={page === 1}
            className={page === 1 ? "pointer-events-none opacity-50" : undefined}
            onClick={(e) => {
              e.preventDefault();
              goToPage(page - 1);
            }}
          />
        </PaginationItem>
        {pageList.map((item, index) =>
          item === "ellipsis" ? (
            <PaginationItem key={`ellipsis-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <PaginationLink
                href="#"
                isActive={item === page}
                onClick={(e) => {
                  e.preventDefault();
                  goToPage(item);
                }}
              >
                {item}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PaginationNext
            href="#"
            aria-disabled={page === totalPages}
            className={
              page === totalPages ? "pointer-events-none opacity-50" : undefined
            }
            onClick={(e) => {
              e.preventDefault();
              goToPage(page + 1);
            }}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

function GroupedResourceSection({
  section,
  items,
  ownerUserId,
  ownerName,
  ownerEmail,
  memberMetaByUserId,
  lessonBuilderHref,
  homeworkHref,
  teamId,
  viewerUserId,
  isWorkspaceOwner,
  onItemDeleted,
}: {
  section: TeacherResourceLibrarySection;
  items: TeacherResourceLibraryItem[];
  ownerUserId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  memberMetaByUserId: Record<string, WorkspaceMemberMeta>;
  lessonBuilderHref: string;
  homeworkHref: string;
  teamId: number | null;
  viewerUserId: string;
  isWorkspaceOwner: boolean;
  onItemDeleted: (itemKey: string) => void;
}) {
  const [collapsedAdminKeys, setCollapsedAdminKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [collapsedSubjectKeys, setCollapsedSubjectKeys] = useState<Set<string>>(
    () => new Set(),
  );

  const adminGroups = useMemo(
    () =>
      buildAdminLedSubjectGroups(
        items,
        ownerUserId,
        ownerName,
        ownerEmail,
        memberMetaByUserId,
        (leaderUserId, leaderRole) => {
          if (leaderRole === "owner") {
            return ownerName ?? ownerEmail ?? "Workspace owner";
          }
          const meta = memberMetaByUserId[leaderUserId];
          return meta?.name ?? meta?.email ?? "Team admin";
        },
      ),
    [items, ownerUserId, ownerName, ownerEmail, memberMetaByUserId],
  );

  function toggleAdminGroup(leaderUserId: string) {
    const key = adminGroupKey(section.id, leaderUserId);
    setCollapsedAdminKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSubjectGroup(leaderUserId: string, subject: string) {
    const key = subjectGroupKey(section.id, leaderUserId, subject);
    setCollapsedSubjectKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {section.emptyMessage}
        {section.id === "lessonPlans" ? (
          <>
            {" "}
            <Link href={lessonBuilderHref} className="underline underline-offset-2">
              AI Lesson Builder
            </Link>
            .
          </>
        ) : null}
        {section.id === "homework" ? (
          <>
            {" "}
            <Link href={homeworkHref} className="underline underline-offset-2">
              Homework Generator
            </Link>
            .
          </>
        ) : null}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {adminGroups.map((adminGroup) => {
        const adminKey = adminGroupKey(section.id, adminGroup.leaderUserId);
        const isAdminCollapsed = collapsedAdminKeys.has(adminKey);

        return (
          <div
            key={adminKey}
            className="overflow-hidden rounded-lg border border-border/70"
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
              <Badge
                variant="outline"
                className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                {leaderRoleLabel(adminGroup.leaderRole)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {adminGroup.itemCount} resource
                {adminGroup.itemCount === 1 ? "" : "s"}
              </span>
            </Button>

            {!isAdminCollapsed ? (
              <div className="space-y-2 border-t border-border/60 p-3">
                {adminGroup.subjectGroups.map((subjectGroup) => {
                  const subjectKey = subjectGroupKey(
                    section.id,
                    adminGroup.leaderUserId,
                    subjectGroup.subject,
                  );
                  const isSubjectCollapsed = collapsedSubjectKeys.has(subjectKey);

                  return (
                    <div
                      key={subjectKey}
                      className="overflow-hidden rounded-lg border border-border/60"
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto w-full justify-start gap-2 rounded-none bg-muted/10 px-4 py-2.5 hover:bg-muted/15"
                        onClick={() =>
                          toggleSubjectGroup(adminGroup.leaderUserId, subjectGroup.subject)
                        }
                      >
                        <ChevronDown
                          className={cn(
                            "size-3.5 shrink-0 text-muted-foreground transition-transform",
                            isSubjectCollapsed && "-rotate-90",
                          )}
                          aria-hidden
                        />
                        <span className="font-medium text-foreground">
                          {subjectGroup.subject}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {subjectGroup.items.length} item
                          {subjectGroup.items.length === 1 ? "" : "s"}
                        </span>
                      </Button>
                      {!isSubjectCollapsed ? (
                        <div className="space-y-2 border-t border-border/50 p-3">
                          {subjectGroup.items.map((item) => (
                            <ResourceItemCard
                              key={item.key}
                              item={item}
                              sectionId={section.id}
                              teamId={teamId}
                              canDelete={canDeleteItem(
                                item,
                                section.id,
                                viewerUserId,
                                isWorkspaceOwner,
                              )}
                              onDeleted={() => onItemDeleted(item.key)}
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

function buildSubjectOnlyGroups(
  items: TeacherResourceLibraryItem[],
  sortKey: SortKey,
  sortDir: "asc" | "desc",
): Array<{ subject: string; items: TeacherResourceLibraryItem[] }> {
  const subjectMap = new Map<string, TeacherResourceLibraryItem[]>();

  for (const item of items) {
    const subject = item.subject.trim() || "Other";
    const bucket = subjectMap.get(subject) ?? [];
    bucket.push(item);
    subjectMap.set(subject, bucket);
  }

  return [...subjectMap.entries()]
    .map(([subject, groupItems]) => ({
      subject,
      items: sortItems(groupItems, sortKey, sortDir),
    }))
    .sort((a, b) => a.subject.localeCompare(b.subject));
}

function subjectOnlyGroupKey(sectionId: string, subject: string): string {
  return `${sectionId}:${subject}`;
}

function SubjectGroupedResourceSection({
  section,
  items,
  lessonBuilderHref,
  homeworkHref,
  teamId,
  viewerUserId,
  isWorkspaceOwner,
  sortKey,
  sortDir,
  onItemDeleted,
}: {
  section: TeacherResourceLibrarySection;
  items: TeacherResourceLibraryItem[];
  lessonBuilderHref: string;
  homeworkHref: string;
  teamId: number | null;
  viewerUserId: string;
  isWorkspaceOwner: boolean;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onItemDeleted: (itemKey: string) => void;
}) {
  const [collapsedSubjectKeys, setCollapsedSubjectKeys] = useState<Set<string>>(
    () => new Set(),
  );

  const subjectGroups = useMemo(
    () => buildSubjectOnlyGroups(items, sortKey, sortDir),
    [items, sortKey, sortDir],
  );

  function toggleSubjectGroup(subject: string) {
    const key = subjectOnlyGroupKey(section.id, subject);
    setCollapsedSubjectKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {section.emptyMessage}
        {section.id === "lessonPlans" ? (
          <>
            {" "}
            <Link href={lessonBuilderHref} className="underline underline-offset-2">
              AI Lesson Builder
            </Link>
            .
          </>
        ) : null}
        {section.id === "homework" ? (
          <>
            {" "}
            <Link href={homeworkHref} className="underline underline-offset-2">
              Homework Generator
            </Link>
            .
          </>
        ) : null}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {subjectGroups.map((subjectGroup) => {
        const subjectKey = subjectOnlyGroupKey(section.id, subjectGroup.subject);
        const isSubjectCollapsed = collapsedSubjectKeys.has(subjectKey);

        return (
          <div
            key={subjectKey}
            className="overflow-hidden rounded-lg border border-border/70"
          >
            <Button
              type="button"
              variant="ghost"
              className="h-auto w-full justify-start gap-2 rounded-none bg-muted/15 px-4 py-3 hover:bg-muted/20"
              onClick={() => toggleSubjectGroup(subjectGroup.subject)}
            >
              <ChevronDown
                className={cn(
                  "size-3.5 shrink-0 text-muted-foreground transition-transform",
                  isSubjectCollapsed && "-rotate-90",
                )}
                aria-hidden
              />
              <span className="font-semibold text-foreground">{subjectGroup.subject}</span>
              <span className="text-xs text-muted-foreground">
                {subjectGroup.items.length} item
                {subjectGroup.items.length === 1 ? "" : "s"}
              </span>
            </Button>
            {!isSubjectCollapsed ? (
              <div className="space-y-2 border-t border-border/60 p-3">
                {subjectGroup.items.map((item) => (
                  <ResourceItemCard
                    key={item.key}
                    item={item}
                    sectionId={section.id}
                    teamId={teamId}
                    canDelete={canDeleteItem(
                      item,
                      section.id,
                      viewerUserId,
                      isWorkspaceOwner,
                    )}
                    onDeleted={() => onItemDeleted(item.key)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ResourceSectionPanel({
  section,
  ownerUserId,
  ownerName,
  ownerEmail,
  memberMetaByUserId,
  isWorkspaceOwner,
  lessonBuilderHref,
  homeworkHref,
  teamId,
  viewerUserId,
  onItemDeleted,
}: {
  section: TeacherResourceLibrarySection;
  ownerUserId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  memberMetaByUserId: Record<string, WorkspaceMemberMeta>;
  isWorkspaceOwner: boolean;
  lessonBuilderHref: string;
  homeworkHref: string;
  teamId: number | null;
  viewerUserId: string;
  onItemDeleted: (sectionId: TeacherResourceLibrarySection["id"], itemKey: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<ResourceFilters>(INITIAL_RESOURCE_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>("savedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return section.items.filter((item) => {
      if (!itemMatchesFilters(item, filters)) return false;
      if (!q) return true;
      return itemHaystack(item).includes(q);
    });
  }, [section.items, searchQuery, filters]);

  const displayItems = useMemo(
    () => sortItems(filteredItems, sortKey, sortDir),
    [filteredItems, sortKey, sortDir],
  );

  const totalPages = Math.max(1, Math.ceil(displayItems.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, displayItems.length);
  const paginatedItems = displayItems.slice(startIndex, endIndex);
  const pageStart = displayItems.length === 0 ? 0 : startIndex + 1;
  const pageEnd = endIndex;

  useEffect(() => {
    setPage(1);
  }, [searchQuery, filters, sortKey, sortDir, section.items.length, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <>
      {section.items.length > 0 ? (
        <ResourceFiltersBar
          sectionId={section.id}
          items={section.items}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filters={filters}
          onFiltersChange={setFilters}
          sortKey={sortKey}
          onSortKeyChange={setSortKey}
          sortDir={sortDir}
          onSortDirChange={setSortDir}
          filtersOpen={filtersOpen}
          onFiltersOpenChange={setFiltersOpen}
          filteredCount={filteredItems.length}
          pageStart={pageStart}
          pageEnd={pageEnd}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          isWorkspaceOwner={isWorkspaceOwner}
        />
      ) : null}

      {isWorkspaceOwner ? (
        <GroupedResourceSection
          section={section}
          items={paginatedItems}
          ownerUserId={ownerUserId}
          ownerName={ownerName}
          ownerEmail={ownerEmail}
          memberMetaByUserId={memberMetaByUserId}
          lessonBuilderHref={lessonBuilderHref}
          homeworkHref={homeworkHref}
          teamId={teamId}
          viewerUserId={viewerUserId}
          isWorkspaceOwner={isWorkspaceOwner}
          onItemDeleted={(itemKey) => onItemDeleted(section.id, itemKey)}
        />
      ) : (
        <SubjectGroupedResourceSection
          section={section}
          items={paginatedItems}
          lessonBuilderHref={lessonBuilderHref}
          homeworkHref={homeworkHref}
          teamId={teamId}
          viewerUserId={viewerUserId}
          isWorkspaceOwner={isWorkspaceOwner}
          sortKey={sortKey}
          sortDir={sortDir}
          onItemDeleted={(itemKey) => onItemDeleted(section.id, itemKey)}
        />
      )}

      <ResourceRecordPagination
        page={safePage}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </>
  );
}

export function TeacherResourceLibraryView({
  sections: initialSections,
  viewerUserId,
  teamId,
  ownerUserId,
  ownerName,
  ownerEmail,
  memberMetaByUserId,
  isWorkspaceOwner,
  lessonBuilderHref,
  homeworkHref,
}: TeacherResourceLibraryViewProps) {
  const router = useRouter();
  const [sections, setSections] = useState(initialSections);

  useEffect(() => {
    setSections(initialSections);
  }, [initialSections]);

  const defaultTab = sections[0]?.id ?? "lessonPlans";

  function handleItemDeleted(
    sectionId: TeacherResourceLibrarySection["id"],
    itemKey: string,
  ) {
    setSections((current) =>
      current.map((section) =>
        section.id === sectionId
          ? { ...section, items: section.items.filter((item) => item.key !== itemKey) }
          : section,
      ),
    );
    router.refresh();
  }

  return (
    <Tabs defaultValue={defaultTab} className="w-full gap-4">
      <div className="-mx-1 overflow-x-auto px-1">
        <TabsList
          variant="line"
          className="h-auto w-max min-w-full justify-start gap-1 rounded-none border-b border-border/80 bg-transparent p-0"
        >
          {sections.map((section) => (
            <TabsTrigger
              key={section.id}
              value={section.id}
              className="rounded-none px-3 py-2.5 after:bottom-0"
            >
              {section.title}
              <span className="text-xs font-normal text-muted-foreground tabular-nums">
                ({section.items.length})
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {sections.map((section) => (
        <TabsContent key={section.id} value={section.id} className="mt-0">
          <Card className="border-border/80 bg-card/60">
            {isWorkspaceOwner ? (
              <CardDescription className="px-6 pt-6">
                Grouped by team admin, then subject. Click a group to expand or collapse.
              </CardDescription>
            ) : (
              <CardDescription className="px-6 pt-6">
                Grouped by subject, newest to oldest. Click a subject to expand or collapse.
              </CardDescription>
            )}
            <CardContent className="pt-4 pb-6">
              <ResourceSectionPanel
                section={section}
                ownerUserId={ownerUserId}
                ownerName={ownerName}
                ownerEmail={ownerEmail}
                memberMetaByUserId={memberMetaByUserId}
                isWorkspaceOwner={isWorkspaceOwner}
                lessonBuilderHref={lessonBuilderHref}
                homeworkHref={homeworkHref}
                teamId={teamId}
                viewerUserId={viewerUserId}
                onItemDeleted={handleItemDeleted}
              />
            </CardContent>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  );
}
