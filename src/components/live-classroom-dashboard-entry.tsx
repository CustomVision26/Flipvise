import Link from "next/link";
import { Presentation } from "lucide-react";
import { LIVE_CLASSROOM_BRIDGE_PATH } from "@/lib/live-classroom-url";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

/**
 * Dashboard entry for Live Classroom™.
 * Opens the workspace bridge (owner: all LC workspaces; token host: assigned only).
 */
export function LiveClassroomDashboardEntry() {
  return (
    <Link
      href={LIVE_CLASSROOM_BRIDGE_PATH}
      className={cn(
        buttonVariants({ size: "sm" }),
        "h-9 gap-2 bg-indigo-600 text-white shadow-md shadow-indigo-900/40 hover:bg-indigo-600/90",
      )}
      title="Flipvise Live Classroom™ — choose a workspace to host battles"
    >
      <Presentation className="size-4 shrink-0" aria-hidden />
      <span>Live Classroom™</span>
    </Link>
  );
}
