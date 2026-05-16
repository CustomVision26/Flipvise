import { db } from "@/db";
import {
  adminPlanAssignmentInvites,
  adminPlanAssignmentLogs,
  adminPrivilegeLogs,
  affiliateBroadcastInboxMessages,
  affiliates,
  billingInvoices,
  billingProrationLines,
  cards,
  deactivated,
  decks,
  inboxReads,
  quizResultInboxMessages,
  quizResults,
  stripeSubscriptions,
  supportTickets,
  teamDeckAssignments,
  teamMembers,
  teamWorkspaceEvents,
  teams,
} from "@/db/schema";
import { deleteFromS3 } from "@/lib/s3";
import { cancelSubscriptionWithProratedRefund } from "@/lib/stripe-account-deletion";
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
        await cancelSubscriptionWithProratedRefund(activeSub.stripeSubscriptionId);
      } catch (error) {
        console.error("[purgeAllUserData] Stripe cancel/refund failed:", error);
      }
    }
  }

  await db.transaction(async (tx) => {
    const ownedTeams = await tx
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.ownerUserId, userId));
    const ownedTeamIds = ownedTeams.map((t) => t.id);

    if (ownedTeamIds.length > 0) {
      await tx.delete(teams).where(eq(teams.ownerUserId, userId));
    }

    await tx.delete(teamMembers).where(eq(teamMembers.userId, userId));
    await tx
      .delete(teamDeckAssignments)
      .where(eq(teamDeckAssignments.memberUserId, userId));
    await tx
      .delete(teamWorkspaceEvents)
      .where(eq(teamWorkspaceEvents.ownerUserId, userId));

    await tx.delete(decks).where(eq(decks.userId, userId));

    await tx.delete(supportTickets).where(eq(supportTickets.userId, userId));
    await tx.delete(billingInvoices).where(eq(billingInvoices.userId, userId));
    await tx
      .delete(billingProrationLines)
      .where(eq(billingProrationLines.userId, userId));
    await tx.delete(stripeSubscriptions).where(eq(stripeSubscriptions.userId, userId));
    await tx.delete(quizResults).where(eq(quizResults.userId, userId));
    await tx
      .delete(quizResultInboxMessages)
      .where(eq(quizResultInboxMessages.recipientUserId, userId));
    await tx.delete(inboxReads).where(eq(inboxReads.userId, userId));
    await tx
      .delete(affiliateBroadcastInboxMessages)
      .where(eq(affiliateBroadcastInboxMessages.recipientUserId, userId));
    await tx
      .delete(adminPlanAssignmentInvites)
      .where(
        or(
          eq(adminPlanAssignmentInvites.targetUserId, userId),
          eq(adminPlanAssignmentInvites.assignedByUserId, userId),
        ),
      );
    await tx.delete(deactivated).where(eq(deactivated.userId, userId));
    await tx
      .delete(affiliates)
      .where(
        or(
          eq(affiliates.invitedUserId, userId),
          eq(affiliates.addedByUserId, userId),
          eq(affiliates.revokedByUserId, userId),
        ),
      );

    await tx
      .delete(adminPlanAssignmentLogs)
      .where(
        or(
          eq(adminPlanAssignmentLogs.targetUserId, userId),
          eq(adminPlanAssignmentLogs.assignedByUserId, userId),
        ),
      );
    await tx
      .delete(adminPrivilegeLogs)
      .where(
        or(
          eq(adminPrivilegeLogs.targetUserId, userId),
          eq(adminPrivilegeLogs.grantedByUserId, userId),
        ),
      );
  });

  await deleteUserMedia(mediaUrls);
}
