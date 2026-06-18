"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth, currentUser } from "@/lib/clerk-auth";
import { createClerkClient } from "@clerk/backend";
import {
  addContactUsReply,
  archiveContactUsMessage,
  createContactUsMessage,
  getContactUsByAccessToken,
  getContactUsMessageById,
  getContactUsWithReplies,
  getPlatformContactSettings,
  isContactUsSchemaUnavailableError,
  markContactUsMessageRead,
  upsertPlatformContactSettings,
  type ContactSocialLink,
} from "@/db/queries/contact-us";
import {
  markContactUsNotificationRead,
  markContactUsNotificationsReadForMessage,
} from "@/db/queries/contact-us-notifications";
import {
  notifyAdminsOfContactUsMessage,
  notifyAdminsOfContactUsUserReply,
  notifyUserOfContactUsAdminReply,
} from "@/lib/contact-us-notify";
import { serializeContactMessage } from "@/lib/contact-us-admin-dto";
import {
  contactUsThreadHref,
  serializeContactUsThread,
} from "@/lib/contact-us-thread-dto";
import {
  contactUsTokenMatches,
  userOwnsContactUsMessage,
} from "@/lib/contact-us-access";
import { isClerkPlatformAdminRole } from "@/lib/clerk-platform-admin-role";
import { isPlatformSuperadminAllowListed } from "@/lib/platform-superadmin";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const caller = await clerkClient.users.getUser(userId);
  const role = (caller.publicMetadata as { role?: string })?.role;
  if (!isClerkPlatformAdminRole(role) && !isPlatformSuperadminAllowListed(userId)) {
    throw new Error("Forbidden");
  }
  const name =
    [caller.firstName, caller.lastName].filter(Boolean).join(" ") ||
    caller.username ||
    "Support";
  return { userId, name };
}

async function getOptionalSessionUser() {
  const { userId } = await auth();
  if (!userId) return { userId: null as string | null, userEmail: null as string | null, userName: null as string | null };
  const user = await currentUser();
  return {
    userId,
    userEmail: user?.primaryEmailAddress?.emailAddress ?? null,
    userName: user?.fullName ?? user?.username ?? null,
  };
}

async function assertContactUsThreadAccess(messageId: number, token?: string) {
  const session = await getOptionalSessionUser();
  const thread = await getContactUsWithReplies(messageId);
  if (!thread) throw new Error("Conversation not found");

  const { message } = thread;
  if (userOwnsContactUsMessage(message, session.userId, session.userEmail)) {
    return { thread, session, access: "user" as const };
  }
  if (contactUsTokenMatches(message, token)) {
    return { thread, session, access: "token" as const };
  }
  throw new Error("Forbidden");
}

const socialLinkSchema = z.object({
  platform: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(120),
  url: z.string().trim().url().max(500),
});

const submitContactMessageSchema = z.object({
  name: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(255),
  subject: z.string().trim().min(1).max(500),
  message: z.string().trim().min(10).max(5000),
});

const updateContactSettingsSchema = z.object({
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(64).nullable(),
  socialLinks: z.array(socialLinkSchema).max(12),
});

const messageIdSchema = z.object({
  messageId: z.number().int().positive(),
});

const threadAccessSchema = z.object({
  messageId: z.number().int().positive(),
  token: z.string().trim().min(1).max(64).optional(),
});

const replySchema = z
  .object({
    messageId: z.number().int().positive(),
    message: z.string().trim().max(5000).optional().default(""),
    imageUrl: z.string().url().max(2000).nullable().optional(),
    token: z.string().trim().min(1).max(64).optional(),
  })
  .refine((data) => data.message.trim().length > 0 || Boolean(data.imageUrl), {
    message: "Add a message or attach an image",
  });

const CHAT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const CHAT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

async function canUploadToContactUsThread(messageId: number, token?: string) {
  const session = await getOptionalSessionUser();
  const { userId } = await auth();
  if (userId) {
    const caller = await clerkClient.users.getUser(userId);
    const role = (caller.publicMetadata as { role?: string })?.role;
    if (isClerkPlatformAdminRole(role) || isPlatformSuperadminAllowListed(userId)) {
      return { scope: "admin" as const };
    }
  }

  await assertContactUsThreadAccess(messageId, token);
  return { scope: "participant" as const, session };
}

