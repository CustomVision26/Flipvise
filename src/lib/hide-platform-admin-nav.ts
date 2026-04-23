/**
 * Team admin UI, workspace management pages, and `/admin` where global workspace
 * switching (and on some routes platform admin shortcuts) are suppressed in the header.
 */
export function isDashboardTeamAdminOrWorkspaceManagementRoute(
  pathname: string | null,
): boolean {
  if (!pathname) return false;
  if (
    pathname === "/dashboard/team-admin" ||
    pathname.startsWith("/dashboard/team-admin/")
  ) {
    return true;
  }
  if (
    pathname === "/dashboard/workspaces" ||
    pathname.startsWith("/dashboard/workspaces/")
  ) {
    return true;
  }
  if (
    pathname === "/dashboard/workspace" ||
    pathname.startsWith("/dashboard/workspace/")
  ) {
    return true;
  }
  return false;
}

/** Hide platform `/admin` link and workspace "To Admin Dash" on these routes. */
export function shouldHidePlatformAdminNav(pathname: string | null): boolean {
  return isDashboardTeamAdminOrWorkspaceManagementRoute(pathname);
}

/** Hide personal/team workspace dropdown (includes Personal · Pro row). */
export function shouldHideWorkspaceSwitcher(pathname: string | null): boolean {
  if (pathname === "/admin" || pathname?.startsWith("/admin/")) {
    return true;
  }
  return isDashboardTeamAdminOrWorkspaceManagementRoute(pathname);
}
