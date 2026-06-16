import type { UnifiedInboxItem } from "@/lib/inbox-item-types";
import type { InferSelectModel } from "drizzle-orm";
import type { contactUsMessages, contactUsNotifications } from "@/db/schema";
import { contactUsThreadHref } from "@/lib/contact-us-thread-dto";

export function contactUsNotificationsToInboxItems(
  notifications: InferSelectModel<typeof contactUsNotifications>[],
  messagesById: Map<number, InferSelectModel<typeof contactUsMessages>>,
  options: { forAdmin: boolean },
): UnifiedInboxItem[] {
  return notifications
    .filter((n) => (options.forAdmin ? true : n.kind === "admin_reply"))
    .map((n) => {
      const message = messagesById.get(n.messageId);
      const subject = message?.subject ?? `Message #${n.messageId}`;
      const threadHref = options.forAdmin
        ? adminContactUsMessageHref(n.messageId)
        : contactUsThreadHref(n.messageId);

      const title =
        n.kind === "admin_reply"
          ? `Support replied: ${subject}`
          : n.kind === "user_reply"
            ? `Contact Us reply: ${subject}`
            : `Contact Us: ${subject}`;

      return {
        type: "contact_us_message" as const,
        key: `contact_us_message:${n.id}`,
        title,
        description: n.preview,
        dateIso: n.createdAt.toISOString(),
        isRead: n.readAt != null,
        requiresAction: n.readAt == null,
        payload: {
          notificationId: n.id,
          messageId: n.messageId,
          kind: n.kind,
          subject,
          preview: n.preview,
          senderName: message?.name ?? null,
          senderEmail: message?.email ?? null,
          threadHref,
          forAdmin: options.forAdmin,
        },
      };
    });
}

export const ADMIN_CONTACT_US_HREF = "/admin/support-center/contact-us";

export function adminContactUsMessageHref(messageId: number): string {
  return `${ADMIN_CONTACT_US_HREF}?message=${messageId}`;
}
