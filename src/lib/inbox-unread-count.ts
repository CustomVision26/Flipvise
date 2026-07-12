import { countUnreadTeamInvitationsForInboxBadge } from "@/db/queries/teams";
import { countUnreadAffiliateBroadcastInboxForUser } from "@/db/queries/affiliate-broadcast-inbox";
import { countUnreadSubscriptionCheckoutConfirmationsForUser } from "@/db/queries/subscription-checkout-inbox";
import { countUnreadBillingNoticeInboxForUser } from "@/db/queries/billing-notice-inbox";
import { countUnreadSupportNotificationsForInboxBadge } from "@/db/queries/support-notifications";
import { countUnreadContactUsNotificationsForRecipient } from "@/db/queries/contact-us-notifications";
import { tryTeamQuery } from "@/lib/team-query-fallback";

export async function getInboxUnreadCountForUser(input: {
  userId: string;
  primaryEmail: string | null | undefined;
  isAdmin: boolean;
}): Promise<number> {
  const { userId, primaryEmail, isAdmin } = input;

  const [
    invites,
    affiliateBroadcasts,
    subscriptionConfirmations,
    billingNotices,
    supportAlerts,
    contactUsAlerts,
  ] = await Promise.all([
    primaryEmail != null && primaryEmail !== ""
      ? tryTeamQuery(
          () => countUnreadTeamInvitationsForInboxBadge(primaryEmail, userId),
          0,
        )
      : Promise.resolve(0),
    tryTeamQuery(() => countUnreadAffiliateBroadcastInboxForUser(userId), 0),
    countUnreadSubscriptionCheckoutConfirmationsForUser(userId).catch(() => 0),
    countUnreadBillingNoticeInboxForUser(userId).catch(() => 0),
    countUnreadSupportNotificationsForInboxBadge(userId).catch(() => 0),
    isAdmin
      ? countUnreadContactUsNotificationsForRecipient(userId).catch(() => 0)
      : Promise.resolve(0),
  ]);

  return (
    invites +
    affiliateBroadcasts +
    subscriptionConfirmations +
    billingNotices +
    supportAlerts +
    contactUsAlerts
  );
}
