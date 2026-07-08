"use client";

import { Suspense, useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { TeacherDashboardNavPanel } from "@/components/teacher-dashboard-nav";

function TeacherNavSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-3">
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

export function TeacherDashboardShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6 lg:flex-row lg:items-start lg:gap-8">
      <aside className="hidden w-60 shrink-0 lg:block xl:w-64">
        <div className="sticky top-20">
          <Suspense fallback={<TeacherNavSkeleton />}>
            <TeacherDashboardNavPanel />
          </Suspense>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex items-center lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button variant="outline" size="sm" className="gap-2">
                  <Menu className="size-4" aria-hidden />
                  Teacher menu
                </Button>
              }
            />
            <SheetContent side="left" className="w-[min(100vw-2rem,18rem)] gap-0 p-0">
              <SheetHeader className="border-b border-border px-4 py-3 text-left">
                <SheetTitle className="text-base">Teacher tools</SheetTitle>
              </SheetHeader>
              <div className="overflow-y-auto p-3">
                <Suspense fallback={<TeacherNavSkeleton />}>
                  <TeacherDashboardNavPanel
                    className="border-0 bg-transparent p-0 shadow-none backdrop-blur-none"
                    onNavigate={() => setMobileOpen(false)}
                  />
                </Suspense>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
