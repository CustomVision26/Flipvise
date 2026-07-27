import { FlipviseLoaderStatic } from "@/components/flipvise-loader-static";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 p-4 sm:gap-7 sm:p-8">
        <FlipviseLoaderStatic
          variant="inline"
          message="Loading your decks…"
          className="py-1"
        />

        <section className="rounded-2xl border border-border/70 bg-card/55 p-5 shadow-lg sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-9 w-64 max-w-full sm:h-10" />
              <Skeleton className="h-4 w-44 max-w-full" />
            </div>
            <Skeleton className="h-9 w-28 shrink-0 sm:h-10" />
          </div>
        </section>

        <section className="flex flex-1 flex-col gap-4 rounded-2xl border border-border/70 bg-card/50 p-4 shadow-xl sm:p-6">
          <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-3">
            <Skeleton className="h-4 w-32" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-28" />
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-20 w-full rounded-xl"
                style={{ animationDelay: `${i * 40}ms` }}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
