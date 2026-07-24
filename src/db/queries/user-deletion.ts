import { db } from "@/db";
import {
  adminPlanAssignmentInvites,
  adminPlanAssignmentLogs,
  adminPrivilegeLogs,
  adminUserProfileAccessLogs,
  affiliateBroadcastInboxMessages,
  affiliates,
  billingInvoices,
  billingProrationLines,
  cards,
  deactivated,
  decks,
  deviceSyncTokens,
  inboxReads,
  nativePushTokens,
  quizResultInboxMessages,
  quizResults,
  quizSecurityInboxMessages,
  quizSecuritySessions,
  aiRecallSessions,
  cardMastery,
  savedHomeworkAssignments,
  savedLessonPlans,
  stripeSubscriptions,
  userPlanTrials,
  billingNoticeInboxMessages,
  welcomeInboxMessages,
  supportTickets,
  teamDeckAssignments,
  teamMembers,
  teamOwnerQuizDefaults,
  teamWorkspaceEvents,
  teams,
} from "@/db/schema";
import { deleteFromS3 } from "@/lib/s3";
import { recordDeletionProrationAndCancel } from "@/lib/account-deletion-proration-ledger";
import type { DeletedUserSnapshot } from "@/lib/account-deletion-proration-ledger";
import { getActiveStripeSubscription } from "@/db/queries/stripe-subscriptions";
import { eq, inArray, or } from "drizzle-orm";

function collectUrl(url: string | null | undefined, bucket: Set<string>) {
  if (url?.trim()) bucket.add(url.trim());
}

async function collectUserMediaUrls(userId: string): Promise<string[]> {
  const urls = new Set<string>();

  const ownedTeams = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.ownerUserId, userId));
  const ownedTeamIds = ownedTeams.map((t) => t.id);

  const personalDecks = await db
    .select({
      id: decks.id,
      coverImageUrl: decks.coverImageUrl,
    })
    .from(decks)
    .where(eq(decks.userId, userId));

  for (const deck of personalDecks) {
    collectUrl(deck.coverImageUrl, urls);
  }

  const deckIds = personalDecks.map((d) => d.id);
  if (ownedTeamIds.length > 0) {
    const teamDecks = await db
      .select({
        id: decks.id,
        coverImageUrl: decks.coverImageUrl,
      })
      .from(decks)
      .where(inArray(decks.teamId, ownedTeamIds));
    for (const deck of teamDecks) {
      collectUrl(deck.coverImageUrl, urls);
      deckIds.push(deck.id);
    }
  }

  if (deckIds.length > 0) {
    const cardRows = await db
      .select({
        frontImageUrl: cards.frontImageUrl,
        backImageUrl: cards.backImageUrl,
      })
      .from(cards)
      .where(inArray(cards.deckId, deckIds));
    for (const row of cardRows) {
      collectUrl(row.frontImageUrl, urls);
      collectUrl(row.backImageUrl, urls);
    }
  }

  const tickets = await db
    .select({ attachmentUrl: supportTickets.attachmentUrl })
    .from(supportTickets)
    .where(eq(supportTickets.userId, userId));
  for (const t of tickets) {
    collectUrl(t.attachmentUrl, urls);
  }

  const lessonPlanPdfs = await db
    .select({ pdfUrl: savedLessonPlans.pdfUrl })
    .from(savedLessonPlans)
    .where(eq(savedLessonPlans.userId, userId));
  for (const row of lessonPlanPdfs) {
    collectUrl(row.pdfUrl, urls);
  }

  const homeworkPdfs = await db
    .select({ pdfUrl: savedHomeworkAssignments.pdfUrl })
    .from(savedHomeworkAssignments)
    .where(eq(savedHomeworkAssignments.userId, userId));
  for (const row of homeworkPdfs) {
    collectUrl(row.pdfUrl, urls);
  }

  return [...urls];
}

async function deleteUserMedia(urls: string[]) {
  for (const url of urls) {
    try {
      await deleteFromS3(url);
    } catch (error) {
      console.error("[purgeAllUserData] S3 delete failed:", url, error);
    }
  }
}

export type PurgeAllUserDataOptions = {
  /** Set when Stripe was already canceled/refunded (e.g. delete-account action). */
  skipStripeCancellation?: boolean;
  /** Snapshot for proration ledger when user is already removed from Clerk. */
  deletedUserSnapshot?: DeletedUserSnapshot;
};

/**
 * Removes all application data for a Clerk user. Idempotent — safe on webhook retries.
 */
