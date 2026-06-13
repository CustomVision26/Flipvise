"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/clerk-auth";
import { createClerkClient } from "@clerk/backend";
import {
  updateSupportTicketStatus,
  addTicketReply,
  getSupportTicketStats,
  getTicketWithReplies,
  getSupportTicketById,
  type SupportStatus,
} from "@/db/queries/support";
import {
  markSupportNotificationsReadForTicket,
  listSupportNotificationsForRecipient,
  countUnreadSupportNotificationsForRecipient,
} from "@/db/queries/support-notifications";
import {
  serializeSupportTicketRow,
  type SerializedTicket,
  type SupportStats,
} from "@/lib/support-admin-dto";
import {
  serializeSupportNotificationRow,
  serializeSupportTicketForThread,
  serializeSupportTicketMessageRow,
  type SerializedSupportNotification,
} from "@/lib/support-ticket-dto";
import {
  notifyUserOfAdminTicketReply,
  notifyUserOfTicketResolved,
} from "@/lib/support-ticket-notify";
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
    userId;
  return { userId, name };
}

const updateStatusSchema = z.object({
  ticketId: z.number().int().positive(),
  status: z.enum(["open", "in_progress", "resolved", "closed"]),
});

const replySchema = z.object({
  ticketId: z.number().int().positive(),
  message: z.string().min(1, "Reply cannot be empty").max(5000),
});

const ticketIdSchema = z.object({
  ticketId: z.number().int().positive(),
});

export type AdminUpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type AdminReplyInput = z.infer<typeof replySchema>;

export async function getAdminSupportNotificationsAction(): Promise<{
  unreadCount: number;
  notifications: SerializedSupportNotification[];
}> {
  const { userId } = await requireAdmin();

  const [unreadCount, rows] = await Promise.all([
    countUnreadSupportNotificationsForRecipient(userId),
    listSupportNotificationsForRecipient(userId, 30),
  ]);

  const ticketIds = [...new Set(rows.map((r) => r.ticketId))];
  const subjectByTicketId = new Map<number, string>();
  await Promise.all(
    ticketIds.map(async (ticketId) => {
      const ticket = await getSupportTicketById(ticketId);
      if (ticket) subjectByTicketId.set(ticketId, ticket.subject);
    }),
  );

  return {
    unreadCount,
    notifications: rows.map((row) =>
      serializeSupportNotificationRow(row, subjectByTicketId.get(row.ticketId) ?? `Ticket #${row.ticketId}`),
    ),
  };
}

export async function getAdminSupportTicketThreadAction(ticketId: number) {
  const { userId } = await requireAdmin();

  const parsed = ticketIdSchema.safeParse({ ticketId });
  if (!parsed.success) throw new Error("Invalid ticket");

  const thread = await getTicketWithReplies(parsed.data.ticketId);
  if (!thread) throw new Error("Ticket not found");

  await markSupportNotificationsReadForTicket(userId, parsed.data.ticketId);

  return {
    ticket: serializeSupportTicketForThread(thread.ticket),
    messages: thread.replies.map(serializeSupportTicketMessageRow),
  };
}

export async function adminUpdateTicketStatusAction(
  data: AdminUpdateStatusInput,
): Promise<{ ticket: SerializedTicket; stats: SupportStats }> {
  const { userId, name } = await requireAdmin();

  const parsed = updateStatusSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const existing = await getSupportTicketById(parsed.data.ticketId);
  if (!existing) throw new Error("Ticket not found");

  const row = await updateSupportTicketStatus(
    parsed.data.ticketId,
    parsed.data.status as SupportStatus,
  );
  if (!row) throw new Error("Ticket not found");

  if (parsed.data.status === "resolved" && existing.status !== "resolved") {
    await notifyUserOfTicketResolved({
      ticketId: row.id,
      recipientUserId: row.userId,
      subject: row.subject,
      resolvedByName: name,
    });
  }

  const stats = await getSupportTicketStats();

  revalidatePath("/admin");
  revalidatePath("/admin/support-center");
  revalidatePath("/dashboard/inbox");

  return { ticket: serializeSupportTicketRow(row), stats };
}

export async function adminReplyToTicketAction(
  data: AdminReplyInput,
): Promise<{ ticket: SerializedTicket; message: ReturnType<typeof serializeSupportTicketMessageRow> }> {
  const { userId, name } = await requireAdmin();

  const parsed = replySchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const existing = await getSupportTicketById(parsed.data.ticketId);
  if (!existing) throw new Error("Ticket not found");

  const { ticket, reply } = await addTicketReply({
    ticketId: parsed.data.ticketId,
    authorUserId: userId,
    authorName: name,
    authorRole: "admin",
    message: parsed.data.message.trim(),
  });
  if (!ticket || !reply) throw new Error("Ticket not found");

  let next = ticket;
  if (ticket.status === "open") {
    const bumped = await updateSupportTicketStatus(ticket.id, "in_progress");
    if (bumped) next = bumped;
  }

  await notifyUserOfAdminTicketReply({
    ticketId: next.id,
    recipientUserId: next.userId,
    subject: next.subject,
    message: parsed.data.message,
    adminName: name,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/support-center");
  revalidatePath("/dashboard/inbox");

  return {
    ticket: serializeSupportTicketRow(next),
    message: serializeSupportTicketMessageRow(reply),
  };
}

export async function adminMarkTicketResolvedAction(
  ticketId: number,
): Promise<{ ticket: SerializedTicket; stats: SupportStats }> {
  return adminUpdateTicketStatusAction({ ticketId, status: "resolved" });
}
