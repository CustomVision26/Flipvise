"use client";

/**
 * Reserved for post-auth App Router sync. Intentionally does not call
 * `router.refresh()` — that raced Clerk modal portal teardown and header
 * Radix/Clerk portals (`removeChild on null` in React 19).
 *
 * Auth handoff uses `/auth/continue` (server redirect) so layout data is
 * already fresh when `/dashboard` loads.
 */
export function ClerkSessionRouterSync() {
  return null;
}
