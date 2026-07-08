"use server";

import { z } from "zod";
import { auth } from "@/lib/clerk-auth";
import { getClerkUserFieldDisplayById } from "@/lib/clerk-user-display";
import {
  createSupportTicket,
  getSupportTicketsByUser,
  getSupportTicketByIdForUser,
  getTicketWithReplies,
  addTicketReply,
  updateSupportTicketStatus,
  type SupportStatus,
} from "@/db/queries/support";
import { markSupportNotificationsReadForTicket } from "@/db/queries/support-notifications";
import {
  notifyAdminsOfNewSupportTicket,
  notifyAdminsOfUserTicketReply,
} from "@/lib/support-ticket-notify";
import {
  serializeSupportTicketForThread,
  serializeSupportTicketMessageRow,
} from "@/lib/support-ticket-dto";
import { uploadSupportAttachmentToS3 } from "@/lib/s3";
import { revalidatePath } from "next/cache";

// ── Schemas ────────────────────────────────────────────────────────────────

const attachmentUrlField = z.string().url().optional();

const generalSupportSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(500),
  message: z.string().min(10, "Please provide more detail (min 10 characters)").max(5000),
  attachmentUrl: attachmentUrlField,
});

const bugReportSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(500),
  message: z
    .string()
    .min(10, "Please describe the bug in more detail")
    .max(5000),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  attachmentUrl: attachmentUrlField,
});

const featureRequestSchema = z.object({
  subject: z.string().min(1, "Feature title is required").max(500),
  message: z
    .string()
    .min(10, "Please describe the feature in more detail")
    .max(5000),
  attachmentUrl: attachmentUrlField,
});

const feedbackSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(500),
  message: z.string().min(5, "Please share your thoughts").max(5000),
  attachmentUrl: attachmentUrlField,
});

const billingSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(500),
  message: z.string().min(10, "Please describe your billing issue").max(5000),
  attachmentUrl: attachmentUrlField,
});

const accountSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(500),
  message: z.string().min(10, "Please describe your account issue").max(5000),
  attachmentUrl: attachmentUrlField,
});

// ── Types ──────────────────────────────────────────────────────────────────

export type GeneralSupportInput = z.infer<typeof generalSupportSchema>;
export type BugReportInput = z.infer<typeof bugReportSchema>;
export type FeatureRequestInput = z.infer<typeof featureRequestSchema>;
export type FeedbackInput = z.infer<typeof feedbackSchema>;
export type BillingInput = z.infer<typeof billingSchema>;
export type AccountInput = z.infer<typeof accountSchema>;

// ── Helpers ────────────────────────────────────────────────────────────────

async function getAuthenticatedUser() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const profile = await getClerkUserFieldDisplayById(userId).catch(() => null);
  return {
    userId,
    userEmail: profile?.primaryEmail ?? undefined,
    userName: profile?.primaryLine ?? undefined,
  };
}

async function afterTicketCreated(ticket: Awaited<ReturnType<typeof createSupportTicket>>) {
  try {
    await notifyAdminsOfNewSupportTicket({
      ticketId: ticket.id,
      subject: ticket.subject,
      message: ticket.message,
      userName: ticket.userName,
    });
  } catch (error) {
    console.error("[afterTicketCreated] notify admins:", error);
  }

  try {
    revalidatePath("/admin/support-center");
    revalidatePath("/dashboard/inbox");
  } catch (error) {
    console.error("[afterTicketCreated] revalidate:", error);
  }
}

async function submitSupportTicketSafely(
  create: () => Promise<Awaited<ReturnType<typeof createSupportTicket>>>,
) {
  try {
    const ticket = await create();
    await afterTicketCreated(ticket);
    return ticket;
  } catch (error) {
    console.error("[support] submit ticket:", error);
    throw new Error(
      "We couldn't send your message. Please try again in a moment or email support directly.",
    );
  }
}

const ticketIdSchema = z.object({
  ticketId: z.number().int().positive(),
});

const userReplySchema = z
  .object({
    ticketId: z.number().int().positive(),
    message: z.string().trim().max(5000).optional().default(""),
    imageUrl: z.string().url().max(2000).nullable().optional(),
  })
  .refine((data) => data.message.trim().length > 0 || Boolean(data.imageUrl), {
    message: "Add a message or attach an image",
  });

export async function uploadSupportAttachmentAction(formData: FormData): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const file = formData.get("image");
  if (!(file instanceof File)) throw new Error("No image file provided");

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    throw new Error("Only JPEG, PNG, WebP, and GIF images are allowed");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Image must be smaller than 10 MB");
  }

  return uploadSupportAttachmentToS3({ userId, file });
}

export async function submitGeneralSupportAction(data: GeneralSupportInput) {
  const { userId, userEmail, userName } = await getAuthenticatedUser();

  const parsed = generalSupportSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const ticket = await submitSupportTicketSafely(() =>
    createSupportTicket({
      userId,
      userEmail,
      userName: userName ?? undefined,
      subject: parsed.data.subject,
      message: parsed.data.message,
      category: "general_support",
      attachmentUrl: parsed.data.attachmentUrl ?? null,
    }),
  );
  return ticket;
}

export async function submitBugReportAction(data: BugReportInput) {
  const { userId, userEmail, userName } = await getAuthenticatedUser();

  const parsed = bugReportSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const ticket = await submitSupportTicketSafely(() =>
    createSupportTicket({
      userId,
      userEmail,
      userName: userName ?? undefined,
      subject: parsed.data.subject,
      message: parsed.data.message,
      category: "bug_report",
      priority: parsed.data.priority,
      attachmentUrl: parsed.data.attachmentUrl ?? null,
    }),
  );
  return ticket;
}

