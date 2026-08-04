import { notFound } from "next/navigation";
import { loadLiveClassroomSessionPageContext } from "@/lib/load-live-classroom-page-context";
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

  return (
    <LiveClassroomShell teamId={ctx.teamId}>
      <LiveClassroomStudentPlay sessionId={sessionId} userId={ctx.userId} />
    </LiveClassroomShell>
  );
}
