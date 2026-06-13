import { AdminTabs } from "@/components/admin-tabs";
import type { AdminDashboardSection } from "@/lib/admin-dashboard-section";
import { loadAdminTabsData } from "@/lib/admin/load-admin-dashboard-data";
import { getAffiliateInviteExpiryDays } from "@/lib/affiliate-invite-expiry";
import { getAdminSupportNotificationsAction } from "@/actions/support-admin";

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
  const supportAlerts = await getAdminSupportNotificationsAction();

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
      supportNotifications={supportAlerts.notifications}
      supportUnreadCount={supportAlerts.unreadCount}
      plansConfig={data.plansConfig}
      affiliates={data.affiliates}
      affiliateInviteDefaultExpiresInDays={getAffiliateInviteExpiryDays()}
    />
  );
}