export async function submitFeatureRequestAction(data: FeatureRequestInput) {
  const { userId, userEmail, userName } = await getAuthenticatedUser();

  const parsed = featureRequestSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const ticket = await submitSupportTicketSafely(() =>
    createSupportTicket({
      userId,
      userEmail,
      userName: userName ?? undefined,
      subject: parsed.data.subject,
      message: parsed.data.message,
      category: "feature_request",
      priority: "normal",
      attachmentUrl: parsed.data.attachmentUrl ?? null,
    }),
  );
  return ticket;
}

export async function submitFeedbackAction(data: FeedbackInput) {
  const { userId, userEmail, userName } = await getAuthenticatedUser();

  const parsed = feedbackSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const ticket = await submitSupportTicketSafely(() =>
    createSupportTicket({
      userId,
      userEmail,
      userName: userName ?? undefined,
      subject: parsed.data.subject,
      message: parsed.data.message,
      category: "feedback",
      priority: "low",
      attachmentUrl: parsed.data.attachmentUrl ?? null,
    }),
  );
  return ticket;
}

export async function submitBillingIssueAction(data: BillingInput) {
  const { userId, userEmail, userName } = await getAuthenticatedUser();

  const parsed = billingSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const ticket = await submitSupportTicketSafely(() =>
    createSupportTicket({
      userId,
      userEmail,
      userName: userName ?? undefined,
      subject: parsed.data.subject,
      message: parsed.data.message,
      category: "billing",
      priority: "high",
      attachmentUrl: parsed.data.attachmentUrl ?? null,
    }),
  );
  return ticket;
}

export async function submitAccountIssueAction(data: AccountInput) {
  const { userId, userEmail, userName } = await getAuthenticatedUser();

  const parsed = accountSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const ticket = await submitSupportTicketSafely(() =>
    createSupportTicket({
      userId,
      userEmail,
      userName: userName ?? undefined,
      subject: parsed.data.subject,
      message: parsed.data.message,
      category: "account",
      priority: "normal",
      attachmentUrl: parsed.data.attachmentUrl ?? null,
    }),
  );
  return ticket;
}

export async function getMySupportTicketThreadAction(ticketId: number) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const parsed = ticketIdSchema.safeParse({ ticketId });
  if (!parsed.success) throw new Error("Invalid ticket");

  const thread = await getTicketWithReplies(parsed.data.ticketId);
  if (!thread || thread.ticket.userId !== userId) throw new Error("Ticket not found");

  await markSupportNotificationsReadForTicket(userId, parsed.data.ticketId);

  return {
    ticket: serializeSupportTicketForThread(thread.ticket),
    messages: thread.replies.map(serializeSupportTicketMessageRow),
  };
}

export async function replyToMySupportTicketAction(data: z.infer<typeof userReplySchema>) {
  const { userId, userName } = await getAuthenticatedUser();

  const parsed = userReplySchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  const ticket = await getSupportTicketByIdForUser(parsed.data.ticketId, userId);
  if (!ticket) throw new Error("Ticket not found");
  if (ticket.status === "closed") throw new Error("This ticket is closed.");

  const displayName = userName ?? "You";
  const messageText = parsed.data.message.trim();
  const imageUrl = parsed.data.imageUrl ?? null;
  const { ticket: updated, reply } = await addTicketReply({
    ticketId: ticket.id,
    authorUserId: userId,
    authorName: displayName,
    authorRole: "user",
    message: messageText,
    imageUrl,
  });
  if (!updated || !reply) throw new Error("Failed to send reply");

  if (updated.status === "resolved") {
    await updateSupportTicketStatus(ticket.id, "open");
  }

  await notifyAdminsOfUserTicketReply({
    ticketId: ticket.id,
    subject: ticket.subject,
    message: messageText || "[Image attachment]",
    userName: displayName,
  });

  revalidatePath("/admin/support-center");
  revalidatePath("/dashboard/inbox");

  return {
    ticket: serializeSupportTicketForThread(updated),
    message: serializeSupportTicketMessageRow(reply),
  };
}

export async function markMySupportTicketResolvedAction(ticketId: number) {
  const { userId, userName } = await getAuthenticatedUser();

  const parsed = ticketIdSchema.safeParse({ ticketId });
  if (!parsed.success) throw new Error("Invalid ticket");

  const ticket = await getSupportTicketByIdForUser(parsed.data.ticketId, userId);
  if (!ticket) throw new Error("Ticket not found");

  const updated = await updateSupportTicketStatus(ticket.id, "resolved");
  if (!updated) throw new Error("Failed to update ticket");

  revalidatePath("/admin/support-center");
  return serializeSupportTicketForThread(updated);
}

export async function reopenMySupportTicketAction(ticketId: number) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const parsed = ticketIdSchema.safeParse({ ticketId });
  if (!parsed.success) throw new Error("Invalid ticket");

  const ticket = await getSupportTicketByIdForUser(parsed.data.ticketId, userId);
  if (!ticket) throw new Error("Ticket not found");

  const updated = await updateSupportTicketStatus(ticket.id, "open");
  if (!updated) throw new Error("Failed to reopen ticket");

  revalidatePath("/admin/support-center");
  return serializeSupportTicketForThread(updated);
}

export async function getMyTicketsAction() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return getSupportTicketsByUser(userId);
}

export async function updateTicketStatusAction(
  ticketId: number,
  status: SupportStatus,
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return updateSupportTicketStatus(ticketId, status);
}
