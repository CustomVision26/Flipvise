import { loadLiveClassroomPageContext } from "@/lib/load-live-classroom-page-context";
import { LIVE_CLASSROOM_JOIN_PATH } from "@/lib/live-classroom-url";
import { LiveClassroomShell } from "@/components/live-classroom-shell";
import { LiveClassroomAssignmentRequired } from "@/components/live-classroom-assignment-required";
import { LiveClassroomBackLink } from "@/components/live-classroom-back-link";
import { LiveClassroomUnlock } from "@/components/live-classroom-unlock";
import { LiveClassroomJoinCodeForm } from "@/components/live-classroom-join-code-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function LiveClassroomJoinPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const ctx = await loadLiveClassroomPageContext(searchParams, {
    path: LIVE_CLASSROOM_JOIN_PATH,
  });

  if (!ctx.owns) {
    return <LiveClassroomUnlock teamName={ctx.team.name} />;
  }

  if (!ctx.hasAccess) {
    return <LiveClassroomAssignmentRequired teamName={ctx.team.name} />;
  }

  return (
    <LiveClassroomShell teamId={ctx.teamId} canManage={ctx.canManage}>
      <div>
        <LiveClassroomBackLink teamId={ctx.teamId} />
        <Card className="border-border/80 bg-card/60 shadow-sm">
          <CardHeader>
            <CardTitle>Join with code</CardTitle>
            <CardDescription>
              Enter the join code from the host’s lobby. You must already be
              assigned to the Live Classroom™ team. Join with the code only —
              there is no lobby link to share.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LiveClassroomJoinCodeForm />
          </CardContent>
        </Card>
      </div>
    </LiveClassroomShell>
  );
}
