import { notFound } from "next/navigation";
import { listLiveClassroomParticipantGrants } from "@/db/queries/live-classroom";
import { listTeamMembers } from "@/db/queries/teams";
import { getClerkUserFieldDisplaysByIds } from "@/lib/clerk-user-display";
import { loadLiveClassroomSessionPageContext } from "@/lib/load-live-classroom-page-context";
import { LiveClassroomAssignmentRequired } from "@/components/live-classroom-assignment-required";
import { LiveClassroomLobby } from "@/components/live-classroom-lobby";
import { LiveClassroomShell } from "@/components/live-classroom-shell";
import { LiveClassroomUnlock } from "@/components/live-classroom-unlock";
import type { LiveClassroomWorkspaceMemberOption } from "@/components/live-classroom-session-settings-dialog";

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
  if (!ctx.hasAccess) {
    return <LiveClassroomAssignmentRequired teamName={ctx.team.name} />;
  }

  const [members, participantGrants] = await Promise.all([
    listTeamMembers(ctx.teamId),
    listLiveClassroomParticipantGrants(ctx.teamId),
  ]);

  const memberUserIds = [
    ctx.team.ownerUserId,
    ...members.map((m) => m.userId),
  ];
  const displays = await getClerkUserFieldDisplaysByIds(memberUserIds);

  const workspaceMembers: LiveClassroomWorkspaceMemberOption[] = [
    {
      key: `owner:${ctx.team.ownerUserId}`,
      userId: ctx.team.ownerUserId,
      displayName:
        displays[ctx.team.ownerUserId]?.primaryLine ?? "Subscription owner",
      roleLabel: "Owner",
    },
    ...members
      .filter((m) => m.userId !== ctx.team.ownerUserId)
      .map((m) => ({
        key: `member:${m.userId}`,
        userId: m.userId,
        displayName: displays[m.userId]?.primaryLine ?? m.userId.slice(0, 12),
        roleLabel:
          m.role === "team_admin" ? ("Team admin" as const) : ("Member" as const),
      })),
  ];

  return (
    <LiveClassroomShell teamId={ctx.teamId}>
      <LiveClassroomLobby
        sessionId={sessionId}
        userId={ctx.userId}
        ownerUserId={ctx.team.ownerUserId}
        canHost={ctx.canHost}
        licensedSeats={ctx.licensedSeats}
        workspaceMembers={workspaceMembers}
        assignedUserIds={participantGrants.map((g) => g.userId)}
      />
    </LiveClassroomShell>
  );
}
