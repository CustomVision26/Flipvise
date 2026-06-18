import type { InferSelectModel } from "drizzle-orm";
import type { contactUsMessages, platformContactSettings } from "@/db/schema";
import type { ContactSocialLink } from "@/db/queries/contact-us";

export type SerializedContactSettings = {
  email: string;
  phone: string | null;
  socialLinks: ContactSocialLink[];
  updatedAt: string | null;
};

export type SerializedContactMessage = {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  userId: string | null;
  status: "open" | "read" | "archived";
  guestChatLastSeenAt: string | null;
  readAt: string | null;
  createdAt: string;
};

export type ContactUsStats = {
  total: number;
  openCount: number;
  readCount: number;
  archivedCount: number;
  thisWeekCount: number;
};

export function serializeContactSettings(
  row: InferSelectModel<typeof platformContactSettings>,
): SerializedContactSettings {
  return {
    email: row.email,
    phone: row.phone ?? null,
    socialLinks: (row.socialLinks ?? []) as ContactSocialLink[],
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

export function serializeContactMessage(
  row: InferSelectModel<typeof contactUsMessages>,
): SerializedContactMessage {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    subject: row.subject,
    message: row.message,
    userId: row.userId ?? null,
    status: row.status,
    guestChatLastSeenAt: row.guestChatLastSeenAt?.toISOString() ?? null,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
