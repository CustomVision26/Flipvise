/**
 * Links deck-sourced homework to matching saved lesson plans (same user, subject, topic, grade).
 * Run: npx tsx scripts/backfill-homework-lesson-plan-links.ts
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const updated = await sql`
    UPDATE saved_homework_assignments AS hw
    SET
      "savedLessonPlanId" = lp.id,
      "sourceLessonPlanTitle" = lp."lessonTitle",
      "updatedAt" = NOW()
    FROM saved_lesson_plans AS lp
    WHERE hw."savedLessonPlanId" IS NULL
      AND hw."userId" = lp."userId"
      AND lower(trim(hw.subject)) = lower(trim(lp.subject))
      AND lower(trim(hw.topic)) = lower(trim(lp.topic))
      AND lower(trim(hw."gradeLevel")) = lower(trim(lp."gradeLevel"))
    RETURNING hw.id, hw.label, lp.id AS "lessonPlanId", lp."lessonTitle"
  `;

  console.log(`Linked ${updated.length} homework assignment(s).`);
  if (updated.length > 0) {
    console.log(JSON.stringify(updated, null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
