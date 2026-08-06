import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildLiveClassroomHref,
  LIVE_CLASSROOM_ROOT_PATH,
} from "@/lib/live-classroom-url";

/** Back control to the Live Classroom™ dashboard (main hub). */
export function LiveClassroomBackLink({ teamId }: { teamId: number }) {
  return (
    <Button
      nativeButton={false}
      variant="ghost"
      size="sm"
      className="mb-3 -ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
      render={
        <Link
          href={buildLiveClassroomHref(LIVE_CLASSROOM_ROOT_PATH, teamId)}
        />
      }
    >
      <ArrowLeft className="size-3.5" aria-hidden />
      Back
    </Button>
  );
}
