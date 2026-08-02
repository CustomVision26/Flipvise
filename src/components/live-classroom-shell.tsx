"use client";

import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { LiveClassroomNav } from "@/components/live-classroom-nav";
import { teamAdminCardClass } from "@/components/team-admin-panel-styles";
import { cn } from "@/lib/utils";

export function LiveClassroomShell({
  teamId,
  children,
}: {
  teamId: number;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6 lg:flex-row lg:items-start lg:gap-8">
      <aside className="hidden w-60 shrink-0 lg:block xl:w-64">
        <div className="sticky top-20">
          <div
            className={cn(
              teamAdminCardClass,
              "rounded-xl border border-border/80 bg-card/80 p-3 backdrop-blur-sm",
            )}
          >
            <p className="mb-3 px-2.5 text-sm font-semibold tracking-tight text-foreground">
              Live Classroom™
            </p>
            <LiveClassroomNav teamId={teamId} />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex items-center lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button variant="outline" size="sm" className="gap-2">
                  <Menu className="size-4" aria-hidden />
                  Live Classroom menu
                </Button>
              }
            />
            <SheetContent side="left" className="w-[min(100vw-2rem,18rem)] gap-0 p-0">
              <SheetHeader className="border-b border-border px-4 py-3 text-left">
                <SheetTitle className="text-base">Live Classroom™</SheetTitle>
              </SheetHeader>
              <div className="overflow-y-auto p-3">
                <LiveClassroomNav
                  teamId={teamId}
                  onNavigate={() => setMobileOpen(false)}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
