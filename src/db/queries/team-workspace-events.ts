import { db } from "@/db";
import { teamWorkspaceEvents, teams } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import type { teamWorkspaceEventActionEnum } from "@/db/schema";

type TeamWorkspaceEventAction = (typeof teamWorkspaceEventActionEnum.enumValues)[number];

/** PostgreSQL undefined_table — when `team_workspace_events` is not migrated yet. */
function isMissingTeamWorkspaceEventsTableError(error: unknown): boolean {
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
      lower.includes("team_workspace_events") &&
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

let warnedMissingWorkspaceEventsTable = false;

function warnMissingWorkspaceEventsTableOnce() {
  if (process.env.NODE_ENV !== "development") return;
  if (warnedMissingWorkspaceEventsTable) return;
  warnedMissingWorkspaceEventsTable = true;
  console.warn(
    "[db] Table team_workspace_events is missing. History/audit is disabled until you run: npm run db:ensure-team-workspace-events (or db:push:local / db:migrate).",
  );
}

export type TeamWorkspaceEventRow = {
  id: number;
  ownerUserId: string;
  action: TeamWorkspaceEventAction;
  teamId: number | null;
  teamName: string;
  planSlug: string;
  previousTeamName: string | null;
  createdAt: Date;
};

export async function insertTeamWorkspaceEvent(input: {
  ownerUserId: string;
  action: TeamWorkspaceEventAction;
  teamId: number | null;
  teamName: string;
  planSlug: string;
  previousTeamName: string | null;
}) {
  try {
    await db.insert(teamWorkspaceEvents).values({
      ownerUserId: input.ownerUserId,
      action: input.action,
      teamId: input.teamId,
      teamName: input.teamName,
      planSlug: input.planSlug,
      previousTeamName: input.previousTeamName,
    });
  } catch (e) {
    if (!isMissingTeamWorkspaceEventsTableError(e)) throw e;
    warnMissingWorkspaceEventsTableOnce();
  }
}

export async function listTeamWorkspaceEventsForOwner(
  ownerUserId: string,
): Promise<TeamWorkspaceEventRow[]> {
  try {
    const rows = await db
      .select()
      .from(teamWorkspaceEvents)
      .where(eq(teamWorkspaceEvents.ownerUserId, ownerUserId))
      .orderBy(desc(teamWorkspaceEvents.createdAt));
    return rows.map((r) => ({
      id: r.id,
      ownerUserId: r.ownerUserId,
      action: r.action,
      teamId: r.teamId,
      teamName: r.teamName,
      planSlug: r.planSlug,
      previousTeamName: r.previousTeamName,
      createdAt: r.createdAt,
    }));
  } catch (e) {
    if (!isMissingTeamWorkspaceEventsTableError(e)) throw e;
    warnMissingWorkspaceEventsTableOnce();
    return [];
  }
}

/** Audit rows for a single workspace (create / rename / delete), newest first. */
export async function listTeamWorkspaceEventsForTeam(
  ownerUserId: string,
  teamId: number,
): Promise<TeamWorkspaceEventRow[]> {
  try {
    const rows = await db
      .select()
      .from(teamWorkspaceEvents)
      .where(
        and(
          eq(teamWorkspaceEvents.ownerUserId, ownerUserId),
          eq(teamWorkspaceEvents.teamId, teamId),
        ),
      )
      .orderBy(desc(teamWorkspaceEvents.createdAt));
    return rows.map((r) => ({
      id: r.id,
      ownerUserId: r.ownerUserId,
      action: r.action,
      teamId: r.teamId,
      teamName: r.teamName,
      planSlug: r.planSlug,
      previousTeamName: r.previousTeamName,
      createdAt: r.createdAt,
    }));
  } catch (e) {
    if (!isMissingTeamWorkspaceEventsTableError(e)) throw e;
    warnMissingWorkspaceEventsTableOnce();
    return [];
  }
}

export async function updateOwnedTeamName(
  ownerUserId: string,
  teamId: number,
  name: string,
) {
  const updated = await db
    .update(teams)
    .set({ name })
    .where(and(eq(teams.id, teamId), eq(teams.ownerUserId, ownerUserId)))
    .returning({ id: teams.id });
  return updated[0] ?? null;
}

export async function deleteTeamByOwner(ownerUserId: string, teamId: number) {
  const [team] = await db
    .select()
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.ownerUserId, ownerUserId)));
  if (!team) return null;

  /** Audit insert uses its own connection path; avoids aborting a PG txn when the audit table is missing. */
  await insertTeamWorkspaceEvent({
    ownerUserId,
    action: "deleted",
    teamId,
    teamName: team.name,
    planSlug: team.planSlug,
    previousTeamName: null,
  });

  await db.delete(teams).where(and(eq(teams.id, teamId), eq(teams.ownerUserId, ownerUserId)));

  return { snapshot: team };
}
