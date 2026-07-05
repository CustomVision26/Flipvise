import { db } from "@/db";
import { teamMemberHistory } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import type { teamMemberHistoryActionEnum, teamMemberRoleEnum } from "@/db/schema";

type TeamMemberHistoryAction = (typeof teamMemberHistoryActionEnum.enumValues)[number];
type TeamMemberRole = (typeof teamMemberRoleEnum.enumValues)[number];

/** PostgreSQL undefined_table — when `team_member_history` is not migrated yet. */
function isMissingTeamMemberHistoryTableError(error: unknown): boolean {
  if (error === null || error === undefined) return false;
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "42P01") return true;
  }
  let current: unknown = error;
  const seen = new Set<unknown>();
  for (let depth = 0; depth < 8 && current != null && !seen.has(current); depth++) {
    seen.add(current);
    const msg =
      current instanceof Error
        ? current.message
        : typeof current === "object" &&
            current !== null &&
            "message" in current &&
            typeof (current as { message?: unknown }).message === "string"
          ? (current as { message: string }).message
          : String(current);
    const lower = msg.toLowerCase();
    if (
      lower.includes("team_member_history") &&
      (lower.includes("does not exist") || lower.includes("relation"))
    ) {
      return true;
    }
    const next =
      current instanceof Error
        ? current.cause
        : typeof current === "object" &&
            current !== null &&
            "cause" in current
          ? (current as { cause?: unknown }).cause
          : undefined;
    current = next;
  }
  return false;
}

let warnedMissingMemberHistoryTable = false;

function warnMissingMemberHistoryTableOnce() {
  if (process.env.NODE_ENV !== "development") return;
  if (warnedMissingMemberHistoryTable) return;
  warnedMissingMemberHistoryTable = true;
  console.warn(
    "[db] Table team_member_history is missing. Membership history is disabled until you run: npm run db:ensure-team-member-history (or db:push:local / db:migrate).",
  );
}

import type { TeamMemberHistoryRow } from "@/lib/team-member-history-types";

export type { TeamMemberHistoryRow };

function mapRow(r: typeof teamMemberHistory.$inferSelect): TeamMemberHistoryRow {
  return {
    id: r.id,
    teamId: r.teamId,
    ownerUserId: r.ownerUserId,
    action: r.action,
    memberUserId: r.memberUserId,
    memberRole: r.memberRole,
    actorUserId: r.actorUserId,
    createdAt: r.createdAt,
  };
}

export async function insertTeamMemberHistoryEvent(input: {
  teamId: number;
  ownerUserId: string;
  action: TeamMemberHistoryAction;
  memberUserId: string;
  memberRole: TeamMemberRole;
  actorUserId: string | null;
}) {
  try {
    await db.insert(teamMemberHistory).values({
      teamId: input.teamId,
      ownerUserId: input.ownerUserId,
      action: input.action,
      memberUserId: input.memberUserId,
      memberRole: input.memberRole,
      actorUserId: input.actorUserId,
    });
  } catch (e) {
    if (!isMissingTeamMemberHistoryTableError(e)) throw e;
    warnMissingMemberHistoryTableOnce();
  }
}

/** Membership add/remove audit for a single workspace, newest first. */
export async function listTeamMemberHistoryForTeam(
  ownerUserId: string,
  teamId: number,
): Promise<TeamMemberHistoryRow[]> {
  try {
    const rows = await db
      .select()
      .from(teamMemberHistory)
      .where(
        and(
          eq(teamMemberHistory.ownerUserId, ownerUserId),
          eq(teamMemberHistory.teamId, teamId),
        ),
      )
      .orderBy(desc(teamMemberHistory.createdAt));
    return rows.map(mapRow);
  } catch (e) {
    if (!isMissingTeamMemberHistoryTableError(e)) throw e;
    warnMissingMemberHistoryTableOnce();
    return [];
  }
}
