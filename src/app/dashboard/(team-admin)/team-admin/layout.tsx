import type { Metadata } from "next";
import { Suspense } from "react";
import { auth } from "@/lib/clerk-auth";
import { redirect } from "next/navigation";
import { userHasTeamAdminDashboardAccess } from "@/db/queries/teams";
import { redirectIfPlanReconciliationPending } from "@/lib/plan-reconciliation-gate";
import { tryTeamQuery } from "@/lib/team-query-fallback";
import { TeamAdminDashboardShell } from "@/components/team-admin-dashboard-shell";
import { TeamAdminTopDashboardBar } from "@/components/team-admin-top-dashboard-bar";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Team Admin",
};

function TeamAdminTopBarSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/80 bg-card/60 px-3 py-2.5">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-9 w-36" />
      <Skeleton className="h-9 w-32" />
      <Skeleton className="h-9 w-40" />
    </div>
  );
}

export default async function TeamAdminRouteGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  await redirectIfPlanReconciliationPending(userId);

  const allowed = await tryTeamQuery(
    () => userHasTeamAdminDashboardAccess(userId),
    false,
  );
  if (!allowed) {
    redirect("/dashboard");
  }

  return (
    <section
      aria-label="Team administration"
      className="flex min-h-0 flex-1 flex-col"
      data-route-group="team-admin"
    >
      <TeamAdminDashboardShell
        topBar={
          <Suspense fallback={<TeamAdminTopBarSkeleton />}>
            <TeamAdminTopDashboardBar />
          </Suspense>
        }
      >
        {children}
      </TeamAdminDashboardShell>
    </section>
  );
}
