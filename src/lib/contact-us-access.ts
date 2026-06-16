import type { InferSelectModel } from "drizzle-orm";
import type { contactUsMessages } from "@/db/schema";

type ContactMessageRow = InferSelectModel<typeof contactUsMessages>;

export function userOwnsContactUsMessage(
  message: ContactMessageRow,
  userId: string | null | undefined,
  userEmail: string | null | undefined,
): boolean {
  if (userId && message.userId === userId) return true;
  if (userEmail && message.email.toLowerCase() === userEmail.toLowerCase()) return true;
  return false;
}

export function contactUsTokenMatches(
  message: ContactMessageRow,
  token: string | null | undefined,
): boolean {
  return Boolean(token && token.length > 0 && message.accessToken === token);
}
