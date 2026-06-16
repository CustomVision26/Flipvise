import { db } from "@/db";
import { contactUsNotifications } from "@/db/schema";
import { withContactUsReadFallback } from "@/lib/contact-us-db-fallback";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

export type ContactUsNotificationKind = "new_message" | "admin_reply" | "user_reply";

export async function insertContactUsNotifications(
  rows: {
    recipientUserId: string;
    messageId: number;
    kind: ContactUsNotificationKind;
    preview: string;
  }[],
) {
  if (rows.length === 0) return;
  await db.insert(contactUsNotifications).values(
    rows.map((r) => ({
      recipientUserId: r.recipientUserId,
      messageId: r.messageId,
      kind: r.kind,
      preview: r.preview.slice(0, 500),
    })),
  );
}

export async function listContactUsNotificationsForRecipient(
  recipientUserId: string,
  limit = 50,
) {
  return withContactUsReadFallback(
    () =>
      db
        .select()
        .from(contactUsNotifications)
        .where(eq(contactUsNotifications.recipientUserId, recipientUserId))
        .orderBy(desc(contactUsNotifications.createdAt))
        .limit(limit),
    [],
  );
}

export async function countUnreadContactUsNotificationsForRecipient(
  recipientUserId: string,
): Promise<number> {
  return withContactUsReadFallback(async () => {
    const rows = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(contactUsNotifications)
      .where(
        and(
          eq(contactUsNotifications.recipientUserId, recipientUserId),
          isNull(contactUsNotifications.readAt),
        ),
      );
    return Number(rows[0]?.count ?? 0);
  }, 0);
}

export async function markContactUsNotificationRead(
  recipientUserId: string,
  notificationId: number,
) {
  await db
    .update(contactUsNotifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(contactUsNotifications.id, notificationId),
        eq(contactUsNotifications.recipientUserId, recipientUserId),
      ),
    );
}

export async function markContactUsNotificationsReadForMessage(
  recipientUserId: string,
  messageId: number,
) {
  await db
    .update(contactUsNotifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(contactUsNotifications.recipientUserId, recipientUserId),
        eq(contactUsNotifications.messageId, messageId),
        isNull(contactUsNotifications.readAt),
      ),
    );
}