export async function purgeAllUserData(
  userId: string,
  options?: PurgeAllUserDataOptions,
): Promise<void> {
  const mediaUrls = await collectUserMediaUrls(userId);

  if (!options?.skipStripeCancellation) {
    const activeSub = await getActiveStripeSubscription(userId);
    if (activeSub) {
      try {
        await recordDeletionProrationAndCancel({
          clerkUserId: userId,
          stripeCustomerId: activeSub.stripeCustomerId,
          stripeSubscriptionId: activeSub.stripeSubscriptionId,
          planSlug: activeSub.planSlug,
          subscriptionPeriodEnd: activeSub.currentPeriodEnd,
          userSnapshot: options?.deletedUserSnapshot,
        });
      } catch (error) {
        console.error("[purgeAllUserData] Stripe cancel/refund failed:", error);
      }
    }
  }

  // neon-http driver does not support transactions — run deletes sequentially.
  const ownedTeams = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.ownerUserId, userId));
  const ownedTeamIds = ownedTeams.map((t) => t.id);

  if (ownedTeamIds.length > 0) {
    await db.delete(teams).where(eq(teams.ownerUserId, userId));
  }
  await db.delete(teamOwnerQuizDefaults).where(eq(teamOwnerQuizDefaults.ownerUserId, userId));

  await db.delete(teamMembers).where(eq(teamMembers.userId, userId));
  await db
    .delete(teamDeckAssignments)
    .where(eq(teamDeckAssignments.memberUserId, userId));
  await db
    .delete(teamWorkspaceEvents)
    .where(eq(teamWorkspaceEvents.ownerUserId, userId));

  await db.delete(decks).where(eq(decks.userId, userId));

  await db.delete(savedHomeworkAssignments).where(eq(savedHomeworkAssignments.userId, userId));
  await db.delete(savedLessonPlans).where(eq(savedLessonPlans.userId, userId));

  await db.delete(supportTickets).where(eq(supportTickets.userId, userId));
  await db.delete(billingInvoices).where(eq(billingInvoices.userId, userId));
  await db
    .delete(billingProrationLines)
    .where(eq(billingProrationLines.userId, userId));
  await db.delete(stripeSubscriptions).where(eq(stripeSubscriptions.userId, userId));
  await db.delete(userPlanTrials).where(eq(userPlanTrials.userId, userId));
  await db
    .delete(billingNoticeInboxMessages)
    .where(eq(billingNoticeInboxMessages.recipientUserId, userId));
  await db
    .delete(welcomeInboxMessages)
    .where(eq(welcomeInboxMessages.recipientUserId, userId));
  await db.delete(quizResults).where(eq(quizResults.userId, userId));
  await db.delete(quizSecuritySessions).where(eq(quizSecuritySessions.userId, userId));
  await db.delete(aiRecallSessions).where(eq(aiRecallSessions.userId, userId));
  await db.delete(cardMastery).where(eq(cardMastery.userId, userId));
  await db
    .delete(quizResultInboxMessages)
    .where(eq(quizResultInboxMessages.recipientUserId, userId));
  await db
    .delete(quizSecurityInboxMessages)
    .where(eq(quizSecurityInboxMessages.recipientUserId, userId));
  await db.delete(inboxReads).where(eq(inboxReads.userId, userId));
  await db.delete(deviceSyncTokens).where(eq(deviceSyncTokens.userId, userId));
  await db.delete(nativePushTokens).where(eq(nativePushTokens.userId, userId));
  await db
    .delete(affiliateBroadcastInboxMessages)
    .where(eq(affiliateBroadcastInboxMessages.recipientUserId, userId));
  await db
    .delete(adminPlanAssignmentInvites)
    .where(
      or(
        eq(adminPlanAssignmentInvites.targetUserId, userId),
        eq(adminPlanAssignmentInvites.assignedByUserId, userId),
      ),
    );
  await db.delete(deactivated).where(eq(deactivated.userId, userId));
  await db
    .delete(affiliates)
    .where(
      or(
        eq(affiliates.invitedUserId, userId),
        eq(affiliates.addedByUserId, userId),
        eq(affiliates.revokedByUserId, userId),
      ),
    );

  await db
    .delete(adminPlanAssignmentLogs)
    .where(
      or(
        eq(adminPlanAssignmentLogs.targetUserId, userId),
        eq(adminPlanAssignmentLogs.assignedByUserId, userId),
      ),
    );
  await db
    .delete(adminPrivilegeLogs)
    .where(
      or(
        eq(adminPrivilegeLogs.targetUserId, userId),
        eq(adminPrivilegeLogs.grantedByUserId, userId),
      ),
    );
  await db
    .delete(adminUserProfileAccessLogs)
    .where(
      or(
        eq(adminUserProfileAccessLogs.targetUserId, userId),
        eq(adminUserProfileAccessLogs.accessedByUserId, userId),
      ),
    );

  await deleteUserMedia(mediaUrls);
}
