import type { Metadata } from "next";
import { Suspense } from "react";
import { requireTeacherDashboardAccess } from "@/lib/teacher-access";
import { TeacherDashboardShell } from "@/components/teacher-dashboard-shell";
import { TeacherTopDashboardBar } from "@/components/teacher-top-dashboard-bar";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Teacher Dashboard",
};

function TeacherTopBarSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/80 bg-card/60 px-3 py-2.5">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-9 w-36" />
      <Skeleton className="h-9 w-32" />
      <Skeleton className="h-9 w-40" />
    </div>
  );
}

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTeacherDashboardAccess();
  return (
    <section
      aria-label="Teacher dashboard"
      className="relative flex min-h-0 flex-1 flex-col"
      data-route-group="teacher"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-background/30 backdrop-blur-[1px]"
        aria-hidden
      />
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
        <TeacherDashboardShell
          topBar={
            <Suspense fallback={<TeacherTopBarSkeleton />}>
              <TeacherTopDashboardBar />
            </Suspense>
          }
        >
          {children}
        </TeacherDashboardShell>
      </div>
    </section>
  );
}
