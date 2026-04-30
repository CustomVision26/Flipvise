import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function DeckLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4 sm:gap-8 p-4 sm:p-8">
      {/* Deck header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-64 max-w-full sm:h-10" />
          <Skeleton className="h-4 w-48 max-w-full" />
        </div>
        <div className="flex flex-col gap-2 lg:items-end">
          <Skeleton className="h-9 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
      </div>

      {/* Meta row */}
      <Skeleton className="h-4 w-56" />

      {/* Cards section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-9 w-24" />
        </div>
        {/* Controls bar */}
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-28" />
          </div>
        </div>
        {/* Card list */}
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="flex flex-row items-start gap-4 px-4 py-3">
              <CardHeader className="p-0 flex-1 min-w-0">
                <Skeleton className="h-4 w-48 max-w-full" />
              </CardHeader>
              <CardContent className="p-0 flex-1 min-w-0">
                <Skeleton className="h-4 w-40 max-w-full" />
              </CardContent>
              <div className="flex gap-1">
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
