import { getDecksForTeam } from "@/db/queries/teams";
import { loadLiveClassroomPageContext } from "@/lib/load-live-classroom-page-context";
import { LIVE_CLASSROOM_START_PATH } from "@/lib/live-classroom-url";
import { LiveClassroomShell } from "@/components/live-classroom-shell";
import { LiveClassroomAssignmentRequired } from "@/components/live-classroom-assignment-required";
import { LiveClassroomBackLink } from "@/components/live-classroom-back-link";
import { LiveClassroomUnlock } from "@/components/live-classroom-unlock";
import { LiveClassroomStartForm } from "@/components/live-classroom-start-form";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function LiveClassroomStartPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const ctx = await loadLiveClassroomPageContext(searchParams, {
    path: LIVE_CLASSROOM_START_PATH,
  });

  if (!ctx.owns) {
    return <LiveClassroomUnlock teamName={ctx.team.name} />;
  }

  if (!ctx.hasAccess) {
    return <LiveClassroomAssignmentRequired teamName={ctx.team.name} />;
  }

  if (!ctx.canHost) {
    return (
      <LiveClassroomShell teamId={ctx.teamId} canManage={ctx.canManage}>
        <div>
          <LiveClassroomBackLink teamId={ctx.teamId} />
          <Card className="border-border/80 bg-card/60 shadow-sm">
            <CardHeader>
              <CardTitle>Host permission required</CardTitle>
              <CardDescription>
                Ask a team administrator to grant you Live Classroom™ teacher
                access before starting a session.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </LiveClassroomShell>
    );
  }

  const decks = await getDecksForTeam(ctx.teamId, ctx.team.ownerUserId);
  const deckOptions = decks
    .map((d) => ({ id: d.id, name: d.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <LiveClassroomShell teamId={ctx.teamId} canManage={ctx.canManage}>
      <div>
        <LiveClassroomBackLink teamId={ctx.teamId} />
        <LiveClassroomStartForm
          teamId={ctx.teamId}
          decks={deckOptions}
          defaults={
            ctx.settings
              ? {
                  defaultBattleType: ctx.settings.defaultBattleType,
                  allowMusic: ctx.settings.allowMusic,
                  allowStrategyCards: ctx.settings.allowStrategyCards,
                  allowAiExplanations: ctx.settings.allowAiExplanations,
                  defaultTeamAssignment: ctx.settings.defaultTeamAssignment,
                  strategyCardPolicy: ctx.settings.strategyCardPolicy,
                }
              : undefined
          }
        />
      </div>
    </LiveClassroomShell>
  );
}
