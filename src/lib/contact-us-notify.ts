import { createClerkClient } from "@clerk/backend";
import { insertContactUsNotifications } from "@/db/queries/contact-us-notifications";
import { contactUsPreview } from "@/db/queries/contact-us";
import { listPlatformAdminRecipientUserIds } from "@/lib/list-platform-admin-user-ids";
import { notifyNativeInboxPush, notifyNativeInboxPushMany } from "@/lib/notify-native-inbox-push";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

export async function notifyAdminsOfContactUsMessage(input: {
  messageId: number;
  name: string;
  subject: string;
  message: string;
}) {
  const adminIds = await listPlatformAdminRecipientUserIds(clerkClient);
  if (adminIds.length === 0) return;

  const who = input.name.trim() || "A visitor";
  const preview = contactUsPreview(
    `${who} sent a Contact Us message: ${input.subject} — ${input.message}`,
  );

  await insertContactUsNotifications(
    adminIds.map((recipientUserId) => ({
      recipientUserId,
      messageId: input.messageId,
      kind: "new_message" as const,
      preview,
    })),
  );

  notifyNativeInboxPushMany(adminIds, "contact_us", preview);
}

export async function notifyAdminsOfContactUsUserReply(input: {
  messageId: number;
  subject: string;
  message: string;
  userName?: string | null;
}) {
  const adminIds = await listPlatformAdminRecipientUserIds(clerkClient);
  if (adminIds.length === 0) return;

  const who = input.userName?.trim() || "User";
  const preview = contactUsPreview(`${who} replied on Contact Us: ${input.message}`);

  await insertContactUsNotifications(
    adminIds.map((recipientUserId) => ({
      recipientUserId,
      messageId: input.messageId,
      kind: "user_reply" as const,
      preview,
    })),
  );

  notifyNativeInboxPushMany(adminIds, "contact_us", preview);
}

export async function notifyUserOfContactUsAdminReply(input: {
  messageId: number;
  recipientUserId: string;
  subject: string;
  message: string;
  adminName: string;
}) {
  const preview = contactUsPreview(
    `${input.adminName} replied on your Contact Us message: ${input.message}`,
  );

  await insertContactUsNotifications([
    {
      recipientUserId: input.recipientUserId,
      messageId: input.messageId,
      kind: "admin_reply",
      preview,
    },
  ]);

  notifyNativeInboxPush({
    recipientUserId: input.recipientUserId,
    category: "contact_us",
    body: preview,
  });
}
