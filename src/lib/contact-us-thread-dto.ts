import type { InferSelectModel } from "drizzle-orm";
import type { contactUsMessages, contactUsReplies } from "@/db/schema";

export type ContactUsThreadMessage = {
  id: number;
  authorName: string;
  authorRole: "admin" | "user";
  message: string;
  createdAt: string;
};

export type ContactUsThread = {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "open" | "read" | "archived";
  createdAt: string;
  updatedAt: string;
  replies: ContactUsThreadMessage[];
};

export function serializeContactUsReplyRow(
  row: InferSelectModel<typeof contactUsReplies>,
): ContactUsThreadMessage {
  return {
    id: row.id,
    authorName: row.authorName,
    authorRole: row.authorRole,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeContactUsThread(
  message: InferSelectModel<typeof contactUsMessages>,
  replies: InferSelectModel<typeof contactUsReplies>[],
): ContactUsThread {
  return {
    id: message.id,
    name: message.name,
    email: message.email,
    subject: message.subject,
    message: message.message,
    status: message.status,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
    replies: replies.map(serializeContactUsReplyRow),
  };
}

export function contactUsThreadHref(messageId: number, accessToken?: string | null): string {
  const base = `/contact/thread/${messageId}`;
  if (!accessToken) return base;
  return `${base}?token=${encodeURIComponent(accessToken)}`;
}
