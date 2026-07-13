import { AdminSupportNotificationsMenu } from "@/components/admin-support-notifications-menu";
import { getAdminSupportNotificationsAction } from "@/actions/support-admin";

export async function AdminSupportAlertsHeader() {
  const { notifications, unreadCount } = await getAdminSupportNotificationsAction();
  return (
    <AdminSupportNotificationsMenu
      unreadCount={unreadCount}
      notifications={notifications}
    />
  );
}
