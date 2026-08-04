import { notFound, redirect } from "next/navigation";
import { loadLiveClassroomSessionPageContext } from "@/lib/load-live-classroom-page-context";
import { liveClassroomLobbyPath } from "@/lib/live-classroom-url";
import { LiveClassroomAssignmentRequired } from "@/components/live-classroom-assignment-required";
import { LiveClassroomHostDashboard } from "@/components/live-classroom-host-dashboard";
import { LiveClassroomShell } from "@/components/live-classroom-shell";
import { LiveClassroomUnlock } from "@/components/live-classroom-unlock";

export default async function LiveClassroomHostPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId: raw } = await params;
  const sessionId = Number(raw);
  if (!Number.isFinite(sessionId) || sessionId <= 0) notFound();

  const ctx = await loadLiveClassroomSessionPageContext(sessionId);
  if (!ctx.owns) {
    return <LiveClassroomUnlock teamName={ctx.team.name} />;
  }
  if (!ctx.hasAccess) {
    return <LiveClassroomAssignmentRequired teamName={ctx.team.name} />;
  }
  if (!ctx.canHost) {
    redirect(liveClassroomLobbyPath(sessionId));
  }

  return (
    <LiveClassroomShell teamId={ctx.teamId}>
      <LiveClassroomHostDashboard sessionId={sessionId} />
    </LiveClassroomShell>
  );
}
