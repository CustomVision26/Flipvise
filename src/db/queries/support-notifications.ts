import { db } from "@/db";
import { supportTicketNotifications } from "@/db/schema";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

/** Kinds surfaced in `/dashboard/inbox` (see `supportNotificationsToInboxItems`). */
const INBOX_SUPPORT_NOTIFICATION_KINDS = ["admin_reply", "status_resolved"] as const;

export type SupportNotificationKind =
  | "new_ticket"
  | "admin_reply"
  | "user_reply"
  | "status_resolved";

export async function insertSupportTicketNotifications(
  rows: {
    recipientUserId: string;
    ticketId: number;
    kind: SupportNotificationKind;
    preview: string;
  }[],
) {
  if (rows.length === 0) return;
  await db.insert(supportTicketNotifications).values(
    rows.map((r) => ({
      recipientUserId: r.recipientUserId,
      ticketId: r.ticketId,
      kind: r.kind,
      preview: r.preview.slice(0, 500),
    })),
  );
}

export async function listSupportNotificationsForRecipient(
  recipientUserId: string,
  limit = 40,
) {
  return db
    .select()
    .from(supportTicketNotifications)
    .where(eq(supportTicketNotifications.recipientUserId, recipientUserId))
    .orderBy(desc(supportTicketNotifications.createdAt))
    .limit(limit);
}

export async function countUnreadSupportNotificationsForRecipient(
  recipientUserId: string,
): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(supportTicketNotifications)
    .where(
      and(
        eq(supportTicketNotifications.recipientUserId, recipientUserId),
        isNull(supportTicketNotifications.readAt),
      ),
    );
  return Number(rows[0]?.count ?? 0);
}

/** Unread support alerts for the header inbox badge (matches dashboard inbox visibility). */
export async function countUnreadSupportNotificationsForInboxBadge(
  recipientUserId: string,
): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(supportTicketNotifications)
    .where(
      and(
        eq(supportTicketNotifications.recipientUserId, recipientUserId),
        isNull(supportTicketNotifications.readAt),
        inArray(supportTicketNotifications.kind, [...INBOX_SUPPORT_NOTIFICATION_KINDS]),
      ),
    );
  return Number(rows[0]?.count ?? 0);
}

export async function markSupportNotificationsReadForTicket(
  recipientUserId: string,
  ticketId: number,
) {
  await db
    .update(supportTicketNotifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(supportTicketNotifications.recipientUserId, recipientUserId),
        eq(supportTicketNotifications.ticketId, ticketId),
        isNull(supportTicketNotifications.readAt),
      ),
    );
}

export async function markSupportNotificationRead(
  recipientUserId: string,
  notificationId: number,
) {
  await db
    .update(supportTicketNotifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(supportTicketNotifications.id, notificationId),
        eq(supportTicketNotifications.recipientUserId, recipientUserId),
      ),
    );
}
