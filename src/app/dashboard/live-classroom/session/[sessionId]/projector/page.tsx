import { notFound, redirect } from "next/navigation";
import { loadLiveClassroomSessionPageContext } from "@/lib/load-live-classroom-page-context";
import { liveClassroomLobbyPath } from "@/lib/live-classroom-url";
import { LiveClassroomProjector } from "@/components/live-classroom-projector";
import { LiveClassroomUnlock } from "@/components/live-classroom-unlock";

export default async function LiveClassroomProjectorPage({
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
  if (!ctx.canHost) {
    redirect(liveClassroomLobbyPath(sessionId));
  }

  // Full-bleed projector — no sidebar chrome
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LiveClassroomProjector sessionId={sessionId} />
    </div>
  );
}
