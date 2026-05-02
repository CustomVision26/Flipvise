ALTER TABLE "admin_plan_assignment_logs"
ADD COLUMN IF NOT EXISTS "planApplicationPath" varchar(32);
