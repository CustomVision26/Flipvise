import { db } from "@/db";
import {
  liveBattleAnswers,
  liveClassroomLobbyInboxMessages,
  liveClassroomParticipantGrants,
  liveClassroomParticipants,
  liveClassroomSessions,
  liveClassroomTeacherGrants,
  liveTeacherAnalytics,
} from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Clears Live Classroom™ rows keyed by Clerk user id.
 * Team-scoped session trees cascade when owned `teams` rows are deleted.
 */
export async function deleteLiveClassroomDataForUser(
  userId: string,
): Promise<void> {
  await db
    .delete(liveClassroomParticipants)
    .where(eq(liveClassroomParticipants.userId, userId));
  await db
    .delete(liveBattleAnswers)
    .where(eq(liveBattleAnswers.userId, userId));
  await db
    .delete(liveClassroomTeacherGrants)
    .where(eq(liveClassroomTeacherGrants.userId, userId));
  await db
    .delete(liveClassroomParticipantGrants)
    .where(eq(liveClassroomParticipantGrants.userId, userId));
  await db
    .delete(liveClassroomLobbyInboxMessages)
    .where(eq(liveClassroomLobbyInboxMessages.recipientUserId, userId));
  await db
    .delete(liveTeacherAnalytics)
    .where(eq(liveTeacherAnalytics.teacherUserId, userId));
  // Hosted sessions on teams the user does not own — cancel orphaned host refs
  // by deleting those sessions (cascade teams/questions/answers for that session).
  await db
    .delete(liveClassroomSessions)
    .where(eq(liveClassroomSessions.hostUserId, userId));
}
