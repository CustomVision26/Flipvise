import type { UnifiedInboxItem } from "@/lib/inbox-item-types";
import {
  serializeSupportNotificationRow,
  supportNotificationTitle,
} from "@/lib/support-ticket-dto";
import type { InferSelectModel } from "drizzle-orm";
import type { supportTicketNotifications, supportTickets } from "@/db/schema";

export function supportNotificationsToInboxItems(
  notifications: InferSelectModel<typeof supportTicketNotifications>[],
  ticketsById: Map<number, InferSelectModel<typeof supportTickets>>,
): UnifiedInboxItem[] {
  return notifications
    .filter((n) => n.kind === "admin_reply" || n.kind === "status_resolved")
    .map((n) => {
      const ticket = ticketsById.get(n.ticketId);
      const subject = ticket?.subject ?? `Ticket #${n.ticketId}`;
      const serialized = serializeSupportNotificationRow(n, subject);
      return {
        type: "support_ticket" as const,
        key: `support_ticket-${n.id}`,
        title: serialized.title,
        description: serialized.preview,
        dateIso: serialized.createdAt,
        isRead: serialized.readAt != null,
        requiresAction: n.kind === "admin_reply" && serialized.readAt == null,
        payload: {
          notificationId: n.id,
          ticketId: n.ticketId,
          kind: n.kind,
          subject,
          preview: serialized.preview,
        },
      };
    });
}

export function supportNotificationInboxTitle(kind: string, subject: string): string {
  return supportNotificationTitle(kind, subject);
}
