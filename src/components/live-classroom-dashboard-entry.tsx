import Link from "next/link";
import { Presentation } from "lucide-react";
import { LIVE_CLASSROOM_ROOT_PATH } from "@/lib/live-classroom-url";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

/**
 * Personal-dashboard entry for Live Classroom™.
 * Only render when the user holds an active live_classroom entitlement.
 */
export function LiveClassroomDashboardEntry() {
  return (
    <Link
      href={LIVE_CLASSROOM_ROOT_PATH}
      className={cn(
        buttonVariants({ size: "sm" }),
        "h-9 gap-2 bg-indigo-600 text-white shadow-md shadow-indigo-900/40 hover:bg-indigo-600/90",
      )}
      title="Flipvise Live Classroom™ — open live sessions for your organization"
    >
      <Presentation className="size-4 shrink-0" aria-hidden />
      <span>Live Classroom™</span>
    </Link>
  );
}
