"use server";

import { z } from "zod";
import { auth, currentUser } from "@clerk/nextjs/server";
import {
  createSupportTicket,
  getSupportTicketsByUser,
  updateSupportTicketStatus,
  type SupportStatus,
} from "@/db/queries/support";
import { uploadSupportAttachmentToS3 } from "@/lib/s3";

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
  const user = await currentUser();
  return {
    userId,
    userEmail: user?.emailAddresses?.[0]?.emailAddress,
    userName: user?.fullName ?? user?.username ?? undefined,
  };
}

// ── Actions ────────────────────────────────────────────────────────────────

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

  return createSupportTicket({
    userId,
    userEmail,
    userName: userName ?? undefined,
    subject: parsed.data.subject,
    message: parsed.data.message,
    category: "general_support",
  });
}

export async function submitBugReportAction(data: BugReportInput) {
  const { userId, userEmail, userName } = await getAuthenticatedUser();

  const parsed = bugReportSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  return createSupportTicket({
    userId,
    userEmail,
    userName: userName ?? undefined,
    subject: parsed.data.subject,
    message: parsed.data.message,
    category: "bug_report",
    priority: parsed.data.priority,
  });
}

export async function submitFeatureRequestAction(data: FeatureRequestInput) {
  const { userId, userEmail, userName } = await getAuthenticatedUser();

  const parsed = featureRequestSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  return createSupportTicket({
    userId,
    userEmail,
    userName: userName ?? undefined,
    subject: parsed.data.subject,
    message: parsed.data.message,
    category: "feature_request",
    priority: "normal",
  });
}

export async function submitFeedbackAction(data: FeedbackInput) {
  const { userId, userEmail, userName } = await getAuthenticatedUser();

  const parsed = feedbackSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  return createSupportTicket({
    userId,
    userEmail,
    userName: userName ?? undefined,
    subject: parsed.data.subject,
    message: parsed.data.message,
    category: "feedback",
    priority: "low",
  });
}

export async function submitBillingIssueAction(data: BillingInput) {
  const { userId, userEmail, userName } = await getAuthenticatedUser();

  const parsed = billingSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  return createSupportTicket({
    userId,
    userEmail,
    userName: userName ?? undefined,
    subject: parsed.data.subject,
    message: parsed.data.message,
    category: "billing",
    priority: "high",
  });
}

export async function submitAccountIssueAction(data: AccountInput) {
  const { userId, userEmail, userName } = await getAuthenticatedUser();

  const parsed = accountSchema.safeParse(data);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");

  return createSupportTicket({
    userId,
    userEmail,
    userName: userName ?? undefined,
    subject: parsed.data.subject,
    message: parsed.data.message,
    category: "account",
    priority: "normal",
  });
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
