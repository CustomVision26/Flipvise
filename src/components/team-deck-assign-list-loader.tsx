"use client";

import { TeamDeckAssignList } from "@/components/team-deck-assign-list";
import type { TeamDeckAssignListProps } from "@/components/team-deck-assign-list";

/** Eager import so Capacitor WebView always loads the same bundle as the web app (no stale lazy chunk). */
export function TeamDeckAssignListLoader(props: TeamDeckAssignListProps) {
  return <TeamDeckAssignList {...props} />;
}
