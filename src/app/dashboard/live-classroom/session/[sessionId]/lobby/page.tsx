import { notFound } from "next/navigation";
import { loadLiveClassroomSessionPageContext } from "@/lib/load-live-classroom-page-context";
import { LiveClassroomLobby } from "@/components/live-classroom-lobby";
import { LiveClassroomShell } from "@/components/live-classroom-shell";
import { LiveClassroomUnlock } from "@/components/live-classroom-unlock";

export default async function LiveClassroomLobbyPage({
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

  return (
    <LiveClassroomShell teamId={ctx.teamId}>
      <LiveClassroomLobby
        sessionId={sessionId}
        userId={ctx.userId}
        canHost={ctx.canHost}
        licensedSeats={ctx.licensedSeats}
      />
    </LiveClassroomShell>
  );
}
