import { AdminTabs } from "@/components/admin-tabs";
import type { AdminDashboardSection } from "@/lib/admin-dashboard-section";
import { loadAdminTabsData } from "@/lib/admin/load-admin-dashboard-data";
import { getAffiliateInviteExpiryDays } from "@/lib/affiliate-invite-expiry";

type Props = {
  section: AdminDashboardSection;
  currentUserId: string;
  callerIsSuperadmin: boolean;
};

export async function AdminTabsPanel({
  section,
  currentUserId,
  callerIsSuperadmin,
}: Props) {
  const data = await loadAdminTabsData(section);

  return (
    <AdminTabs
      currentUserId={currentUserId}
      callerIsSuperadmin={callerIsSuperadmin}
      users={data.users}
      logs={data.logs}
      planAssignmentLogs={data.planAssignmentLogs}
      subscriptions={data.subscriptions}
      invoices={data.invoices}
      supportTickets={data.supportTickets}
      supportStats={data.supportStats}
      plansConfig={data.plansConfig}
      affiliates={data.affiliates}
      affiliateInviteDefaultExpiresInDays={getAffiliateInviteExpiryDays()}
    />
  );
}
