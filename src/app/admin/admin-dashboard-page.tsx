import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  AdminOverviewMetricsProvider,
  AdminOverviewMetricsToggle,
} from "@/components/admin-overview-stats-collapsible";
import { AdminOverviewStats } from "@/components/admin/admin-overview-stats";
import { AdminTabsPanel } from "@/components/admin/admin-tabs-panel";
import {
  AdminOverviewStatsSkeleton,
  AdminTabsPanelSkeleton,
} from "@/components/admin/admin-dashboard-skeletons";
import { assertAdminDashboardAccess } from "@/lib/admin/assert-admin-access";
import type { AdminDashboardSection } from "@/lib/admin-dashboard-section";
import { DEFAULT_ADMIN_DASHBOARD_SECTION } from "@/lib/admin-dashboard-section";

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
      <div className="flex flex-1 flex-col gap-5 sm:gap-8 p-4 sm:p-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:gap-4">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Platform administration
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Admin Dashboard
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
              Monitor and manage all users across Flipvise
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto sm:justify-end">
            <AdminOverviewMetricsToggle />
            <Link
              href={personalDashboardLink}
              className={
                buttonVariants({ variant: "outline", size: "sm" }) +
                " shrink-0 text-xs sm:text-sm h-8 sm:h-9"
              }
            >
              <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" aria-hidden />
              Personal Dashboard
            </Link>
          </div>
        </div>

        <Suspense fallback={<AdminOverviewStatsSkeleton />}>
          <AdminOverviewStats />
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
