import { cn } from "@/lib/utils";
import { tabPanelContentClass } from "@/lib/tab-panel-styles";

export const adminMenuCardClass =
  "h-fit border-border/70 bg-card/85 shadow-sm backdrop-blur-sm";

export const adminMenuHeaderClass = "border-b border-border/50 px-4 pb-3 pt-4";

export const adminMenuTitleClass =
  "text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground";

export const adminMenuContentClass = "space-y-1 p-3";

export function adminMenuTabClass(isActive: boolean) {
  return cn(
    "w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-all duration-200",
    isActive
      ? "border-primary bg-primary/10 font-semibold text-foreground shadow-sm ring-1 ring-primary/20"
      : "border-transparent text-muted-foreground hover:border-border/60 hover:bg-muted/30 hover:text-foreground",
  );
}

export const adminSectionCardClass = cn(tabPanelContentClass, "min-w-0 shadow-md");

export const adminSubTabPanelClass = cn(
  tabPanelContentClass,
  "mt-4 p-4",
);

export const adminSectionTitleClass = "text-lg font-semibold tracking-tight";

export const adminFilterInputClass =
  "h-9 min-w-0 border-border/70 bg-background/60";

export const adminShowMenuButtonClass =
  "inline-flex items-center gap-2 rounded-lg border border-border/70 bg-card/80 px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted/40";

export const adminMenuIconButtonClass =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground";

/** Overview metrics outer shell — bold border + entrance motion. */
export const adminOverviewMetricsShellClass = cn(
  tabPanelContentClass,
  "p-4 shadow-md sm:p-5",
  "animate-in fade-in-0 slide-in-from-top-2 duration-500 fill-mode-both",
);

export const adminOverviewMetricsLabelClass =
  "mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground";

export const adminOverviewMetricsGridClass =
  "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5";

export const adminOverviewStatCardClass = cn(
  "border border-border/60 bg-background/50 shadow-sm backdrop-blur-sm",
  "transition-all duration-300 ease-out",
  "hover:-translate-y-0.5 hover:border-primary/35 hover:bg-background/80 hover:shadow-md",
);

export const adminOverviewMetricsToggleClass = cn(
  adminShowMenuButtonClass,
  "h-8 gap-2 text-xs sm:text-sm",
);

/** Support Center — outer shell. */
export const adminSupportShellClass = cn(
  tabPanelContentClass,
  "p-4 shadow-md sm:p-5",
  "animate-in fade-in-0 slide-in-from-top-2 duration-500 fill-mode-both",
);

export const adminSupportSectionLabelClass =
  "mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground";

export const adminSupportKpiGridClass =
  "grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4";

export const adminSupportKpiCardClass = cn(
  "border-2 border-border/70 bg-background/50 shadow-sm backdrop-blur-sm",
  "transition-all duration-300 ease-out",
  "hover:-translate-y-0.5 hover:border-primary/35 hover:bg-background/80 hover:shadow-md",
);

export const adminSupportChartCardClass = cn(
  "border-2 border-border/70 bg-background/40 shadow-sm backdrop-blur-sm",
  "transition-all duration-300 ease-out",
  "hover:border-primary/30 hover:shadow-md",
);

export const adminSupportTableCardClass = cn(
  adminSupportChartCardClass,
  "overflow-hidden",
);

export const adminSupportFilterBarClass =
  "grid gap-2 border-b border-border/60 bg-muted/20 p-4 md:grid-cols-2 lg:grid-cols-4";

export const adminSupportEmptyStateClass =
  "flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 bg-muted/10 px-4 text-center";

/** Plans tab — bordered sub-panels (pricing editor, plan history). */
export const adminPlansSubTabPanelClass = cn(
  adminSubTabPanelClass,
  "space-y-4 shadow-sm",
);

export const adminPlanHistoryTableShellClass = cn(
  "overflow-hidden rounded-lg border-2 border-border/70 bg-background/40",
);
