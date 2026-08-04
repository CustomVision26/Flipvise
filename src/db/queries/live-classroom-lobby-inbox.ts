import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { inboxReads, liveClassroomLobbyInboxMessages } from "@/db/schema";

function isMissingLobbyInboxTableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("live_classroom_lobby_inbox_messages") &&
    (msg.includes("does not exist") || msg.includes("relation"))
  );
}

export async function upsertLiveClassroomLobbyInboxMessage(input: {
  recipientUserId: string;
  teamId: number;
  sessionId: number;
  title: string;
  description: string;
  joinCode: string;
}): Promise<{ id: number; created: boolean }> {
  try {
    const [inserted] = await db
      .insert(liveClassroomLobbyInboxMessages)
      .values({
        recipientUserId: input.recipientUserId,
        teamId: input.teamId,
        sessionId: input.sessionId,
        title: input.title,
        description: input.description,
        joinCode: input.joinCode,
      })
      .onConflictDoNothing({
        target: [
          liveClassroomLobbyInboxMessages.recipientUserId,
          liveClassroomLobbyInboxMessages.sessionId,
        ],
      })
      .returning({ id: liveClassroomLobbyInboxMessages.id });

    if (inserted) return { id: inserted.id, created: true };

    const [updated] = await db
      .update(liveClassroomLobbyInboxMessages)
      .set({
        title: input.title,
        description: input.description,
        joinCode: input.joinCode,
        teamId: input.teamId,
      })
      .where(
        and(
          eq(
            liveClassroomLobbyInboxMessages.recipientUserId,
            input.recipientUserId,
          ),
          eq(liveClassroomLobbyInboxMessages.sessionId, input.sessionId),
        ),
      )
      .returning({ id: liveClassroomLobbyInboxMessages.id });

    if (!updated) {
      throw new Error("Failed to deliver Live Classroom lobby invite");
    }
    return { id: updated.id, created: false };
  } catch (error) {
    if (isMissingLobbyInboxTableError(error)) {
      throw new Error(
        "Live Classroom lobby inbox is not ready. Run npm run db:ensure-live-classroom-lobby-inbox.",
      );
    }
    throw error;
  }
}

export async function listLiveClassroomLobbyInboxMessagesForUser(
  userId: string,
  limit = 40,
) {
  try {
    return await db
      .select()
      .from(liveClassroomLobbyInboxMessages)
      .where(eq(liveClassroomLobbyInboxMessages.recipientUserId, userId))
      .orderBy(desc(liveClassroomLobbyInboxMessages.createdAt))
      .limit(limit);
  } catch (error) {
    if (isMissingLobbyInboxTableError(error)) return [];
    throw error;
  }
}

export async function countUnreadLiveClassroomLobbyInboxForUser(
  userId: string,
): Promise<number> {
  try {
    const rows = await db
      .select({ id: liveClassroomLobbyInboxMessages.id })
      .from(liveClassroomLobbyInboxMessages)
      .where(eq(liveClassroomLobbyInboxMessages.recipientUserId, userId));

    if (rows.length === 0) return 0;

    const readRows = await db
      .select({ itemId: inboxReads.itemId })
      .from(inboxReads)
      .where(
        and(
          eq(inboxReads.userId, userId),
          eq(inboxReads.itemType, "live_classroom_lobby"),
          inArray(
            inboxReads.itemId,
            rows.map((r) => String(r.id)),
          ),
        ),
      );

    const readIds = new Set(readRows.map((r) => r.itemId));
    return rows.filter((r) => !readIds.has(String(r.id))).length;
  } catch (error) {
    if (isMissingLobbyInboxTableError(error)) return 0;
    throw error;
  }
}

export async function deleteLiveClassroomLobbyInboxMessagesForUser(
  userId: string,
): Promise<void> {
  try {
    await db
      .delete(liveClassroomLobbyInboxMessages)
      .where(eq(liveClassroomLobbyInboxMessages.recipientUserId, userId));
  } catch (error) {
    if (isMissingLobbyInboxTableError(error)) return;
    throw error;
  }
}
