ALTER TYPE "public"."team_invitation_status" ADD VALUE 'rejected';--> statement-breakpoint
ALTER TABLE "team_invitations" ADD COLUMN "invitedByUserId" varchar(255);
--> statement-breakpoint
UPDATE "team_invitations" AS ti
SET "invitedByUserId" = t."ownerUserId"
FROM "teams" AS t
WHERE ti."teamId" = t.id AND ti."invitedByUserId" IS NULL;