export async function uploadContactUsChatImageAction(formData: FormData): Promise<string> {
  const messageId = z.coerce.number().int().positive().parse(formData.get("messageId"));
  const token = formData.get("token")?.toString();

  await canUploadToContactUsThread(messageId, token);

  const file = formData.get("image");
  if (!(file instanceof File)) throw new Error("No image file provided");
  if (!CHAT_IMAGE_TYPES.includes(file.type as (typeof CHAT_IMAGE_TYPES)[number])) {
    throw new Error("Only JPEG, PNG, WebP, and GIF images are allowed");
  }
  if (file.size > CHAT_IMAGE_MAX_BYTES) {
    throw new Error("Image must be smaller than 10 MB");
  }

  const { uploadContactUsChatImageToS3 } = await import("@/lib/s3");
  return uploadContactUsChatImageToS3({ messageId, file });
}

export async function submitContactUsMessageAction(data: z.infer<typeof submitContactMessageSchema>) {
  const parsed = submitContactMessageSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false as const, error: "Please check your message and try again." };
  }

  const { userId } = await auth();

  try {
    const message = await createContactUsMessage({
      ...parsed.data,
      userId,
    });

    await notifyAdminsOfContactUsMessage({
      messageId: message.id,
      name: message.name,
      subject: message.subject,
      message: message.message,
    });

    revalidatePath("/admin/support-center/contact-us");
    revalidatePath("/dashboard/inbox");

    return {
      ok: true as const,
      messageId: message.id,
      threadHref: contactUsThreadHref(message.id, message.accessToken),
    };
  } catch (error) {
    if (isContactUsSchemaUnavailableError(error)) {
      return {
        ok: false as const,
        error:
          "Contact messaging is temporarily unavailable. Please email support directly.",
      };
    }
    throw error;
  }
}

export async function getContactUsThreadAction(data: z.infer<typeof threadAccessSchema>) {
  const parsed = threadAccessSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid conversation");

  const { thread } = await assertContactUsThreadAccess(parsed.data.messageId, parsed.data.token);
  return serializeContactUsThread(thread.message, thread.replies);
}

export async function getAdminContactUsThreadAction(data: z.infer<typeof messageIdSchema>) {
  const parsed = messageIdSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid conversation");

  await requireAdmin();
  const thread = await getContactUsWithReplies(parsed.data.messageId);
  if (!thread) throw new Error("Conversation not found");

  return serializeContactUsThread(thread.message, thread.replies);
}

export async function replyToContactUsAction(data: z.infer<typeof replySchema>) {
  const parsed = replySchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid reply");

  const { thread, session } = await assertContactUsThreadAccess(
    parsed.data.messageId,
    parsed.data.token,
  );
  if (thread.message.status === "archived") throw new Error("This conversation is archived");

  const messageText = parsed.data.message.trim();
  const imageUrl = parsed.data.imageUrl ?? null;

  try {
    await addContactUsReply({
      messageId: parsed.data.messageId,
      authorUserId: session.userId,
      authorName: session.userName ?? thread.message.name,
      authorRole: "user",
      message: messageText,
      imageUrl,
    });
  } catch (error) {
    if (isContactUsSchemaUnavailableError(error)) {
      throw new Error(
        "Contact messaging is temporarily unavailable. Please try again later or email support.",
      );
    }
    throw error;
  }

  try {
    await notifyAdminsOfContactUsUserReply({
      messageId: parsed.data.messageId,
      subject: thread.message.subject,
      message: messageText || "[Image attachment]",
      userName: session.userName ?? thread.message.name,
    });
  } catch (error) {
    console.error("[contact-us] notify admins of user reply failed", error);
  }

  try {
    revalidatePath("/admin/support-center/contact-us");
    revalidatePath(`/contact/thread/${parsed.data.messageId}`);
  } catch (error) {
    console.error("[contact-us] revalidate after user reply failed", error);
  }

  const updated = await getContactUsWithReplies(parsed.data.messageId);
  if (!updated) throw new Error("Conversation not found");
  return { thread: serializeContactUsThread(updated.message, updated.replies) };
}

