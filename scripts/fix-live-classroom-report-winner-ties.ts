/**
 * Corrects `live_battle_reports.winnerTeamName` for historical rows written
 * before the tie-aware winner fix — a 0-0 (or any tied) finish should not
 * show a "Winner" badge. Recomputes from each report's stored `stats.teamStats`.
 * Idempotent — safe to re-run.
 *   npx tsx scripts/fix-live-classroom-report-winner-ties.ts
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { liveBattleReports } from "@/db/schema";
import type { LiveClassroomReportStats } from "@/lib/live-classroom-types";

async function main() {
  const reports = await db.select().from(liveBattleReports);
  let fixed = 0;

  for (const report of reports) {
    const stats = report.stats as LiveClassroomReportStats;
    const teamStats = stats?.teamStats ?? [];
    if (teamStats.length === 0) continue;

    const topScore = teamStats.reduce((max, t) => Math.max(max, t.score), 0);
    const topTeams = teamStats.filter((t) => t.score === topScore);
    const correctWinner =
      topScore > 0 && topTeams.length === 1 ? topTeams[0]!.teamName : null;

    if (correctWinner !== report.winnerTeamName) {
      await db
        .update(liveBattleReports)
        .set({ winnerTeamName: correctWinner })
        .where(eq(liveBattleReports.id, report.id));
      console.log(
        `Session ${report.sessionId}: "${report.winnerTeamName ?? "—"}" -> "${correctWinner ?? "—"}"`,
      );
      fixed++;
    }
  }

  console.log(`Done. Corrected ${fixed} of ${reports.length} report(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
