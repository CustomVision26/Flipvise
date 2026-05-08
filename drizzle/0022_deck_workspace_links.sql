CREATE TABLE "deck_workspace_links" (
	"teamId" integer NOT NULL,
	"deckId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deck_workspace_links" ADD CONSTRAINT "deck_workspace_links_teamId_teams_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deck_workspace_links" ADD CONSTRAINT "deck_workspace_links_deckId_decks_id_fk" FOREIGN KEY ("deckId") REFERENCES "public"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deck_workspace_links_team_deck_uidx" ON "deck_workspace_links" USING btree ("teamId","deckId");--> statement-breakpoint
INSERT INTO "deck_workspace_links" ("teamId", "deckId", "createdAt")
	SELECT d."teamId", d."id", NOW()
	FROM "decks" d
	INNER JOIN "teams" t ON t."id" = d."teamId"
	WHERE d."teamId" IS NOT NULL AND d."userId" = t."ownerUserId";
--> statement-breakpoint
UPDATE "decks" d
SET "teamId" = NULL, "updatedAt" = NOW()
FROM "teams" t
WHERE d."teamId" = t."id" AND d."userId" = t."ownerUserId";
