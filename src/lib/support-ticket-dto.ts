import type { InferSelectModel } from "drizzle-orm";
import { supportTicketNotifications, supportTicketReplies, supportTickets } from "@/db/schema";

export type SerializedTicketMessage = {
  id: number;
  ticketId: number;
  authorUserId: string;
  authorName: string;
  authorRole: "admin" | "user";
  message: string;
  imageUrl: string | null;
  createdAt: string;
};

export function serializeSupportTicketMessageRow(
  row: InferSelectModel<typeof supportTicketReplies>,
): SerializedTicketMessage {
  return {
    id: row.id,
    ticketId: row.ticketId,
    authorUserId: row.authorUserId,
    authorName: row.authorName,
    authorRole: row.authorRole,
    message: row.message,
    imageUrl: row.imageUrl ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function supportTicketPreview(text: string, max = 120): string {
  const s = text.replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

export function supportNotificationTitle(
  kind: string,
  ticketSubject: string,
): string {
  switch (kind) {
    case "new_ticket":
      return `New support ticket: ${ticketSubject}`;
    case "user_reply":
      return `User replied: ${ticketSubject}`;
    case "admin_reply":
      return `Support replied: ${ticketSubject}`;
    case "status_resolved":
      return `Ticket resolved: ${ticketSubject}`;
    default:
      return ticketSubject;
  }
}

export type SerializedSupportNotification = {
  id: number;
  ticketId: number;
  kind: string;
  preview: string;
  title: string;
  readAt: string | null;
  createdAt: string;
};

export function serializeSupportNotificationRow(
  row: InferSelectModel<typeof supportTicketNotifications>,
  ticketSubject: string,
): SerializedSupportNotification {
  return {
    id: row.id,
    ticketId: row.ticketId,
    kind: row.kind,
    preview: row.preview,
    title: supportNotificationTitle(row.kind, ticketSubject),
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export type SupportTicketThreadTicket = {
  id: number;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  subject: string;
  message: string;
  category: string;
  status: string;
  priority: string;
  attachmentUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export function serializeSupportTicketForThread(
  row: InferSelectModel<typeof supportTickets>,
): SupportTicketThreadTicket {
  return {
    id: row.id,
    userId: row.userId,
    userEmail: row.userEmail ?? null,
    userName: row.userName ?? null,
    subject: row.subject,
    message: row.message,
    category: row.category,
    status: row.status,
    priority: row.priority,
    attachmentUrl: row.attachmentUrl ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
