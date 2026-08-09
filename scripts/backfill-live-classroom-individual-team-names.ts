/**
 * Backfills `stats.individualStats[].teamName` for historical
 * `live_battle_reports` rows written before that field existed. Looks up
 * each participant's `liveTeamId` (including removed participants) and the
 * matching team name for the report's session. Idempotent — safe to re-run.
 *   npx tsx scripts/backfill-live-classroom-individual-team-names.ts
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  liveBattleReports,
  liveClassroomParticipants,
  liveClassroomTeams,
} from "@/db/schema";
import type { LiveClassroomReportStats } from "@/lib/live-classroom-types";

async function main() {
  const reports = await db.select().from(liveBattleReports);
  let fixed = 0;

  for (const report of reports) {
    const stats = report.stats as LiveClassroomReportStats;
    if (!stats?.individualStats?.length) continue;

    const needsBackfill = stats.individualStats.some(
      (p) => !("teamName" in p),
    );
    if (!needsBackfill) continue;

    const [participants, teams] = await Promise.all([
      db
        .select()
        .from(liveClassroomParticipants)
        .where(eq(liveClassroomParticipants.sessionId, report.sessionId)),
      db
        .select()
        .from(liveClassroomTeams)
        .where(eq(liveClassroomTeams.sessionId, report.sessionId)),
    ]);

    const teamNameById = new Map(teams.map((t) => [t.id, t.name]));
    const teamNameByUserId = new Map(
      participants.map((p) => [
        p.userId,
        p.liveTeamId != null ? teamNameById.get(p.liveTeamId) ?? null : null,
      ]),
    );

    const updatedStats: LiveClassroomReportStats = {
      ...stats,
      individualStats: stats.individualStats.map((p) => ({
        ...p,
        teamName: teamNameByUserId.get(p.userId) ?? null,
      })),
    };

    await db
      .update(liveBattleReports)
      .set({ stats: updatedStats })
      .where(eq(liveBattleReports.id, report.id));
    console.log(`Session ${report.sessionId}: backfilled team names.`);
    fixed++;
  }

  console.log(`Done. Backfilled ${fixed} of ${reports.length} report(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