export async function adminReplyToContactUsAction(data: z.infer<typeof replySchema>) {
  const parsed = replySchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid reply");

  const { userId, name } = await requireAdmin();
  const thread = await getContactUsWithReplies(parsed.data.messageId);
  if (!thread) throw new Error("Conversation not found");
  if (thread.message.status === "archived") throw new Error("This conversation is archived");

  const messageText = parsed.data.message.trim();
  const imageUrl = parsed.data.imageUrl ?? null;

  try {
    await addContactUsReply({
      messageId: parsed.data.messageId,
      authorUserId: userId,
      authorName: name,
      authorRole: "admin",
      message: messageText,
      imageUrl,
    });
  } catch (error) {
    if (isContactUsSchemaUnavailableError(error)) {
      throw new Error(
        "Contact messaging is temporarily unavailable. Please try again later.",
      );
    }
    throw error;
  }

  if (thread.message.userId) {
    try {
      await notifyUserOfContactUsAdminReply({
        messageId: parsed.data.messageId,
        recipientUserId: thread.message.userId,
        subject: thread.message.subject,
        message: messageText || "[Image attachment]",
        adminName: name,
      });
    } catch (error) {
      console.error("[contact-us] notify user of admin reply failed", error);
    }
  }

  try {
    await markContactUsMessageRead(parsed.data.messageId, userId);
  } catch (error) {
    console.error("[contact-us] mark message read failed", error);
  }

  try {
    revalidatePath("/admin/support-center/contact-us");
    revalidatePath("/dashboard/inbox");
    revalidatePath(`/contact/thread/${parsed.data.messageId}`);
  } catch (error) {
    console.error("[contact-us] revalidate after admin reply failed", error);
  }

  const updated = await getContactUsWithReplies(parsed.data.messageId);
  if (!updated) throw new Error("Conversation not found");
  return { thread: serializeContactUsThread(updated.message, updated.replies) };
}

export async function loadContactUsThreadPageAction(data: z.infer<typeof threadAccessSchema>) {
  const parsed = threadAccessSchema.safeParse(data);
  if (!parsed.success) return null;

  try {
    const { thread } = await assertContactUsThreadAccess(parsed.data.messageId, parsed.data.token);
    return serializeContactUsThread(thread.message, thread.replies);
  } catch {
    return null;
  }
}

export async function updatePlatformContactSettingsAction(
  data: z.infer<typeof updateContactSettingsSchema>,
) {
  const parsed = updateContactSettingsSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid contact settings");

  const { userId } = await requireAdmin();

  await upsertPlatformContactSettings({
    email: parsed.data.email,
    phone: parsed.data.phone?.trim() ? parsed.data.phone.trim() : null,
    socialLinks: parsed.data.socialLinks as ContactSocialLink[],
    updatedByUserId: userId,
  });

  revalidatePath("/contact");
  revalidatePath("/admin/support-center/contact-us");

  return { ok: true as const };
}

export async function adminMarkContactUsMessageReadAction(data: z.infer<typeof messageIdSchema>) {
  const parsed = messageIdSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid message");

  const { userId } = await requireAdmin();
  await markContactUsMessageRead(parsed.data.messageId, userId);
  await markContactUsNotificationsReadForMessage(userId, parsed.data.messageId);

  revalidatePath("/admin/support-center/contact-us");
  revalidatePath("/dashboard/inbox");

  return { ok: true as const };
}

export async function adminArchiveContactUsMessageAction(data: z.infer<typeof messageIdSchema>) {
  const parsed = messageIdSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid message");

  const { userId } = await requireAdmin();
  await archiveContactUsMessage(parsed.data.messageId, userId);
  await markContactUsNotificationsReadForMessage(userId, parsed.data.messageId);

  revalidatePath("/admin/support-center/contact-us");
  revalidatePath("/dashboard/inbox");

  return { ok: true as const };
}

export async function markContactUsInboxNotificationReadAction(data: {
  notificationId: number;
}) {
  const notificationId = z.number().int().positive().safeParse(data.notificationId);
  if (!notificationId.success) throw new Error("Invalid notification");

  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  await markContactUsNotificationRead(userId, notificationId.data);

  revalidatePath("/dashboard/inbox");

  return { ok: true as const };
}

export async function getContactUsMessageForAdminAction(data: z.infer<typeof messageIdSchema>) {
  const parsed = messageIdSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid message");

  await requireAdmin();
  const row = await getContactUsMessageById(parsed.data.messageId);
  if (!row) throw new Error("Message not found");

  return serializeContactMessage(row);
}

export async function getPublicContactSettingsAction() {
  const settings = await getPlatformContactSettings();
  return {
    email: settings.email,
    phone: settings.phone ?? null,
    socialLinks: (settings.socialLinks ?? []) as ContactSocialLink[],
  };
}
