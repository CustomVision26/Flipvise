/**
 * Creates teacher_registered_students and teacher_manual_grades when missing.
 * Run: npm run db:ensure-teacher-student-tracking-tables
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

import { ensureTeacherStudentTrackingTables } from "../src/lib/ensure-teacher-student-tracking-tables";

async function main() {
  await ensureTeacherStudentTrackingTables();
  console.log("teacher_registered_students and teacher_manual_grades tables ready.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
