"use client";

import { useEffect, useState } from "react";
import { LayoutGrid, List, Rows3, Check, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type ViewMode = "grid" | "list" | "compact";

export type SortOption<T extends string = string> = {
  value: T;
  label: string;
};

const VIEW_OPTIONS: {
  value: ViewMode;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    value: "grid",
    label: "Grid",
    description: "Detailed cards",
    icon: LayoutGrid,
  },
  {
    value: "list",
    label: "List",
    description: "One per row",
    icon: List,
  },
  {
    value: "compact",
    label: "Compact",
    description: "Small tiles",
    icon: Rows3,
  },
];

interface ViewModeDropdownProps<T extends string = string> {
  view: ViewMode;
  onViewChange: (value: ViewMode) => void;
  sort?: T;
  onSortChange?: (value: T) => void;
  sortOptions?: SortOption<T>[];
}

export function ViewModeDropdown<T extends string = string>({
  view,
  onViewChange,
  sort,
  onSortChange,
  sortOptions,
}: ViewModeDropdownProps<T>) {
  const activeView =
    VIEW_OPTIONS.find((o) => o.value === view) ?? VIEW_OPTIONS[0];
  const ActiveViewIcon = activeView.icon;
  const sortMenu =
    sort !== undefined && onSortChange && sortOptions && sortOptions.length > 0
      ? { sort, onSortChange, sortOptions }
      : null;
  const activeSort = sortMenu?.sortOptions.find(
    (option) => option.value === sortMenu.sort,
  )?.label;
  const [submenuSide, setSubmenuSide] = useState<"left" | "bottom">("left");

  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const apply = () => setSubmenuSide(query.matches ? "bottom" : "left");
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  return (
    <DropdownMenu>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger render={<span className="inline-flex" />}>
            <DropdownMenuTrigger
              render={(props) => (
                <Button
                  {...props}
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 px-2.5 text-xs"
                  aria-label={`View (currently ${activeView.label})`}
                >
                  <ActiveViewIcon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">View</span>
                </Button>
              )}
            />
          </TooltipTrigger>
          <TooltipContent>
            Change layout{sortMenu ? " or sort order" : ""}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="cursor-pointer gap-2.5 py-2">
            <ActiveViewIcon className="size-4 shrink-0 text-foreground" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm leading-none">View as</span>
              <span className="text-[11px] text-muted-foreground">
                {activeView.label}
              </span>
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent side={submenuSide} className="w-56">
            {VIEW_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isActive = opt.value === view;
              return (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => onViewChange(opt.value)}
                  className="cursor-pointer gap-2.5"
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      isActive ? "text-foreground" : "text-muted-foreground",
                    )}
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm leading-none">{opt.label}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {opt.description}
                    </span>
                  </span>
                  {isActive && (
                    <Check className="size-3.5 shrink-0 text-foreground" />
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {sortMenu && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer gap-2.5 py-2">
              <ArrowUpDown className="size-4 shrink-0 text-foreground" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm leading-none">Sort by</span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {activeSort}
                </span>
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent side={submenuSide} className="w-56">
              {sortMenu.sortOptions.map((opt) => {
                const isActive = opt.value === sortMenu.sort;
                return (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => sortMenu.onSortChange(opt.value)}
                    className="cursor-pointer gap-2.5"
                  >
                    <span className="flex-1 text-sm">{opt.label}</span>
                    {isActive && (
                      <Check className="size-3.5 shrink-0 text-foreground" />
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
