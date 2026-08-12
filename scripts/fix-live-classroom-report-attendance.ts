/**
 * Corrects `live_battle_reports.stats.attendance` for historical rows written
 * before the fix that excludes participants who joined the lobby but were
 * never locked into a team (and so never actually battled). Also patches the
 * free-form AI summary's "<N> students participated" mention to match, since
 * that number was baked in verbatim at generation time and won't update on
 * its own. Recomputes from each report's session's actual
 * `liveClassroomParticipants` rows. Idempotent — safe to re-run.
 *   npx tsx scripts/fix-live-classroom-report-attendance.ts
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { liveBattleReports, liveClassroomParticipants } from "@/db/schema";
import type { LiveClassroomReportStats } from "@/lib/live-classroom-types";

const NUMBER_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty",
];

const MENTION_PATTERN = new RegExp(
  `\\b(${NUMBER_WORDS.join("|")})\\b(\\s+students?\\s+participated)`,
  "i",
);

/**
 * The AI summary is free-form prose (e.g. "five students participated") —
 * re-running the AI isn't worth the cost/risk just to fix a headcount, so
 * word-swap the "<number> student(s) participated" mention in place whenever
 * it doesn't match the real (corrected) attendance count.
 */
function fixAttendanceMention(summary: string, correctCount: number): string {
  const match = summary.match(MENTION_PATTERN);
  if (!match) return summary;
  const mentionedCount = NUMBER_WORDS.indexOf(match[1]!.toLowerCase());
  if (mentionedCount === correctCount) return summary;
  const newWord = NUMBER_WORDS[correctCount] ?? String(correctCount);
  return summary.replace(MENTION_PATTERN, `${newWord}$2`);
}

async function main() {
  const reports = await db.select().from(liveBattleReports);
  let fixed = 0;

  for (const report of reports) {
    const stats = report.stats as LiveClassroomReportStats;
    if (!stats || typeof stats.attendance !== "number") continue;

    const participants = await db
      .select()
      .from(liveClassroomParticipants)
      .where(eq(liveClassroomParticipants.sessionId, report.sessionId));

    const correctAttendance = participants.filter(
      (p) => p.liveTeamId != null,
    ).length;

    const correctedSummary = stats.aiTeacherSummary
      ? fixAttendanceMention(stats.aiTeacherSummary, correctAttendance)
      : stats.aiTeacherSummary;

    const attendanceChanged = correctAttendance !== stats.attendance;
    const summaryChanged = correctedSummary !== stats.aiTeacherSummary;
    if (!attendanceChanged && !summaryChanged) continue;

    const updatedStats: LiveClassroomReportStats = {
      ...stats,
      attendance: correctAttendance,
      aiTeacherSummary: correctedSummary,
    };
    await db
      .update(liveBattleReports)
      .set({ stats: updatedStats })
      .where(eq(liveBattleReports.id, report.id));
    console.log(
      `Session ${report.sessionId}: attendance ${stats.attendance} -> ${correctAttendance}` +
        (summaryChanged ? " (summary text corrected)" : ""),
    );
    fixed++;
  }

  console.log(`Done. Corrected ${fixed} of ${reports.length} report(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
