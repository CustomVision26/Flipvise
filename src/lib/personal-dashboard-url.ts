/**
 * Personal dashboard URL — no query string.
 * Plan, tier, and user identity for authorization come from the Clerk session
 * (`getAccessContext()` on the server), not from URL parameters, so nothing
 * sensitive is exposed in the address bar, referrers, or access logs.
 */
export function personalDashboardHref(): string {
  return "/dashboard";
}
