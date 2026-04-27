"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState, useEffect, useTransition } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X, ChevronUp, ChevronDown } from "lucide-react";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

function formatPlanLabel(slug: string): string {
  if (slug === "pro") return "Pro";
  return slug
    .split(/[_-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

type Props = {
  availablePlans: string[];
  availableYears: number[];
  currentYear: number;
  selectedYear: number;
  selectedMonth: number | null;
  currentSort: string;
  currentOrder: string;
  currentSearch: string;
  currentPlan: string;
};

export function PaidSubscribersFilters({
  availablePlans,
  availableYears,
  currentYear,
  selectedYear,
  selectedMonth,
  currentSort,
  currentOrder,
  currentSearch,
  currentPlan,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [searchValue, setSearchValue] = useState(currentSearch);

  useEffect(() => {
    setSearchValue(currentSearch);
  }, [currentSearch]);

  const update = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }
      startTransition(() => {
        router.push(`${pathname}?${next.toString()}`, { scroll: false });
      });
    },
    [router, pathname, params],
  );

  // Debounce search → URL
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== currentSearch) {
        update({ q: searchValue || null });
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  const hasFilters =
    currentSearch ||
    currentPlan ||
    selectedYear !== currentYear ||
    selectedMonth !== null ||
    currentSort !== "date" ||
    currentOrder !== "desc";

  const clearAll = () => {
    setSearchValue("");
    startTransition(() => {
      router.push(pathname, { scroll: false });
    });
  };

  return (
    <div
      className={`space-y-3 transition-opacity duration-150 ${isPending ? "opacity-50 pointer-events-none" : ""}`}
    >
      {/* ── Row 1: search + plan + sort ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Search by name or email…"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="w-60 h-8 text-sm"
        />

        <Select
          value={currentPlan || "__all__"}
          onValueChange={(v) => update({ plan: v === "__all__" ? null : v })}
        >
          <SelectTrigger className="w-44 h-8 text-sm">
            <SelectValue placeholder="All Plans" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Plans</SelectItem>
            {availablePlans.map((p) => (
              <SelectItem key={p} value={p}>
                {formatPlanLabel(p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={currentSort}
          onValueChange={(v) => update({ sort: v })}
        >
          <SelectTrigger className="w-44 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Sort: Date</SelectItem>
            <SelectItem value="name">Sort: Name</SelectItem>
            <SelectItem value="plan">Sort: Plan</SelectItem>
            <SelectItem value="price">Sort: Price</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() =>
            update({ order: currentOrder === "asc" ? "desc" : "asc" })
          }
        >
          {currentOrder === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5 mr-1.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 mr-1.5" />
          )}
          {currentOrder === "asc" ? "Oldest first" : "Newest first"}
        </Button>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={clearAll}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Clear filters
          </Button>
        )}
      </div>

      {/* ── Row 2: year pills ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground uppercase tracking-wide shrink-0 w-10">
          Year
        </span>
        <div className="flex gap-1.5 flex-wrap">
          {availableYears.map((y) => (
            <Button
              key={y}
              variant={selectedYear === y ? "default" : "outline"}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => update({ year: String(y) })}
            >
              {y}
            </Button>
          ))}
        </div>
      </div>

      {/* ── Row 3: month pills ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground uppercase tracking-wide shrink-0 w-10">
          Month
        </span>
        <div className="flex gap-1.5 flex-wrap">
          <Button
            variant={selectedMonth === null ? "default" : "outline"}
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => update({ month: null })}
          >
            All
          </Button>
          {MONTH_LABELS.map((label, i) => (
            <Button
              key={label}
              variant={selectedMonth === i + 1 ? "default" : "outline"}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() =>
                update({ month: selectedMonth === i + 1 ? null : String(i + 1) })
              }
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
