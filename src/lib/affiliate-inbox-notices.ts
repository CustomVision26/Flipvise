import type { UnifiedInboxItem } from "@/lib/inbox-item-types";

/** Minimal affiliate row fields used to build expiry / revoke inbox notices. */
export type AffiliateRowForNotice = {
  id: number;
  affiliateName: string;
  planAssigned: string;
  status: "pending" | "active" | "revoked";
  endsAt: Date;
  inviteAcceptedAt: Date | null;
  revokedAt: Date | null;
};

function formatLongDate(d: Date): string {
  return d.toLocaleDateString(undefined, { dateStyle: "long" });
}

/**
 * In-app notices for the marketing-affiliate invitee when access ends (scheduled
 * end while still `active`) or the row is `revoked` (withdrawn invite or access
 * removed). Keys use `affiliate_notice:*` so read state is separate from the
 * original `affiliate:{id}` invite row.
 */
export function buildAffiliateNoticeInboxItems(
  rows: AffiliateRowForNotice[],
  readSet: Set<string>,
): UnifiedInboxItem[] {
  const now = Date.now();
  const out: UnifiedInboxItem[] = [];

  for (const a of rows) {
    if (a.status === "revoked") {
      const eventDate = a.revokedAt;
      const itemId = `revoked-${a.id}`;
      const key = `affiliate_notice:${itemId}`;
      const hadAccepted = Boolean(a.inviteAcceptedAt);
      const kind = hadAccepted ? "revoked_access" : "revoked_invite";
      const at = eventDate ? formatLongDate(eventDate) : null;

      const title = hadAccepted
        ? `Affiliate access removed — ${a.affiliateName}`
        : `Affiliate invitation withdrawn — ${a.affiliateName}`;

      const description = hadAccepted
        ? at
          ? `A platform administrator ended this marketing affiliate arrangement on ${at}. The complimentary plan (${a.planAssigned}) tied to it is no longer active, and your Flipvise account was set to the Free plan. If this looks wrong, contact support with your account email.`
          : `A platform administrator ended this marketing affiliate arrangement. The complimentary plan (${a.planAssigned}) tied to it is no longer active, and your Flipvise account was set to the Free plan. If this looks wrong, contact support with your account email.`
        : at
          ? `This invitation was withdrawn on ${at}. No complimentary plan was applied from this invite, and you do not need to take further action.`
          : "This invitation was withdrawn. No complimentary plan was applied from this invite, and you do not need to take further action.";

      out.push({
        type: "affiliate_notice",
        key,
        title,
        description,
        dateIso: (eventDate ?? a.endsAt).toISOString(),
        isRead: readSet.has(key),
        requiresAction: false,
        payload: {
          kind,
          affiliateId: a.id,
          affiliateName: a.affiliateName,
          planAssigned: a.planAssigned,
          eventAtIso: (eventDate ?? a.endsAt).toISOString(),
        },
      });
      continue;
    }

    if (a.status === "active" && a.endsAt.getTime() < now) {
      const itemId = `expired-${a.id}`;
      const key = `affiliate_notice:${itemId}`;
      const ends = formatLongDate(a.endsAt);

      out.push({
        type: "affiliate_notice",
        key,
        title: `Affiliate plan period ended — ${a.affiliateName}`,
        description: `The scheduled end date for your marketing affiliate access was ${ends}. The complimentary plan (${a.planAssigned}) from this arrangement is no longer within its active period. If you still need paid features, open Billing in the dashboard to subscribe. If your account already shows Free, you can dismiss this message.`,
        dateIso: a.endsAt.toISOString(),
        isRead: readSet.has(key),
        requiresAction: false,
        payload: {
          kind: "expired",
          affiliateId: a.id,
          affiliateName: a.affiliateName,
          planAssigned: a.planAssigned,
          eventAtIso: a.endsAt.toISOString(),
        },
      });
    }
  }

  return out;
}
