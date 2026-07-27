import { FlipviseLoaderStatic } from "@/components/flipvise-loader-static";
import { Skeleton } from "@/components/ui/skeleton";

export default function StudyLoading() {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 p-4 sm:gap-7 sm:p-8">
        <FlipviseLoaderStatic
          variant="inline"
          message="Preparing study session…"
          className="py-1"
        />

        <section className="rounded-2xl border border-border/70 bg-card/55 p-5 shadow-lg sm:p-7">
          <div className="space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-28 rounded-full" />
            <Skeleton className="h-9 w-72 max-w-full" />
            <Skeleton className="h-4 w-56 max-w-full" />
          </div>
        </section>

        <div className="mx-auto w-full max-w-2xl rounded-2xl border border-border/70 bg-card/55 px-4 py-3 sm:px-5">
          <Skeleton className="mx-auto mb-2 h-3 w-20" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>

        <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4">
          <div className="w-full space-y-3 rounded-2xl border border-border/70 bg-card/50 p-4">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
          <Skeleton className="w-full max-w-xl min-h-[220px] rounded-2xl sm:min-h-[300px]" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-24 rounded-md" />
            <Skeleton className="h-10 w-20 rounded-md" />
            <Skeleton className="h-10 w-24 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
