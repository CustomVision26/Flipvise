export type AdminDashboardSection =
  | "all-users"
  | "team-workspaces"
  | "subscription"
  | "invoices"
  | "admin-roles"
  | "support-center"
  | "plans"
  | "marketing-affiliates"
  | "documentation";

export const DEFAULT_ADMIN_DASHBOARD_SECTION: AdminDashboardSection = "all-users";

export function adminDashboardSectionFromPath(pathname: string): AdminDashboardSection {
  if (pathname === "/admin/team-workspaces") return "team-workspaces";
  if (pathname === "/admin/subscription") return "subscription";
  if (pathname === "/admin/invoices") return "invoices";
  if (pathname === "/admin/admin-roles" || pathname === "/admin/audit-log") return "admin-roles";
  if (pathname === "/admin/support-center" || pathname.startsWith("/admin/support-center/")) {
    return "support-center";
  }
  if (pathname === "/admin/plans" || pathname === "/admin/plan-history" || pathname === "/admin/affiliate-messaging" || pathname === "/admin/plan-trials") return "plans";
  if (pathname === "/admin/marketing-affiliates") return "marketing-affiliates";
  if (pathname === "/admin/documentation") return "documentation";
  return DEFAULT_ADMIN_DASHBOARD_SECTION;
}
