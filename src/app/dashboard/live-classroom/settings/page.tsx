import {
  listLiveClassroomParticipantGrants,
  listLiveClassroomTeacherGrants,
} from "@/db/queries/live-classroom";
import { listTeamMembers } from "@/db/queries/teams";
import { getClerkUserFieldDisplaysByIds } from "@/lib/clerk-user-display";
import { liveClassroomAllowsConcurrentOverride } from "@/lib/live-classroom-eligibility";
import { loadLiveClassroomPageContext } from "@/lib/load-live-classroom-page-context";
import { LIVE_CLASSROOM_SETTINGS_PATH } from "@/lib/live-classroom-url";
import { LiveClassroomShell } from "@/components/live-classroom-shell";
import { LiveClassroomAssignmentRequired } from "@/components/live-classroom-assignment-required";
import { LiveClassroomUnlock } from "@/components/live-classroom-unlock";
import { LiveClassroomSettingsForm } from "@/components/live-classroom-settings-form";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function LiveClassroomSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const ctx = await loadLiveClassroomPageContext(searchParams, {
    path: LIVE_CLASSROOM_SETTINGS_PATH,
  });

  if (!ctx.owns) {
    return <LiveClassroomUnlock teamName={ctx.team.name} />;
  }

  if (!ctx.hasAccess) {
    return <LiveClassroomAssignmentRequired teamName={ctx.team.name} />;
  }

  if (!ctx.canManage || !ctx.settings) {
    return (
      <LiveClassroomShell teamId={ctx.teamId} canManage={ctx.canManage}>
        <Card className="border-border/80 bg-card/60 shadow-sm">
          <CardHeader>
            <CardTitle>Admin access required</CardTitle>
            <CardDescription>
              Only the subscription owner or assigned team administrators can
              change Live Classroom™ settings.
            </CardDescription>
          </CardHeader>
        </Card>
      </LiveClassroomShell>
    );
  }

  const [members, teacherGrants, participantGrants] = await Promise.all([
    listTeamMembers(ctx.teamId),
    listLiveClassroomTeacherGrants(ctx.teamId),
    listLiveClassroomParticipantGrants(ctx.teamId),
  ]);

  const teacherSet = new Set(teacherGrants.map((g) => g.userId));
  const assignedSet = new Set(participantGrants.map((g) => g.userId));
  const eligibleMembers = members.filter(
    (m) =>
      (m.role === "team_member" || m.role === "team_admin") &&
      m.userId !== ctx.team.ownerUserId,
  );
  const displays = await getClerkUserFieldDisplaysByIds(
    eligibleMembers.map((m) => m.userId),
  );

  return (
    <LiveClassroomShell teamId={ctx.teamId} canManage={ctx.canManage}>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Organization defaults and Live Classroom™ team assignments
          </p>
        </div>
        <LiveClassroomSettingsForm
          teamId={ctx.teamId}
          licensedSeats={ctx.licensedSeats}
          canRaiseConcurrent={liveClassroomAllowsConcurrentOverride(
            ctx.team.planSlug,
          )}
          initial={{
            enabled: ctx.settings.enabled,
            defaultBattleType: ctx.settings.defaultBattleType,
            allowMusic: ctx.settings.allowMusic,
            allowStrategyCards: ctx.settings.allowStrategyCards,
            allowAiExplanations: ctx.settings.allowAiExplanations,
            defaultTeamAssignment: ctx.settings.defaultTeamAssignment,
            maxConcurrentSessions: ctx.settings.maxConcurrentSessions,
            strategyCardPolicy: ctx.settings.strategyCardPolicy,
            strategyCardLimitPerTeam: ctx.settings.strategyCardLimitPerTeam,
          }}
          members={eligibleMembers.map((m) => ({
            userId: m.userId,
            displayName:
              displays[m.userId]?.primaryLine ?? m.userId.slice(0, 12),
            workspaceRole:
              m.role === "team_admin" ? "team_admin" : "team_member",
            isAssigned: assignedSet.has(m.userId),
            hasTeacherGrant: teacherSet.has(m.userId),
          }))}
        />
      </div>
    </LiveClassroomShell>
  );
}
