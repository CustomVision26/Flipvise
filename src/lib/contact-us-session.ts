import { auth as clerkAuth } from "@clerk/nextjs/server";
import { createClerkClient } from "@clerk/backend";
import { getContactUsMessageById } from "@/db/queries/contact-us";
import {
  contactUsTokenMatches,
  userOwnsContactUsMessage,
} from "@/lib/contact-us-access";
import { isClerkPlatformAdminRole } from "@/lib/clerk-platform-admin-role";
import { isPlatformSuperadminAllowListed } from "@/lib/platform-superadmin";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

export type ContactUsSessionUser = {
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
};

/**
 * Resolves the signed-in user without `redirect()` — safe for Server Actions and Route Handlers.
 */
export async function getContactUsSessionUser(): Promise<ContactUsSessionUser> {
  const { userId } = await clerkAuth();
  if (!userId) {
    return { userId: null, userEmail: null, userName: null };
  }

  if (!process.env.CLERK_SECRET_KEY) {
    return { userId, userEmail: null, userName: null };
  }

  try {
    const user = await clerkClient.users.getUser(userId);
    const userEmail =
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      null;
    const userName =
      [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || null;
    return { userId, userEmail, userName };
  } catch {
    return { userId, userEmail: null, userName: null };
  }
}

export async function isContactUsPlatformAdmin(userId: string): Promise<boolean> {
  if (!process.env.CLERK_SECRET_KEY) return false;
  try {
    const caller = await clerkClient.users.getUser(userId);
    const role = (caller.publicMetadata as { role?: string })?.role;
    return isClerkPlatformAdminRole(role) || isPlatformSuperadminAllowListed(userId);
  } catch {
    return false;
  }
}

export async function canAccessContactUsThread(
  messageId: number,
  token?: string,
): Promise<boolean> {
  const session = await getContactUsSessionUser();
  if (session.userId && (await isContactUsPlatformAdmin(session.userId))) {
    return true;
  }

  const message = await getContactUsMessageById(messageId);
  if (!message) return false;
  if (userOwnsContactUsMessage(message, session.userId, session.userEmail)) {
    return true;
  }
  return contactUsTokenMatches(message, token);
}
