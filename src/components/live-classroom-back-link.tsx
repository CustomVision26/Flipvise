import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildLiveClassroomHref,
  LIVE_CLASSROOM_ROOT_PATH,
} from "@/lib/live-classroom-url";

type LiveClassroomBackLinkProps = {
  teamId: number;
  /** Defaults to the Live Classroom™ dashboard hub. */
  href?: string;
  label?: string;
};

/** Back control for Live Classroom™ sub-pages. */
export function LiveClassroomBackLink({
  teamId,
  href,
  label = "Back",
}: LiveClassroomBackLinkProps) {
  const destination =
    href ?? buildLiveClassroomHref(LIVE_CLASSROOM_ROOT_PATH, teamId);

  return (
    <Button
      nativeButton={false}
      variant="ghost"
      size="sm"
      className="mb-3 -ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
      render={<Link href={destination} />}
    >
      <ArrowLeft className="size-3.5" aria-hidden />
      {label}
    </Button>
  );
}
