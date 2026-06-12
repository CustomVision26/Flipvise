import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  adminOverviewMetricsGridClass,
  adminOverviewMetricsLabelClass,
  adminOverviewMetricsShellClass,
  adminOverviewStatCardClass,
} from "@/components/admin-panel-styles";
import { cn } from "@/lib/utils";

export function AdminOverviewStatsSkeleton() {
  return (
    <div className={adminOverviewMetricsShellClass} aria-busy aria-label="Loading overview metrics">
      <p className={adminOverviewMetricsLabelClass}>Overview metrics</p>
      <div className={adminOverviewMetricsGridClass}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className={cn(adminOverviewStatCardClass, "animate-pulse")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function AdminTabsPanelSkeleton() {
  return (
    <div
      className="space-y-3 rounded-xl border-2 border-primary/30 p-4 ring-1 ring-primary/10"
      aria-busy
      aria-label="Loading admin panel"
    >
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-9 w-full max-w-md" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
