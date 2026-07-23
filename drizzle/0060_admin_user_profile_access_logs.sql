CREATE TABLE IF NOT EXISTS "admin_user_profile_access_logs" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_user_profile_access_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
  "targetUserId" varchar(255) NOT NULL,
  "accessedByUserId" varchar(255) NOT NULL,
  "accessedByName" varchar(255) NOT NULL,
  "accessedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_user_profile_access_target_idx" ON "admin_user_profile_access_logs" USING btree ("targetUserId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_user_profile_access_accessed_at_idx" ON "admin_user_profile_access_logs" USING btree ("accessedAt");
