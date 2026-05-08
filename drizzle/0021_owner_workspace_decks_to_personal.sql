-- Restructure: subscriber-owned decks are no longer scoped with teamId on the decks row.
-- Workspace association for sharing is enforced via team_deck_assignments (and optional teamId
-- staging when admins link a deck). Clearing teamId surfaces every subscriber deck on the
-- Personal Dashboard while preserving member assignments.

UPDATE decks d
SET
  "teamId" = NULL,
  "updatedAt" = NOW()
FROM teams t
WHERE d."teamId" = t.id AND d."userId" = t."ownerUserId";
