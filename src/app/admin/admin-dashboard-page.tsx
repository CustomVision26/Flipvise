import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, LayoutDashboard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  AdminOverviewMetricsPanel,
  AdminOverviewMetricsProvider,
  AdminOverviewMetricsToggle,
} from "@/components/admin-overview-stats-collapsible";
import { AdminOverviewStats } from "@/components/admin/admin-overview-stats";
import { AdminSupportAlertsHeader } from "@/components/admin/admin-support-alerts-header";
import { AdminTabsPanel } from "@/components/admin/admin-tabs-panel";
import {
  AdminOverviewStatsSkeleton,
  AdminTabsPanelSkeleton,
} from "@/components/admin/admin-dashboard-skeletons";
import { teamAdminCardClass } from "@/components/team-admin-panel-styles";
import { assertAdminDashboardAccess } from "@/lib/admin/assert-admin-access";
import type { AdminDashboardSection } from "@/lib/admin-dashboard-section";
import { DEFAULT_ADMIN_DASHBOARD_SECTION } from "@/lib/admin-dashboard-section";
import { cn } from "@/lib/utils";

type Props = {
  section?: AdminDashboardSection;
};

export default async function AdminDashboardPage({
  section = DEFAULT_ADMIN_DASHBOARD_SECTION,
}: Props) {
  const { userId, callerIsSuperadmin, personalDashboardLink } =
    await assertAdminDashboardAccess();

  return (
    <AdminOverviewMetricsProvider>
      <div className="flex w-full flex-col gap-6">
        <Card
          className={cn(
            teamAdminCardClass,
            "overflow-hidden backdrop-blur-md animate-in fade-in-0 duration-300",
          )}
        >
          <CardHeader className="gap-4 pb-4 sm:pb-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Platform administration
                </p>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    Admin Dashboard
                  </h1>
                  <Badge variant="outline" className="h-6 px-2.5 text-xs font-medium">
                    {callerIsSuperadmin ? "Superadmin" : "Admin"}
                  </Badge>
                </div>
                <CardDescription className="max-w-3xl text-sm leading-relaxed sm:text-[0.9375rem]">
                  Monitor and manage users, billing, support, and plans across Flipvise.
                  Use the sidebar to open each admin workspace.
                </CardDescription>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 self-start">
                <Suspense fallback={null}>
                  <AdminSupportAlertsHeader />
                </Suspense>
                <AdminOverviewMetricsToggle />
                <Link
                  href={personalDashboardLink}
                  className={cn(
                    buttonVariants({ variant: "default", size: "default" }),
                    "inline-flex h-9 items-center gap-2 font-medium",
                  )}
                >
                  <LayoutDashboard className="size-4" aria-hidden />
                  Personal Dashboard
                  <ArrowRight className="size-4 opacity-70" aria-hidden />
                </Link>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Suspense fallback={<AdminOverviewStatsSkeleton />}>
          <AdminOverviewMetricsPanel>
            <AdminOverviewStats />
          </AdminOverviewMetricsPanel>
        </Suspense>

        <Suspense fallback={<AdminTabsPanelSkeleton />}>
          <AdminTabsPanel
            section={section}
            currentUserId={userId}
            callerIsSuperadmin={callerIsSuperadmin}
          />
        </Suspense>
      </div>
    </AdminOverviewMetricsProvider>
  );
}
