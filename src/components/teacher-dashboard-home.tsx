import Link from "next/link";
import { ArrowRight, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { teamAdminCardClass } from "@/components/team-admin-panel-styles";
import { TEACHER_DASHBOARD_NAV } from "@/lib/teacher-dashboard-nav";

export function TeacherDashboardHome({
  planLabel,
  workspaceNote,
  teamAdminHref = null,
}: {
  planLabel: string;
  workspaceNote: string;
  teamAdminHref?: string | null;
}) {
  const toolCount = TEACHER_DASHBOARD_NAV.reduce(
    (count, section) => count + section.items.length,
    0,
  );

  return (
    <div className="flex w-full flex-col gap-6">
      <Card className={cn(teamAdminCardClass, "overflow-hidden backdrop-blur-md")}>
        <CardHeader className="gap-4 pb-4 sm:pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Teacher workspace
              </p>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Teacher Dashboard
                </h1>
                <Badge variant="outline" className="h-6 px-2.5 text-xs font-medium">
                  {planLabel}
                </Badge>
              </div>
              <CardDescription className="max-w-3xl text-sm leading-relaxed sm:text-[0.9375rem]">
                {workspaceNote}
              </CardDescription>
            </div>
            {teamAdminHref ? (
              <Link
                href={teamAdminHref}
                className={cn(
                  buttonVariants({ variant: "outline", size: "default" }),
                  "inline-flex h-9 shrink-0 items-center gap-2 self-start font-medium",
                )}
              >
                <LayoutDashboard className="size-4" aria-hidden />
                Team Admin Dashboard
                <ArrowRight className="size-4 opacity-70" aria-hidden />
              </Link>
            ) : null}
          </div>
        </CardHeader>
      </Card>

      <Card className={cn(teamAdminCardClass, "backdrop-blur-sm")}>
        <CardHeader className="gap-2">
          <h2 className="text-base font-semibold text-foreground">Welcome</h2>
          <CardDescription className="text-sm leading-relaxed">
            Use the sidebar to open any teacher tool. AI content tools, classroom
            management, and saved resources are grouped by category with quick links to
            each page. You have {toolCount} tools available in this workspace.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
