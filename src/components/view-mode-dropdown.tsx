"use client";

import { LayoutGrid, List, Rows3, Check, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const showSort =
    sort !== undefined &&
    onSortChange !== undefined &&
    sortOptions !== undefined &&
    sortOptions.length > 0;

  return (
    <DropdownMenu>
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
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
            View as
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {VIEW_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isActive = opt.value === view;
            return (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => onViewChange(opt.value)}
                className="gap-2.5 cursor-pointer"
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                />
                <div className="flex flex-1 flex-col">
                  <span className="text-sm leading-none">{opt.label}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {opt.description}
                  </span>
                </div>
                {isActive && (
                  <Check className="size-3.5 text-foreground shrink-0" />
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>

        {showSort && (
          <DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <ArrowUpDown className="size-3" />
              Sort by
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {sortOptions!.map((opt) => {
              const isActive = opt.value === sort;
              return (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => onSortChange!(opt.value)}
                  className="gap-2.5 cursor-pointer"
                >
                  <span className="flex-1 text-sm">{opt.label}</span>
                  {isActive && (
                    <Check className="size-3.5 text-foreground shrink-0" />
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
