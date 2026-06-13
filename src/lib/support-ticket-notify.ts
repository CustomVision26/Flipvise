import { createClerkClient } from "@clerk/backend";
import { insertSupportTicketNotifications } from "@/db/queries/support-notifications";
import { listPlatformAdminRecipientUserIds } from "@/lib/list-platform-admin-user-ids";
import { supportTicketPreview } from "@/lib/support-ticket-dto";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

export async function notifyAdminsOfNewSupportTicket(input: {
  ticketId: number;
  subject: string;
  message: string;
  userName?: string | null;
}) {
  const adminIds = await listPlatformAdminRecipientUserIds(clerkClient);
  if (adminIds.length === 0) return;

  const who = input.userName?.trim() || "A user";
  const preview = supportTicketPreview(
    `${who} opened ticket #${input.ticketId}: ${input.message}`,
  );

  await insertSupportTicketNotifications(
    adminIds.map((recipientUserId) => ({
      recipientUserId,
      ticketId: input.ticketId,
      kind: "new_ticket" as const,
      preview,
    })),
  );
}

export async function notifyAdminsOfUserTicketReply(input: {
  ticketId: number;
  subject: string;
  message: string;
  userName?: string | null;
}) {
  const adminIds = await listPlatformAdminRecipientUserIds(clerkClient);
  if (adminIds.length === 0) return;

  const who = input.userName?.trim() || "User";
  const preview = supportTicketPreview(`${who} replied on #${input.ticketId}: ${input.message}`);

  await insertSupportTicketNotifications(
    adminIds.map((recipientUserId) => ({
      recipientUserId,
      ticketId: input.ticketId,
      kind: "user_reply" as const,
      preview,
    })),
  );
}

export async function notifyUserOfAdminTicketReply(input: {
  ticketId: number;
  recipientUserId: string;
  subject: string;
  message: string;
  adminName: string;
}) {
  const preview = supportTicketPreview(
    `${input.adminName} replied on your ticket: ${input.message}`,
  );

  await insertSupportTicketNotifications([
    {
      recipientUserId: input.recipientUserId,
      ticketId: input.ticketId,
      kind: "admin_reply",
      preview,
    },
  ]);
}

export async function notifyUserOfTicketResolved(input: {
  ticketId: number;
  recipientUserId: string;
  subject: string;
  resolvedByName: string;
}) {
  const preview = supportTicketPreview(
    `${input.resolvedByName} marked your ticket as resolved: ${input.subject}`,
  );

  await insertSupportTicketNotifications([
    {
      recipientUserId: input.recipientUserId,
      ticketId: input.ticketId,
      kind: "status_resolved",
      preview,
    },
  ]);
}
