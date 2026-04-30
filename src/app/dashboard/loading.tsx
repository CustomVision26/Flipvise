import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4 sm:gap-6 p-4 sm:p-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-9 w-52 max-w-full sm:h-10" />
          <Skeleton className="h-4 w-40 max-w-full" />
        </div>
        <Skeleton className="h-9 w-28 shrink-0 sm:h-10" />
      </div>

      {/* Controls bar */}
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-4 w-32" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>

      {/* Deck cards */}
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="flex flex-row items-center gap-4 px-4 py-3">
            <CardHeader className="p-0 flex-1 min-w-0">
              <Skeleton className="h-4 w-48 max-w-full" />
              <Skeleton className="h-3 w-32 max-w-full mt-1.5" />
            </CardHeader>
            <CardContent className="p-0 flex items-center gap-6">
              <Skeleton className="h-4 w-14 hidden sm:block" />
              <Skeleton className="h-4 w-28 hidden sm:block" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
