"use client";

import dynamic from "next/dynamic";
import { FlipviseLoader } from "@/components/flipvise-loader";
import type { TeamDeckAssignListProps } from "@/components/team-deck-assign-list";

const TeamDeckAssignList = dynamic(
  () =>
    import("@/components/team-deck-assign-list").then((m) => m.TeamDeckAssignList),
  {
    ssr: false,
    loading: () => (
      <FlipviseLoader variant="inline" message="Loading deck manager…" className="py-4" />
    ),
  },
);

export function TeamDeckAssignListLoader(props: TeamDeckAssignListProps) {
  return <TeamDeckAssignList {...props} />;
}
