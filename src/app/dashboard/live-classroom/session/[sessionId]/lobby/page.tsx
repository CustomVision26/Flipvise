import { notFound, redirect } from "next/navigation";
import {
  getLiveClassroomParticipant,
  listLiveClassroomParticipantGrants,
  listLiveClassroomSavedGroups,
  updateLiveClassroomSession,
} from "@/db/queries/live-classroom";
import { listTeamMembers } from "@/db/queries/teams";
import { getClerkUserFieldDisplaysByIds } from "@/lib/clerk-user-display";
import { loadLiveClassroomSessionPageContext } from "@/lib/load-live-classroom-page-context";
import {
  liveClassroomHostPath,
  liveClassroomPlayPath,
  liveClassroomReportPath,
  liveClassroomSessionGonePath,
} from "@/lib/live-classroom-url";
import { buildTeamWorkspaceQueryString } from "@/lib/team-workspace-url";
import { LiveClassroomAssignmentRequired } from "@/components/live-classroom-assignment-required";
import { LiveClassroomBackLink } from "@/components/live-classroom-back-link";
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
  if (!Number.isFinite(sessionId) || sessionId <= 0) {
    console.error(`[live-classroom] lobby: invalid sessionId param`, raw);
    notFound();
  }

  const ctx = await loadLiveClassroomSessionPageContext(sessionId);
  if (!ctx.owns) {
    return <LiveClassroomUnlock teamName={ctx.team.name} />;
  }
  if (!ctx.hasAccess) {
    return <LiveClassroomAssignmentRequired teamName={ctx.team.name} />;
  }

  // Opening the lobby URL opens a scheduled session (so join/poll stay joinable).
  if (ctx.session.status === "scheduled") {
    await updateLiveClassroomSession(sessionId, { status: "lobby" });
    ctx.session = { ...ctx.session, status: "lobby" };
  }

  // Battle already running / ended — never render the lobby countdown overlay.
  const status = ctx.session.status;
  if (status === "cancelled") {
    redirect(
      liveClassroomSessionGonePath({
        canManage: ctx.canManage,
        teamId: ctx.teamId,
      }),
    );
  }
  if (status === "completed") {
    redirect(liveClassroomReportPath(sessionId));
  }
  if (status === "active" || status === "paused") {
    const participant = await getLiveClassroomParticipant(
      sessionId,
      ctx.userId,
    );
    const hasTeam = participant?.liveTeamId != null;
    const isSessionHost = ctx.session.hostUserId === ctx.userId;
    if (hasTeam || !isSessionHost) {
      redirect(liveClassroomPlayPath(sessionId));
    }
    redirect(
      ctx.canHost
        ? liveClassroomHostPath(sessionId)
        : liveClassroomPlayPath(sessionId),
    );
  }

  const [members, participantGrants, savedGroupRows] = await Promise.all([
    listTeamMembers(ctx.teamId),
    listLiveClassroomParticipantGrants(ctx.teamId),
    ctx.canManage
      ? listLiveClassroomSavedGroups(ctx.teamId)
      : Promise.resolve([]),
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
    <LiveClassroomShell teamId={ctx.teamId} canManage={ctx.canManage}>
      <div>
        <LiveClassroomBackLink
          teamId={ctx.teamId}
          label={ctx.canManage ? "Back to Sessions Pool" : "Back to Team Dashboard"}
          href={
            ctx.canManage
              ? undefined
              : `/dashboard?${buildTeamWorkspaceQueryString({ teamId: ctx.teamId })}`
          }
        />
        <LiveClassroomLobby
          sessionId={sessionId}
          userId={ctx.userId}
          ownerUserId={ctx.team.ownerUserId}
          teamId={ctx.teamId}
          canHost={ctx.canHost}
          canManage={ctx.canManage}
          licensedSeats={ctx.licensedSeats}
          workspaceMembers={workspaceMembers}
          assignedUserIds={participantGrants.map((g) => g.userId)}
          savedGroups={savedGroupRows.map((g) => ({
            id: g.id,
            name: g.name,
            groups: g.groups,
            updatedAt: g.updatedAt.toISOString(),
          }))}
        />
      </div>
    </LiveClassroomShell>
  );
}
