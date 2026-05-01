import type { QuizResultSummary } from "@/components/quiz-result-detail-view";
import { getQuizResultByIdForViewer } from "@/db/queries/quiz-results";
import { getTeamsByIds, listTeamMembersByTeamIds } from "@/db/queries/teams";
import { getClerkUserFieldDisplaysByIds } from "@/lib/clerk-user-display";

/**
 * Full quiz result payload for the signed-in viewer (quiz-taker or team owner).
 */
export async function getQuizResultSummaryForViewer(
  resultId: number,
  viewerUserId: string,
): Promise<QuizResultSummary | null> {
  const row = await getQuizResultByIdForViewer(resultId, viewerUserId);
  if (!row) return null;

  const teamIds = row.teamId !== null ? [row.teamId] : [];
  const [teamsRows, memberRows] = await Promise.all([
    teamIds.length ? getTeamsByIds(teamIds) : Promise.resolve([]),
    teamIds.length ? listTeamMembersByTeamIds(teamIds) : Promise.resolve([]),
  ]);
  const team = row.teamId !== null ? teamsRows[0] ?? null : null;

  const memberRoleMap = new Map(
    memberRows.map((m) => [`${m.teamId}-${m.userId}`, m.role as string]),
  );

  const takerId = row.userId;
  const allUserIds = [...new Set([takerId, ...(team ? [team.ownerUserId] : [])])];
  const userDisplayById = await getClerkUserFieldDisplaysByIds(allUserIds);

  const takerDisplay = userDisplayById[takerId];
  const userName = takerDisplay?.primaryLine ?? null;
  const userEmail = takerDisplay?.primaryEmail ?? null;

  const teamName = team?.name ?? null;
  let memberRole: QuizResultSummary["memberRole"] = null;
  if (team) {
    if (row.userId === team.ownerUserId) {
      memberRole = "owner";
    } else {
      const role = memberRoleMap.get(`${team.id}-${row.userId}`);
      memberRole =
        role === "team_admin"
          ? "team_admin"
          : role === "team_member"
            ? "team_member"
            : null;
    }
  }

  const ownerDisplay = team ? userDisplayById[team.ownerUserId] : null;

  return {
    id: row.id,
    deckName: row.deckName,
    correct: row.correct,
    incorrect: row.incorrect,
    unanswered: row.unanswered,
    total: row.total,
    percent: row.percent,
    elapsedSeconds: row.elapsedSeconds,
    savedAt: row.savedAt,
    perCard: row.perCard ?? null,
    userName,
    userEmail,
    teamName,
    memberRole,
    ownerName: ownerDisplay?.primaryLine ?? null,
    ownerEmail: ownerDisplay?.primaryEmail ?? null,
  };
}
