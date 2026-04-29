import { Skeleton } from "@/components/ui/skeleton";

export default function StudyLoading() {
  return (
    <div className="flex flex-1 flex-col items-center gap-4 sm:gap-8 p-4 sm:p-8">
      {/* Progress bar area */}
      <div className="w-full max-w-2xl flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>

      {/* Flashcard skeleton */}
      <div className="w-full max-w-2xl">
        <Skeleton className="w-full min-h-[300px] sm:min-h-[400px] md:h-[540px] rounded-2xl" />
      </div>

      {/* Navigation buttons skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-24 rounded-md" />
        <Skeleton className="h-10 w-20 rounded-md" />
        <Skeleton className="h-10 w-24 rounded-md" />
      </div>
    </div>
  );
}
