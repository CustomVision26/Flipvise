import { notFound, redirect } from "next/navigation";
import { loadLiveClassroomSessionPageContext } from "@/lib/load-live-classroom-page-context";
import {
  liveClassroomLobbyPath,
  liveClassroomReportPath,
  liveClassroomSessionGonePath,
} from "@/lib/live-classroom-url";
import { LiveClassroomAssignmentRequired } from "@/components/live-classroom-assignment-required";
import { LiveClassroomShell } from "@/components/live-classroom-shell";
import { LiveClassroomStudentPlay } from "@/components/live-classroom-student-play";
import { LiveClassroomUnlock } from "@/components/live-classroom-unlock";

export default async function LiveClassroomPlayPage({
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

  const status = ctx.session.status;
  if (status === "completed") {
    redirect(liveClassroomReportPath(sessionId));
  }
  if (status === "cancelled") {
    redirect(
      liveClassroomSessionGonePath({
        canManage: ctx.canManage,
        teamId: ctx.teamId,
      }),
    );
  }
  if (status === "lobby" || status === "scheduled") {
    redirect(liveClassroomLobbyPath(sessionId));
  }

  return (
    <LiveClassroomShell teamId={ctx.teamId} canManage={ctx.canManage}>
      <LiveClassroomStudentPlay
        sessionId={sessionId}
        userId={ctx.userId}
        teamId={ctx.teamId}
        canManage={ctx.canManage}
      />
    </LiveClassroomShell>
  );
}
