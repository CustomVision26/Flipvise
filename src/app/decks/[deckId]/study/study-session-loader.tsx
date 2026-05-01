"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { StudySessionProps } from "./study-session";

const StudySessionDynamic = dynamic<StudySessionProps>(
  () => import("./study-session").then((m) => m.StudySession),
  {
    // Avoids Turbopack dev SSR "module factory is not available" for this client tree.
    ssr: false,
    loading: () => (
      <div className="flex w-full max-w-2xl flex-1 flex-col gap-4 self-center">
        <Skeleton className="mx-auto h-9 w-64 rounded-md" />
        <Skeleton className="min-h-[280px] w-full rounded-2xl sm:min-h-[380px]" />
        <div className="flex justify-center gap-3">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>
    ),
  },
);

export function StudySessionLoader(props: StudySessionProps) {
  return <StudySessionDynamic {...props} />;
}
