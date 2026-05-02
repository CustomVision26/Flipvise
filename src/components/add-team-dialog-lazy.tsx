"use client";

import dynamic from "next/dynamic";
import type { TeamPlanId } from "@/lib/team-plans";

const AddTeamDialog = dynamic(
  () =>
    import("@/components/add-team-dialog").then((mod) => ({
      default: mod.AddTeamDialog,
    })),
  { ssr: false },
);

export type AddTeamDialogLazyProps = {
  planSlug: TeamPlanId;
  isAtLimit?: boolean;
  triggerLabel?: string;
  triggerTooltip?: string;
};

/** Client-only lazy boundary so Server Components can render “Add workspace” without `dynamic(..., { ssr: false })`. */
export function AddTeamDialogLazy(props: AddTeamDialogLazyProps) {
  return <AddTeamDialog {...props} />;
}
