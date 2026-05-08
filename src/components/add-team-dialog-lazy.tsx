"use client";

import { AddTeamDialog } from "@/components/add-team-dialog";
import type { TeamPlanId } from "@/lib/team-plans";

export type AddTeamDialogLazyProps = {
  planSlug: TeamPlanId;
  isAtLimit?: boolean;
  triggerLabel?: string;
  triggerTooltip?: string;
};

/**
 * Client boundary for Server Components — no nested `dynamic({ ssr: false })` (Turbopack-safe).
 */
export function AddTeamDialogLazy(props: AddTeamDialogLazyProps) {
  return <AddTeamDialog {...props} />;
}
