"use client";

import { TeamDeckAssignList } from "@/components/team-deck-assign-list";
import type { TeamDeckAssignListProps } from "@/components/team-deck-assign-list";

/** Eager import so Capacitor WebView always loads the same bundle as the web app (no stale lazy chunk).
 * Import this from the Server Component page (not `next/dynamic`) so deck-assign
 * Server Actions stay in this route’s action map.
 */
export function TeamDeckAssignListLoader(props: TeamDeckAssignListProps) {
  return <TeamDeckAssignList {...props} />;
}
