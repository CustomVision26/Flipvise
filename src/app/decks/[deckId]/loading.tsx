import { FlipviseLoaderStatic } from "@/components/flipvise-loader-static";
import { Skeleton } from "@/components/ui/skeleton";

export default function DeckLoading() {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 sm:gap-8 sm:p-8">
        <FlipviseLoaderStatic
          variant="inline"
          message="Loading deck…"
          className="py-1"
        />

        <section className="rounded-2xl border border-border/80 bg-card/60 p-5 shadow-lg sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:justify-between lg:gap-8">
            <div className="flex min-w-0 flex-1 flex-col gap-5">
              <Skeleton className="h-3 w-24" />
              <div className="space-y-2.5">
                <Skeleton className="h-5 w-28 rounded-full" />
                <Skeleton className="h-10 w-72 max-w-full" />
                <Skeleton className="h-4 w-56 max-w-full" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 w-28 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-36 rounded-full" />
              </div>
              <Skeleton className="h-1.5 w-full max-w-md rounded-full" />
            </div>
            <aside className="w-full shrink-0 space-y-4 rounded-xl border border-border/70 bg-background/60 p-4 sm:p-5 lg:max-w-sm">
              <div className="flex items-start gap-3">
                <Skeleton className="size-9 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-md" />
              <div className="flex gap-2 border-t border-border/60 pt-4">
                <Skeleton className="h-9 w-28" />
              </div>
            </aside>
          </div>
        </section>

        <section className="flex flex-1 flex-col gap-5 rounded-2xl border border-border/80 bg-card/80 p-4 shadow-lg sm:p-6">
          <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-4">
            <div className="space-y-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-3 w-40" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-[7.25rem]" />
              <Skeleton className="h-9 w-28" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-4 w-36" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-28" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-28 w-full rounded-xl"
                style={{ animationDelay: `${i * 40}ms` }}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
