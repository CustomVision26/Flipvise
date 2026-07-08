"use client";

import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

export const TEACHER_PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const;
export type TeacherPageSize = (typeof TEACHER_PAGE_SIZE_OPTIONS)[number];
export const DEFAULT_TEACHER_PAGE_SIZE: TeacherPageSize = 10;

const nativeSelectClassName = cn(
  "h-8 w-[7.5rem] rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground",
  "outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30",
);

export function buildTeacherPageList(
  current: number,
  total: number,
): (number | "ellipsis")[] {
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

export function paginateTeacherRecords<T>(
  items: T[],
  page: number,
  pageSize: TeacherPageSize,
): {
  paginatedItems: T[];
  totalPages: number;
  safePage: number;
  pageStart: number;
  pageEnd: number;
} {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, items.length);

  return {
    paginatedItems: items.slice(startIndex, endIndex),
    totalPages,
    safePage,
    pageStart: items.length === 0 ? 0 : startIndex + 1,
    pageEnd: endIndex,
  };
}

export function TeacherRecordsCountBar({
  idPrefix,
  pageStart,
  pageEnd,
  filteredCount,
  totalCount,
  recordLabel,
  pageSize,
  onPageSizeChange,
}: {
  idPrefix: string;
  pageStart: number;
  pageEnd: number;
  filteredCount: number;
  totalCount: number;
  recordLabel: string;
  pageSize: TeacherPageSize;
  onPageSizeChange: (size: TeacherPageSize) => void;
}) {
  const plural = filteredCount === 1 ? recordLabel : `${recordLabel}s`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-muted-foreground tabular-nums">
        {filteredCount === 0
          ? `Showing 0 of ${totalCount} ${plural}`
          : `Showing ${pageStart}–${pageEnd} of ${filteredCount} ${plural}`}
        {filteredCount !== totalCount ? ` (${totalCount} total)` : ""}
      </p>
      {filteredCount > 0 ? (
        <div className="flex items-center gap-1.5">
          <Label htmlFor={`${idPrefix}-page-size`} className="sr-only">
            Records per page
          </Label>
          <select
            id={`${idPrefix}-page-size`}
            className={nativeSelectClassName}
            value={String(pageSize)}
            onChange={(e) => onPageSizeChange(Number(e.target.value) as TeacherPageSize)}
          >
            {TEACHER_PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}

export function TeacherRecordPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pageList = buildTeacherPageList(page, totalPages);

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
            className={page === totalPages ? "pointer-events-none opacity-50" : undefined}
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
