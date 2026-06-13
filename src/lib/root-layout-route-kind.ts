/** Controls which root-layout server fetches run before paint. */
export type RootLayoutShellProfile =
  | "guest"
  | "admin"
  | "team-admin"
  | "dashboard"
  | "full";

export function resolveRootLayoutShellProfile(
  pathname: string,
  userId: string | null | undefined,
): RootLayoutShellProfile {
  if (!userId) return "guest";
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/dashboard/team-admin")) return "team-admin";
  if (pathname.startsWith("/dashboard")) return "dashboard";
  return "full";
}

export function rootLayoutShellNeedsTeamNav(
  profile: RootLayoutShellProfile,
): boolean {
  return (
    profile === "team-admin" ||
    profile === "dashboard" ||
    profile === "full"
  );
}

export function rootLayoutShellNeedsInboxBadge(
  profile: RootLayoutShellProfile,
): boolean {
  return profile !== "guest" && profile !== "admin";
}

export function rootLayoutShellNeedsAffiliatePortal(
  profile: RootLayoutShellProfile,
): boolean {
  return (
    profile === "dashboard" ||
    profile === "full"
  );
}

export function rootLayoutShellNeedsFullPlanLabels(
  profile: RootLayoutShellProfile,
): boolean {
  return (
    profile === "team-admin" ||
    profile === "dashboard" ||
    profile === "full"
  );
}

export function rootLayoutShellNeedsHelpCenterGate(
  profile: RootLayoutShellProfile,
  isAdmin: boolean,
  adminGranted: boolean,
): boolean {
  if (profile === "guest" || profile === "admin") return false;
  return !isAdmin && !adminGranted;
}
